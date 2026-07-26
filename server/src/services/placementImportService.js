import { z } from 'zod';
import prisma from '../utils/db.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';

const profileRowSchema = z.object({
  rollNo: z.string().min(1, 'Roll number is required').max(30),
  cgpa: z.coerce.number().min(0).max(10),
  currentBacklogs: z.coerce.number().int().min(0).default(0)
});

/**
 * Validates CGPA/backlog import rows.
 */
export async function validatePlacementProfileData(rows) {
  const errors = [];
  const validRowsData = [];

  const students = await prisma.student.findMany({
    select: { id: true, rollNo: true, cgpa: true, currentBacklogs: true }
  });
  const rollMap = new Map(students.map((s) => [s.rollNo.toLowerCase(), s]));
  const fileRolls = new Map();

  for (const row of rows) {
    const rowNum = row._rowNumber;
    const parsed = profileRowSchema.safeParse(row);
    if (!parsed.success) {
      parsed.error.errors.forEach((err) => {
        errors.push({
          row: rowNum,
          column: err.path[0],
          code: 'VALIDATION_FAILED',
          message: err.message
        });
      });
      continue;
    }

    const { rollNo, cgpa, currentBacklogs } = parsed.data;
    const norm = rollNo.toLowerCase();
    if (fileRolls.has(norm)) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'DUPLICATE_IN_FILE',
        message: `Duplicate roll number also appears on row ${fileRolls.get(norm)}`
      });
    } else {
      fileRolls.set(norm, rowNum);
    }

    const student = rollMap.get(norm);
    if (!student) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'UNKNOWN_STUDENT',
        message: `Student with roll number "${rollNo}" not found.`
      });
      continue;
    }

    if (!errors.some((e) => e.row === rowNum)) {
      validRowsData.push({
        studentId: student.id,
        rollNo: student.rollNo,
        cgpa,
        currentBacklogs,
        previousCgpa: student.cgpa != null ? Number(student.cgpa) : null,
        previousBacklogs: student.currentBacklogs
      });
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalRows: rows.length,
      validRows: validRowsData.length,
      invalidRows: errors.length === 0 ? 0 : rows.length - validRowsData.length
    },
    errors,
    data: validRowsData
  };
}

export async function importPlacementProfilesConfirmed(data, actor, req) {
  await prisma.$transaction(async (tx) => {
    for (const row of data) {
      await tx.student.update({
        where: { id: row.studentId },
        data: { cgpa: row.cgpa, currentBacklogs: row.currentBacklogs }
      });
      const profile = await tx.studentPlacementProfile.findUnique({
        where: { studentId: row.studentId }
      });
      if (!profile) {
        await tx.studentPlacementProfile.create({
          data: {
            studentId: row.studentId,
            isProfileComplete: false,
            placementStatus: 'UNPLACED'
          }
        });
      } else {
        await tx.studentPlacementProfile.update({
          where: { studentId: row.studentId },
          data: {
            isProfileComplete: Boolean(profile.resumePath) && row.cgpa != null
          }
        });
      }
    }
  });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.BULK_PLACEMENT_PROFILE_IMPORT,
    entityType: 'Student',
    entityId: null,
    newValue: { count: data.length },
    ipAddress: req?.ip || null,
    apiRoute: req?.originalUrl || null,
    httpMethod: req?.method || null
  });

  return { updatedCount: data.length };
}

const companyRowSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  website: z.string().optional().nullable(),
  hrContactEmail: z.string().email().optional().nullable().or(z.literal(''))
});

export async function validateCompanyData(rows) {
  const errors = [];
  const validRowsData = [];

  const existing = await prisma.company.findMany({ select: { code: true } });
  const dbCodes = new Set(existing.filter((c) => c.code).map((c) => c.code.toLowerCase()));
  const fileCodes = new Map();

  for (const row of rows) {
    const rowNum = row._rowNumber;
    const parsed = companyRowSchema.safeParse({
      ...row,
      code: row.code || null,
      website: row.website || null,
      hrContactEmail: row.hrContactEmail || null
    });
    if (!parsed.success) {
      parsed.error.errors.forEach((err) => {
        errors.push({
          row: rowNum,
          column: err.path[0],
          code: 'VALIDATION_FAILED',
          message: err.message
        });
      });
      continue;
    }

    const data = parsed.data;
    if (data.code) {
      const norm = data.code.toLowerCase();
      if (fileCodes.has(norm)) {
        errors.push({
          row: rowNum,
          column: 'code',
          code: 'DUPLICATE_IN_FILE',
          message: `Duplicate code also on row ${fileCodes.get(norm)}`
        });
      } else {
        fileCodes.set(norm, rowNum);
      }
      if (dbCodes.has(norm)) {
        errors.push({
          row: rowNum,
          column: 'code',
          code: 'DUPLICATE_IN_DATABASE',
          message: `Company code "${data.code}" already exists.`
        });
      }
    }

    if (!errors.some((e) => e.row === rowNum)) {
      validRowsData.push({
        name: data.name,
        code: data.code || null,
        industry: data.industry || null,
        website: data.website || null,
        hrContactEmail: data.hrContactEmail || null
      });
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalRows: rows.length,
      validRows: validRowsData.length,
      invalidRows: errors.length === 0 ? 0 : rows.length - validRowsData.length
    },
    errors,
    data: validRowsData
  };
}

