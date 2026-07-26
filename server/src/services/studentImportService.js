import prisma from '../utils/db.js';
import { z } from 'zod';
import { generateTemporaryPassword, hashPassword } from '../utils/passwordGenerator.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const batchRegex = /^\d{4}-\d{2,4}$/; // Matches e.g. "2024-28" or "2024-2028"

// Validation Zod schema for each student row
const studentRowSchema = z.object({
  rollNo: z.string().min(1, 'Roll number is required').max(30),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().regex(emailRegex, 'Invalid email format'),
  departmentCode: z.string().min(1, 'Department code is required').max(10).transform(v => v.toUpperCase()),
  batchYear: z.string().regex(batchRegex, 'Batch year must be in format YYYY-YY or YYYY-YYYY'),
  section: z.string().min(1, 'Section is required').max(2).transform(v => v.toUpperCase()),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits').optional().nullable()
});

/**
 * Validates the student spreadsheet data rows.
 * Preloads lookups to avoid N+1 queries.
 */
export async function validateStudentsData(rows) {
  const errors = [];
  const validRowsData = [];

  // Preload departments
  const departmentsList = await prisma.department.findMany({ select: { id: true, code: true } });
  const deptMap = new Map(departmentsList.map(d => [d.code.toUpperCase(), d.id]));

  // Preload existing unique keys from database
  const studentsList = await prisma.student.findMany({ select: { rollNo: true } });
  const dbRollNos = new Set(studentsList.map(s => s.rollNo.toLowerCase()));

  const usersList = await prisma.user.findMany({ select: { email: true } });
  const dbEmails = new Set(usersList.map(u => u.email.toLowerCase()));

  // Track duplicates inside the file
  const fileRollNos = new Map(); // rollNo -> rowNumber
  const fileEmails = new Map(); // email -> rowNumber

  for (const row of rows) {
    const rowNum = row._rowNumber;
    
    // Zod parsing
    const parsed = studentRowSchema.safeParse(row);
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

    const { rollNo, name, email, departmentCode, batchYear, section, phone } = parsed.data;

    // Check duplicate roll number inside the file
    const normRoll = rollNo.toLowerCase();
    if (fileRollNos.has(normRoll)) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'DUPLICATE_IN_FILE',
        message: `Duplicate roll number also appears on row ${fileRollNos.get(normRoll)}`
      });
    } else {
      fileRollNos.set(normRoll, rowNum);
    }

    // Check duplicate email inside the file
    const normEmail = email.toLowerCase();
    if (fileEmails.has(normEmail)) {
      errors.push({
        row: rowNum,
        column: 'email',
        code: 'DUPLICATE_IN_FILE',
        message: `Duplicate email also appears on row ${fileEmails.get(normEmail)}`
      });
    } else {
      fileEmails.set(normEmail, rowNum);
    }

    // Check duplicate roll number in database
    if (dbRollNos.has(normRoll)) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'DUPLICATE_IN_DATABASE',
        message: `Roll number "${rollNo}" already exists in the database.`
      });
    }

    // Check duplicate email in database
    if (dbEmails.has(normEmail)) {
      errors.push({
        row: rowNum,
        column: 'email',
        code: 'DUPLICATE_IN_DATABASE',
        message: `Email "${email}" already exists in the database.`
      });
    }

    // Resolve department
    const departmentId = deptMap.get(departmentCode);
    if (!departmentId) {
      errors.push({
        row: rowNum,
        column: 'departmentCode',
        code: 'UNKNOWN_DEPARTMENT',
        message: `Department code "${departmentCode}" does not exist.`
      });
    }

    if (errors.length === 0 || !errors.some(e => e.row === rowNum)) {
      validRowsData.push({
        rollNo,
        name,
        email,
        departmentId,
        batchYear,
        section,
        mobileNo: phone || '',
        guardianContact: '' // Empty/not supplied by template as per schema requirement
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
 * Persists validated students atomically.
 */
export async function importStudentsConfirmed(validData, actorUser, req) {
  return await prisma.$transaction(async (tx) => {
    const createdCredentials = [];

    for (const record of validData) {
      const tempPassword = generateTemporaryPassword();
      const passHash = await hashPassword(tempPassword);

      const user = await tx.user.create({
        data: {
          name: record.name,
          email: record.email,
          passwordHash: passHash,
          role: 'STUDENT',
          departmentId: record.departmentId
        }
      });

      const studentProfile = await tx.student.create({
        data: {
          userId: user.id,
          rollNo: record.rollNo,
          batchYear: record.batchYear,
          section: record.section,
          mobileNo: record.mobileNo,
          guardianContact: record.guardianContact,
          departmentId: record.departmentId
        }
      });

      createdCredentials.push({
        identifier: record.rollNo,
        name: record.name,
        email: record.email,
        temporaryPassword: tempPassword
      });

      // Audit Log for student registration
      await logAudit({
        actorUserId: actorUser.id,
        actorRole: actorUser.role,
        action: AUDIT_ACTIONS.STUDENT_CREATED,
        entityType: 'STUDENT',
        entityId: studentProfile.id,
        newValue: {
          id: studentProfile.id,
          rollNo: studentProfile.rollNo,
          batchYear: studentProfile.batchYear,
          section: studentProfile.section,
          name: user.name,
          email: user.email
        },
        req
      }, tx);
    }

    // Log the overall import execution
    await logAudit({
      actorUserId: actorUser.id,
      actorRole: actorUser.role,
      action: 'BULK_STUDENT_IMPORT',
      entityType: 'User',
      entityId: actorUser.id,
      newValue: {
        count: validData.length
      },
      req
    }, tx);

    return createdCredentials;
  });
}
