import prisma from '../utils/db.js';
import { z } from 'zod';
import { generateTemporaryPassword, hashPassword } from '../utils/passwordGenerator.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const facultyRowSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().regex(emailRegex, 'Invalid email format'),
  departmentCode: z.string().min(1, 'Department code is required').max(10).transform(v => v.toUpperCase()),
  designation: z.string().min(2, 'Designation is required').max(100)
});

/**
 * Validates faculty spreadsheet data rows.
 * Preloads lookups to avoid N+1 queries.
 */
export async function validateFacultyData(rows) {
  const errors = [];
  const validRowsData = [];

  // Preload departments
  const departmentsList = await prisma.department.findMany({ select: { id: true, code: true } });
  const deptMap = new Map(departmentsList.map(d => [d.code.toUpperCase(), d.id]));

  // Preload existing unique emails from database
  const usersList = await prisma.user.findMany({ select: { email: true } });
  const dbEmails = new Set(usersList.map(u => u.email.toLowerCase()));

  // Track duplicate emails inside the file
  const fileEmails = new Map(); // email -> rowNumber

  for (const row of rows) {
    const rowNum = row._rowNumber;

    // Zod parsing
    const parsed = facultyRowSchema.safeParse(row);
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

    const { name, email, departmentCode, designation } = parsed.data;

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
        name,
        email,
        departmentId,
        designation
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
 * Persists validated faculty atomically.
 */
export async function importFacultyConfirmed(validData, actorUser, req) {
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
          role: 'FACULTY',
          departmentId: record.departmentId
        }
      });

      const facultyProfile = await tx.faculty.create({
        data: {
          userId: user.id,
          departmentId: record.departmentId,
          designation: record.designation
        }
      });

      createdCredentials.push({
        identifier: record.email, // using email as identifier for faculty
        name: record.name,
        email: record.email,
        temporaryPassword: tempPassword
      });

      // Audit Log for faculty registration
      await logAudit({
        actorUserId: actorUser.id,
        actorRole: actorUser.role,
        action: AUDIT_ACTIONS.FACULTY_CREATED,
        entityType: 'FACULTY',
        entityId: facultyProfile.id,
        newValue: {
          id: facultyProfile.id,
          designation: facultyProfile.designation,
          name: user.name,
          email: user.email
        },
        req
      }, tx);
    }

    // Log bulk operation
    await logAudit({
      actorUserId: actorUser.id,
      actorRole: actorUser.role,
      action: 'BULK_FACULTY_IMPORT',
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