export async function importCompaniesConfirmed(data, actor, req) {
  await prisma.company.createMany({
    data: data.map((d) => ({
      name: d.name,
      code: d.code,
      industry: d.industry,
      website: d.website,
      hrContactEmail: d.hrContactEmail,
      isActive: true
    }))
  });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.BULK_COMPANY_IMPORT,
    entityType: 'Company',
    entityId: null,
    newValue: { count: data.length },
    ipAddress: req?.ip || null,
    apiRoute: req?.originalUrl || null,
    httpMethod: req?.method || null
  });

  return { createdCount: data.length };
}

const offerRowSchema = z.object({
  rollNo: z.string().min(1),
  companyCode: z.string().min(1),
  driveTitle: z.string().min(1),
  ctc: z.coerce.number().positive(),
  status: z.enum(['OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED']).default('OFFERED')
});

export async function validateOfferImportData(rows) {
  const errors = [];
  const validRowsData = [];

  const students = await prisma.student.findMany({ select: { id: true, rollNo: true } });
  const rollMap = new Map(students.map((s) => [s.rollNo.toLowerCase(), s]));
  const companies = await prisma.company.findMany({ select: { id: true, code: true } });
  const companyMap = new Map(
    companies.filter((c) => c.code).map((c) => [c.code.toLowerCase(), c])
  );
  const drives = await prisma.placementDrive.findMany({
    select: { id: true, title: true, companyId: true }
  });

  for (const row of rows) {
    const rowNum = row._rowNumber;
    const parsed = offerRowSchema.safeParse(row);
    if (!parsed.success) {
      parsed.error.errors.forEach((err) => {
        errors.push({
          row: rowNum,
          column: err.path[0],
          code: 'VALIDATION_FAILED',
          message: err.message
        });
      });
      continue;
    }

    const { rollNo, companyCode, driveTitle, ctc, status } = parsed.data;
    const student = rollMap.get(rollNo.toLowerCase());
    if (!student) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'UNKNOWN_STUDENT',
        message: `Student "${rollNo}" not found.`
      });
      continue;
    }
    const company = companyMap.get(companyCode.toLowerCase());
    if (!company) {
      errors.push({
        row: rowNum,
        column: 'companyCode',
        code: 'UNKNOWN_COMPANY',
        message: `Company code "${companyCode}" not found.`
      });
      continue;
    }
    const drive = drives.find(
      (d) =>
        d.companyId === company.id &&
        d.title.toLowerCase() === driveTitle.toLowerCase()
    );
    if (!drive) {
      errors.push({
        row: rowNum,
        column: 'driveTitle',
        code: 'UNKNOWN_DRIVE',
        message: `Drive "${driveTitle}" not found for company ${companyCode}.`
      });
      continue;
    }

    const application = await prisma.placementApplication.findUnique({
      where: {
        driveId_studentId: { driveId: drive.id, studentId: student.id }
      },
      include: { offer: true }
    });
    if (!application) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'NO_APPLICATION',
        message: `Student has no application for drive "${driveTitle}".`
      });
      continue;
    }
    if (application.offer) {
      errors.push({
        row: rowNum,
        column: 'rollNo',
        code: 'OFFER_EXISTS',
        message: 'An offer already exists for this application.'
      });
      continue;
    }

    if (!errors.some((e) => e.row === rowNum)) {
      validRowsData.push({
        applicationId: application.id,
        driveId: drive.id,
        studentId: student.id,
        companyId: company.id,
        ctc,
        status,
        rollNo: student.rollNo,
        driveTitle: drive.title,
        companyCode
      });
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalRows: rows.length,
      validRows: validRowsData.length,
      invalidRows: errors.length === 0 ? 0 : rows.length - validRowsData.length
    },
    errors,
    data: validRowsData
  };
}

export async function importOffersConfirmed(data, actor, req) {
  await prisma.$transaction(async (tx) => {
    for (const row of data) {
      if (row.status === 'ACCEPTED' || row.status === 'OFFERED') {
        await tx.placementApplication.update({
          where: { id: row.applicationId },
          data: { stage: 'SELECTED' }
        });
      }
      await tx.placementOffer.create({
        data: {
          applicationId: row.applicationId,
          driveId: row.driveId,
          studentId: row.studentId,
          companyId: row.companyId,
          ctc: row.ctc,
          status: row.status,
          respondedAt: row.status !== 'OFFERED' ? new Date() : null
        }
      });
      if (row.status === 'ACCEPTED') {
        const profile = await tx.studentPlacementProfile.findUnique({
          where: { studentId: row.studentId }
        });
        if (!profile) {
          await tx.studentPlacementProfile.create({
            data: { studentId: row.studentId, placementStatus: 'PLACED' }
          });
        } else {
          await tx.studentPlacementProfile.update({
            where: { studentId: row.studentId },
            data: { placementStatus: 'PLACED' }
          });
        }
      }
    }
  });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.BULK_OFFER_IMPORT,
    entityType: 'PlacementOffer',
    entityId: null,
    newValue: { count: data.length },
    ipAddress: req?.ip || null,
    apiRoute: req?.originalUrl || null,
    httpMethod: req?.method || null
  });

  return { createdCount: data.length };
}
