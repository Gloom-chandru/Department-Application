import prisma from '../utils/db.js';
import { z } from 'zod';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../utils/notificationService.js';

const marksRowSchema = z.object({
  rollNo: z.string().min(1, 'Roll number is required'),
  subjectCode: z.string().min(1, 'Subject code is required').transform(v => v.toUpperCase()),
  examType: z.enum(['INTERNAL1', 'INTERNAL2', 'SEMESTER']),
  marksObtained: z.coerce.number().nonnegative('Marks obtained must be greater than or equal to 0'),
  maxMarks: z.coerce.number().positive('Max marks must be greater than 0')
});

/**
 * Validates the marks spreadsheet data rows.
 */
export async function validateMarksData(rows, actorUser) {
  const errors = [];
  const validRowsData = [];

  // Preload students
  const studentsList = await prisma.student.findMany({
    include: { user: { select: { name: true } } }
  });
  const studentMap = new Map(studentsList.map(s => [s.rollNo.toLowerCase(), s]));

  // Preload subjects
  const subjectsList = await prisma.subject.findMany({
    include: { faculty: { select: { id: true, userId: true } } }
  });
  const subjectMap = new Map(subjectsList.map(s => [s.code.toUpperCase(), s]));

  // Preload existing marks to identify CREATE, UPDATE, or NO-OP
  const existingMarks = await prisma.mark.findMany();
  // Key: studentId-subjectId-examType
  const marksMap = new Map(existingMarks.map(m => [`${m.studentId}-${m.subjectId}-${m.examType}`, m]));

  for (const row of rows) {
    const rowNum = row._rowNumber;

    // Zod validation
    const parsed = marksRowSchema.safeParse(row);
    if (!parsed.success) {
      parsed.error.errors.forEach(err => {
        errors.push({
          row: rowNum,
          column: err.path[0],
          code: 'VALIDATION_FAILED',
          message: err.message
        });
      });
      continue;
    }

    const { rollNo, subjectCode, examType, marksObtained, maxMarks } = parsed.data;

    // 1. Max marks check
    if (marksObtained > maxMarks) {
      errors.push({
        row: rowNum,
        column: 'marksObtained',
        code: 'MARKS_EXCEED_MAX',
        message: `Marks obtained (${marksObtained}) cannot exceed max marks (${maxMarks}).`
      });
    }

    // 2. Student check
    const student = studentMap.get(rollNo.toLowerCase());
    if (!student) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'STUDENT_NOT_FOUND',
        message: `Student with roll number "${rollNo}" not found.`
      });
    }

    // 3. Subject check
    const subject = subjectMap.get(subjectCode);
    if (!subject) {
      errors.push({
        row: rowNum,
        column: 'subjectCode',
        code: 'SUBJECT_NOT_FOUND',
        message: `Subject with code "${subjectCode}" not found.`
      });
    }

    // 4. Student department match check
    if (student && subject && student.departmentId !== subject.departmentId) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'DEPARTMENT_MISMATCH',
        message: `Student "${rollNo}" belongs to a different department than Subject "${subjectCode}".`
      });
    }

    // 5. Faculty ownership check
    if (actorUser.role === 'FACULTY' && subject) {
      // Find faculty profile of actor
      const facultyProfile = await prisma.faculty.findUnique({
        where: { userId: actorUser.id }
      });
      if (!facultyProfile || subject.facultyId !== facultyProfile.id) {
        errors.push({
          row: rowNum,
          column: 'subjectCode',
          code: 'UNAUTHORIZED_SUBJECT',
          message: `You are not authorized to import marks for Subject "${subjectCode}" (not assigned to you).`
        });
      }
    }

    if (errors.length === 0 || !errors.some(e => e.row === rowNum)) {
      // Determine CREATE, UPDATE, or NO-OP
      const markKey = `${student.id}-${subject.id}-${examType}`;
      const existing = marksMap.get(markKey);

      let action = 'CREATE';
      let prevVal = null;

      if (existing) {
        if (existing.marksObtained === marksObtained && existing.maxMarks === maxMarks) {
          action = 'NO-OP';
        } else {
          action = 'UPDATE';
          prevVal = { marksObtained: existing.marksObtained, maxMarks: existing.maxMarks };
        }
      }

      validRowsData.push({
        rowNum,
        studentId: student.id,
        userId: student.userId,
        studentName: student.user.name,
        rollNo: student.rollNo,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        examType,
        marksObtained,
        maxMarks,
        action,
        prevVal,
        markId: existing?.id || null
      });
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalRows: rows.length,
      validRows: validRowsData.length,
      invalidRows: rows.length - validRowsData.length
    },
    errors,
    data: validRowsData
  };
}

