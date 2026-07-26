import prisma from '../utils/db.js';
import { z } from 'zod';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../utils/notificationService.js';

const attendanceSchema = z.object({
  subjectId: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(['PRESENT', 'ABSENT']),
  })),
});

const marksSchema = z.object({
  subjectId: z.string().uuid(),
  examType: z.enum(['INTERNAL1', 'INTERNAL2', 'SEMESTER']),
  maxMarks: z.number().positive(),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    marksObtained: z.number().nonnegative(),
  })),
});

// Helper function to check and notify student if their attendance falls below threshold
async function checkLowAttendance(tx, studentId, subjectId = null) {
  // Get threshold
  const thresholdSetting = await tx.setting.findUnique({
    where: { key: 'low_attendance_threshold' },
  });
  const threshold = parseFloat(thresholdSetting?.value || '75');

  // Calculate overall attendance
  const total = await tx.attendance.count({
    where: { studentId },
  });

  const present = await tx.attendance.count({
    where: { studentId, status: 'PRESENT' },
  });

  const percentage = total > 0 ? (present / total) * 100 : 100;

  if (percentage < threshold) {
    const roundedPercent = percentage.toFixed(1);
    const message = `Alert: Your overall attendance has dropped to ${roundedPercent}%, which is below the minimum required ${threshold}%. Please meet your class advisor.`;

    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: { userId: true }
    });

    if (student && student.userId) {
      // Cooldown strategy: Check if there is an unread attendance warning for this student in the last 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await tx.notification.findFirst({
        where: {
          userId: student.userId,
          type: 'ATTENDANCE_WARNING',
          relatedEntityType: 'SUBJECT',
          relatedEntityId: subjectId,
          createdAt: { gte: yesterday },
          readStatus: false
        }
      });

      if (!existing) {
        await createNotification({
          userId: student.userId,
          title: 'Attendance Alert',
          message,
          type: NOTIFICATION_TYPES.ATTENDANCE_WARNING,
          priority: NOTIFICATION_PRIORITIES.HIGH,
          relatedEntityType: 'SUBJECT',
          relatedEntityId: subjectId
        }, tx);
      }
    }
  }
}

export const getFacultySubjects = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(400).json({ message: 'User is not a faculty member' });
    }

    const subjects = await prisma.subject.findMany({
      where: { facultyId },
      include: {
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    res.json(subjects);
  } catch (error) {
    console.error('Error fetching faculty subjects:', error);
    res.status(500).json({ message: 'Server error fetching subjects' });
  }
};

export const getStudentsList = async (req, res) => {
  try {
    const { departmentId, batchYear, section } = req.query;

    if (!departmentId || !batchYear || !section) {
      return res.status(400).json({ message: 'departmentId, batchYear, and section are required query parameters' });
    }

    const students = await prisma.student.findMany({
      where: {
        departmentId,
        batchYear,
        section,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        rollNo: 'asc',
      },
    });

    res.json(students);
  } catch (error) {
    console.error('Error fetching student list:', error);
    res.status(500).json({ message: 'Server error fetching students' });
  }
};

export const markAttendance = async (req, res) => {
  try {
    const validation = attendanceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const { subjectId, date, records } = validation.data;
    const markedById = req.user.id;

    // Use normalized Date object (Y-M-D) without time components for unique constraint match
    const formattedDate = new Date(date + 'T00:00:00.000Z');

    // Query existing logs to determine if this is an update vs creation and screen no-ops
    const existingRecords = await prisma.attendance.findMany({
      where: {
        subjectId,
        date: formattedDate,
        studentId: {
          in: records.map(r => r.studentId),
        },
      },
    });

    const isUpdate = existingRecords.length > 0;

    const prevMap = {};
    existingRecords.forEach(r => { prevMap[r.studentId] = r.status; });

    const changedRecords = [];
    records.forEach(rec => {
      const prevStatus = prevMap[rec.studentId];
      if (prevStatus && prevStatus !== rec.status) {
        changedRecords.push({
          studentId: rec.studentId,
          prevStatus,
          newStatus: rec.status
        });
      }
    });

    const hasChanges = changedRecords.length > 0;

    // Run in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing records for this subject and date to prevent duplicates and handle edits
      await tx.attendance.deleteMany({
        where: {
          subjectId,
          date: formattedDate,
          studentId: {
            in: records.map(r => r.studentId),
          },
        },
      });

      // Insert new records
      await tx.attendance.createMany({
        data: records.map((rec) => ({
          studentId: rec.studentId,
          subjectId,
          date: formattedDate,
          status: rec.status,
          markedById,
        })),
      });

      // Audit logs
      if (isUpdate) {
        if (hasChanges) {
          await logAudit({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: AUDIT_ACTIONS.ATTENDANCE_UPDATED,
            entityType: 'ATTENDANCE',
            entityId: subjectId,
            previousValue: { date: formattedDate, changed: changedRecords.map(c => ({ studentId: c.studentId, status: c.prevStatus })) },
            newValue: { date: formattedDate, changed: changedRecords.map(c => ({ studentId: c.studentId, status: c.newStatus })) },
            req
          }, tx);
        }
      } else {
        await logAudit({
          actorUserId: req.user.id,
          actorRole: req.user.role,
          action: AUDIT_ACTIONS.ATTENDANCE_CREATED,
          entityType: 'ATTENDANCE',
          entityId: subjectId,
          previousValue: null,
          newValue: { date: formattedDate, records: records.map(r => ({ studentId: r.studentId, status: r.status })) },
          req
        }, tx);
      }

      // Check attendance levels for each student and send alert if needed
      for (const rec of records) {
        await checkLowAttendance(tx, rec.studentId, subjectId);
      }
    });

    res.status(200).json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Server error marking attendance' });
  }
};

export const updateAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['PRESENT', 'ABSENT'].includes(status)) {
      return res.status(400).json({ message: 'Status must be PRESENT or ABSENT' });
    }

    const prevRecord = await prisma.attendance.findUnique({ where: { id } });
    if (!prevRecord) return res.status(404).json({ message: 'Attendance record not found' });

    if (prevRecord.status === status) {
      // Return immediately if it's a no-op change
      return res.json({ message: 'Attendance record unchanged (no-op)', attendance: prevRecord });
    }

    // Wrap update, audit log and low attendance check in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.update({
        where: { id },
        data: {
          status,
          markedById: req.user.id,
        },
      });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.ATTENDANCE_UPDATED,
        entityType: 'ATTENDANCE',
        entityId: id,
        previousValue: { status: prevRecord.status },
        newValue: { status },
        req
      }, tx);

      await checkLowAttendance(tx, attendance.studentId, attendance.subjectId);
      return attendance;
    });

    res.json({ message: 'Attendance record updated successfully', attendance: result });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    res.status(500).json({ message: 'Server error updating attendance' });
  }
};