/**
 * Persists validated marks changes in a database transaction.
 */
export async function importMarksConfirmed(validData, actorUser, req) {
  return await prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let updatedCount = 0;
    let noopCount = 0;

    // Group updates for audit logging
    const createdList = [];
    const updatedList = [];

    for (const record of validData) {
      if (record.action === 'NO-OP') {
        noopCount++;
        continue;
      }

      if (record.action === 'CREATE') {
        const mark = await tx.mark.create({
          data: {
            studentId: record.studentId,
            subjectId: record.subjectId,
            examType: record.examType,
            marksObtained: record.marksObtained,
            maxMarks: record.maxMarks
          }
        });
        createdCount++;
        createdList.push({ studentId: record.studentId, subjectId: record.subjectId, examType: record.examType, marks: record.marksObtained });

        // Notify student of published marks
        await createNotification({
          userId: record.userId,
          title: 'Marks Published',
          message: `Your ${record.examType} marks for ${record.subjectName} are now available.`,
          type: NOTIFICATION_TYPES.MARKS_PUBLISHED,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          relatedEntityType: 'MARK',
          relatedEntityId: record.subjectId
        }, tx);
      } else if (record.action === 'UPDATE') {
        await tx.mark.update({
          where: { id: record.markId },
          data: {
            marksObtained: record.marksObtained,
            maxMarks: record.maxMarks
          }
        });
        updatedCount++;
        updatedList.push({
          studentId: record.studentId,
          subjectId: record.subjectId,
          examType: record.examType,
          prevMarks: record.prevVal.marksObtained,
          newMarks: record.marksObtained
        });

        // Notify student of marks update
        await createNotification({
          userId: record.userId,
          title: 'Marks Updated',
          message: `Your ${record.examType} marks for ${record.subjectName} have been updated to ${record.marksObtained}/${record.maxMarks}.`,
          type: NOTIFICATION_TYPES.MARKS_PUBLISHED,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          relatedEntityType: 'MARK',
          relatedEntityId: record.subjectId
        }, tx);
      }
    }

    // Log separate audits for creations vs updates if any
    if (createdList.length > 0) {
      await logAudit({
        actorUserId: actorUser.id,
        actorRole: actorUser.role,
        action: AUDIT_ACTIONS.MARK_CREATED,
        entityType: 'MARK',
        entityId: actorUser.id, // Scoped to batch operation under actor
        newValue: { bulkImport: true, created: createdList },
        req
      }, tx);
    }

    if (updatedList.length > 0) {
      await logAudit({
        actorUserId: actorUser.id,
        actorRole: actorUser.role,
        action: AUDIT_ACTIONS.MARK_UPDATED,
        entityType: 'MARK',
        entityId: actorUser.id,
        previousValue: { bulkImport: true, changed: updatedList.map(u => ({ studentId: u.studentId, marks: u.prevMarks })) },
        newValue: { bulkImport: true, changed: updatedList.map(u => ({ studentId: u.studentId, marks: u.newMarks })) },
        req
      }, tx);
    }

    // Log the bulk marks import operation
    await logAudit({
      actorUserId: actorUser.id,
      actorRole: actorUser.role,
      action: 'BULK_MARK_IMPORT',
      entityType: 'User',
      entityId: actorUser.id,
      newValue: {
        createdCount,
        updatedCount,
        noopCount
      },
      req
    }, tx);

    return { createdCount, updatedCount, noopCount };
  });
}