export const enterMarks = async (req, res) => {
  try {
    const validation = marksSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const { subjectId, examType, maxMarks, records } = validation.data;

    // Fetch existing records before performing database updates to calculate differences
    const existingMarks = await prisma.mark.findMany({
      where: {
        subjectId,
        examType,
        studentId: {
          in: records.map(r => r.studentId),
        },
      },
    });

    const isUpdate = existingMarks.length > 0;

    const prevMap = {};
    existingMarks.forEach(m => { prevMap[m.studentId] = m.marksObtained; });

    const changedMarks = [];
    records.forEach(rec => {
      const prevVal = prevMap[rec.studentId];
      if (prevVal !== undefined && prevVal !== rec.marksObtained) {
        changedMarks.push({
          studentId: rec.studentId,
          prevMarks: prevVal,
          newMarks: rec.marksObtained
        });
      }
    });

    const hasChanges = changedMarks.length > 0;

    // Fetch subject and user details to prepare notification payload
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { name: true }
    });
    const subjectName = subject?.name || 'Subject';

    const studentsToNotify = isUpdate 
      ? changedMarks.map(c => c.studentId)
      : records.map(r => r.studentId);

    const studentProfiles = await prisma.student.findMany({
      where: { id: { in: studentsToNotify } },
      select: { id: true, userId: true }
    });

    const studentUserMap = {};
    studentProfiles.forEach(s => { studentUserMap[s.id] = s.userId; });

    // Run in transaction
    await prisma.$transaction(async (tx) => {
      // Upsert marks: Delete existing ones first
      await tx.mark.deleteMany({
        where: {
          subjectId,
          examType,
          studentId: {
            in: records.map((r) => r.studentId),
          },
        },
      });

      // Insert new ones
      await tx.mark.createMany({
        data: records.map((rec) => {
          if (rec.marksObtained > maxMarks) {
            throw new Error(`Marks obtained (${rec.marksObtained}) cannot exceed max marks (${maxMarks}).`);
          }
          return {
            studentId: rec.studentId,
            subjectId,
            examType,
            maxMarks,
            marksObtained: rec.marksObtained,
          };
        }),
      });

      // Send notifications to students if there are actual updates or new entries
      for (const studentId of studentsToNotify) {
        const userId = studentUserMap[studentId];
        if (userId) {
          await createNotification({
            userId,
            title: 'Marks Published',
            message: `Your ${examType} marks for ${subjectName} are now available.`,
            type: NOTIFICATION_TYPES.MARKS_PUBLISHED,
            priority: NOTIFICATION_PRIORITIES.NORMAL,
            relatedEntityType: 'MARK',
            relatedEntityId: subjectId
          }, tx);
        }
      }

      // Audit logs
      if (isUpdate) {
        if (hasChanges) {
          await logAudit({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: AUDIT_ACTIONS.MARK_UPDATED,
            entityType: 'MARK',
            entityId: subjectId,
            previousValue: { examType, changed: changedMarks.map(c => ({ studentId: c.studentId, marks: c.prevMarks })) },
            newValue: { examType, changed: changedMarks.map(c => ({ studentId: c.studentId, marks: c.newMarks })) },
            req
          }, tx);
        }
      } else {
        await logAudit({
          actorUserId: req.user.id,
          actorRole: req.user.role,
          action: AUDIT_ACTIONS.MARK_CREATED,
          entityType: 'MARK',
          entityId: subjectId,
          previousValue: null,
          newValue: { examType, maxMarks, records: records.map(r => ({ studentId: r.studentId, marks: r.marksObtained })) },
          req
        }, tx);
      }
    });

    res.json({ message: 'Marks updated successfully' });
  } catch (error) {
    console.error('Error entering marks:', error);
    res.status(500).json({ message: error.message || 'Server error entering marks' });
  }
};

// Retrieve existing attendance for checking or editing
export const getExistingAttendance = async (req, res) => {
  try {
    const { subjectId, date } = req.query;

    if (!subjectId || !date) {
      return res.status(400).json({ message: 'subjectId and date are required query parameters' });
    }

    const formattedDate = new Date(date + 'T00:00:00.000Z');

    const records = await prisma.attendance.findMany({
      where: {
        subjectId,
        date: formattedDate,
      },
      select: {
        id: true,
        studentId: true,
        status: true,
      },
    });

    res.json(records);
  } catch (error) {
    console.error('Error fetching existing attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Retrieve existing marks for loading into editing spreadsheet
export const getExistingMarks = async (req, res) => {
  try {
    const { subjectId, examType } = req.query;

    if (!subjectId || !examType) {
      return res.status(400).json({ message: 'subjectId and examType are required query parameters' });
    }

    const records = await prisma.mark.findMany({
      where: {
        subjectId,
        examType: examType,
      },
      select: {
        id: true,
        studentId: true,
        marksObtained: true,
        maxMarks: true,
      },
    });

    res.json(records);
  } catch (error) {
    console.error('Error fetching existing marks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
