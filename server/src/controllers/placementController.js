import { z } from 'zod';
import prisma from '../utils/db.js';
import { AUDIT_ACTIONS, logAudit, sanitizeForAudit } from '../utils/audit.js';
import {
  createNotification,
  createManyNotifications,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES
} from '../utils/notificationService.js';
import { storageAdapter } from '../utils/storageService.js';
import {
  evaluateEligibility,
  driveToEligibilityInput,
  studentToEligibilityInput,
  isTransitionAllowed,
  STUDENT_WITHDRAWABLE,
  computeMedian
} from '../utils/eligibilityEngine.js';

const batchYearRegex = /^\d{4}-\d{2,4}$/;

const paginationSchema = z.object({
  page: z.preprocess((v) => parseInt(v || '1', 10), z.number().int().positive().default(1)),
  limit: z.preprocess((v) => parseInt(v || '20', 10), z.number().int().positive().max(100).default(20))
});

const companyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  industry: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  hrContactName: z.string().max(200).optional().nullable(),
  hrContactEmail: z.string().email().optional().nullable().or(z.literal(''))
});

const companyUpdateSchema = companyCreateSchema.partial().extend({
  isActive: z.boolean().optional()
});

const driveCreateSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  location: z.string().min(1).max(200),
  jobType: z.enum(['FULL_TIME', 'INTERNSHIP']).optional().nullable(),
  packageMin: z.number().nonnegative().optional().nullable(),
  packageMax: z.number().nonnegative().optional().nullable(),
  packageCtc: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(10).optional().default('INR'),
  applicationDeadline: z.string().datetime().or(z.string().min(1)),
  driveDate: z.string().datetime().or(z.string().min(1)).optional().nullable(),
  minCgpa: z.number().min(0).max(10).optional().nullable(),
  maxBacklogs: z.number().int().min(0).optional().nullable(),
  allowPlacedApplications: z.boolean().optional().default(false),
  departmentIds: z.array(z.string().uuid()).min(1),
  batchYears: z.array(z.string().regex(batchYearRegex)).min(1)
});

const driveUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  location: z.string().min(1).max(200).optional(),
  jobType: z.enum(['FULL_TIME', 'INTERNSHIP']).optional().nullable(),
  packageMin: z.number().nonnegative().optional().nullable(),
  packageMax: z.number().nonnegative().optional().nullable(),
  packageCtc: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(10).optional(),
  applicationDeadline: z.string().datetime().or(z.string().min(1)).optional(),
  driveDate: z.string().datetime().or(z.string().min(1)).optional().nullable(),
  minCgpa: z.number().min(0).max(10).optional().nullable(),
  maxBacklogs: z.number().int().min(0).optional().nullable(),
  allowPlacedApplications: z.boolean().optional(),
  departmentIds: z.array(z.string().uuid()).min(1).optional(),
  batchYears: z.array(z.string().regex(batchYearRegex)).min(1).optional()
});

const profileUpdateSchema = z.object({
  skills: z.string().max(5000).optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable().or(z.literal('')),
  githubUrl: z.string().url().optional().nullable().or(z.literal('')),
  portfolioUrl: z.string().url().optional().nullable().or(z.literal('')),
  bio: z.string().max(5000).optional().nullable()
});

const eligibilityUpdateSchema = z.object({
  cgpa: z.number().min(0).max(10).nullable().optional(),
  currentBacklogs: z.number().int().min(0).optional()
});

const stageChangeSchema = z.object({
  toStage: z.enum([
    'APPLIED', 'SHORTLISTED', 'APTITUDE', 'TECHNICAL', 'HR', 'SELECTED', 'REJECTED', 'WITHDRAWN'
  ]),
  remarks: z.string().max(2000).optional().nullable()
});

const offerCreateSchema = z.object({
  ctc: z.number().positive(),
  ctcBreakdown: z.record(z.any()).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  roleTitle: z.string().max(200).optional().nullable(),
  respondBy: z.string().datetime().or(z.string().min(1)).optional().nullable()
});

const offerPatchSchema = z.object({
  status: z.enum(['OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED']).optional(),
  ctc: z.number().positive().optional(),
  location: z.string().max(200).optional().nullable(),
  roleTitle: z.string().max(200).optional().nullable(),
  respondBy: z.string().datetime().or(z.string().min(1)).optional().nullable()
});

const driveInclude = {
  company: true,
  eligibleDepartments: { include: { department: true } },
  eligibleBatches: true,
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { applications: true, offers: true } }
};

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const computeProfileComplete = (profile, student) => {
  const hasResume = Boolean(profile?.resumePath);
  const hasCgpa = student?.cgpa != null;
  return hasResume && hasCgpa;
};

const ensurePlacementProfile = async (studentId, tx = prisma) => {
  let profile = await tx.studentPlacementProfile.findUnique({ where: { studentId } });
  if (!profile) {
    profile = await tx.studentPlacementProfile.create({
      data: { studentId, placementStatus: 'UNPLACED', isProfileComplete: false }
    });
  }
  return profile;
};

const getAuditMeta = (req) => ({
  ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
  apiRoute: req.originalUrl,
  httpMethod: req.method
});

const serializeDrive = (drive) => ({
  ...drive,
  minCgpa: drive.minCgpa != null ? Number(drive.minCgpa) : null
});

const serializeStudentAcademic = (student) => ({
  ...student,
  cgpa: student.cgpa != null ? Number(student.cgpa) : null
});

// ─── Companies ───────────────────────────────────────────────────────────────

export const listCompanies = async (req, res) => {
  try {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Validation failed', errors: pagination.error.format() });
    }
    const { page, limit } = pagination.data;
    const search = (req.query.search || '').trim();
    const isActive = req.query.isActive;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { drives: true } } }
      })
    ]);

    return res.json({
      data: companies,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createCompany = async (req, res) => {
  try {
    const validation = companyCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const data = validation.data;
    const company = await prisma.company.create({
      data: {
        name: data.name,
        code: emptyToNull(data.code),
        website: emptyToNull(data.website),
        industry: emptyToNull(data.industry),
        description: emptyToNull(data.description),
        hrContactName: emptyToNull(data.hrContactName),
        hrContactEmail: emptyToNull(data.hrContactEmail)
      }
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.COMPANY_CREATED,
      entityType: 'Company',
      entityId: company.id,
      newValue: sanitizeForAudit(company),
      ...getAuditMeta(req)
    });

    return res.status(201).json(company);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Company code already exists.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getCompany = async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        drives: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { applications: true } } }
        }
      }
    });
    if (!company) return res.status(404).json({ message: 'Company not found.' });
    return res.json(company);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const validation = companyUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Company not found.' });

    const data = validation.data;
    const updateData = {};
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        updateData[key] = typeof data[key] === 'string' ? emptyToNull(data[key]) : data[key];
      }
    }

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: updateData
    });

    const action = data.isActive === false
      ? AUDIT_ACTIONS.COMPANY_DEACTIVATED
      : AUDIT_ACTIONS.COMPANY_UPDATED;

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action,
      entityType: 'Company',
      entityId: company.id,
      previousValue: sanitizeForAudit(existing),
      newValue: sanitizeForAudit(company),
      ...getAuditMeta(req)
    });

    return res.json(company);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Company code already exists.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deactivateCompany = async (req, res) => {
  try {
    const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Company not found.' });

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.COMPANY_DEACTIVATED,
      entityType: 'Company',
      entityId: company.id,
      previousValue: { isActive: existing.isActive },
      newValue: { isActive: false },
      ...getAuditMeta(req)
    });

    return res.json(company);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Drives (Admin) ──────────────────────────────────────────────────────────

export const listAdminDrives = async (req, res) => {
  try {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Validation failed', errors: pagination.error.format() });
    }
    const { page, limit } = pagination.data;
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.companyId) where.companyId = req.query.companyId;
    if (req.query.departmentId) {
      where.eligibleDepartments = { some: { departmentId: req.query.departmentId } };
    }
    if (req.query.batchYear) {
      where.eligibleBatches = { some: { batchYear: req.query.batchYear } };
    }

    const [total, drives] = await Promise.all([
      prisma.placementDrive.count({ where }),
      prisma.placementDrive.findMany({
        where,
        include: driveInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return res.json({
      data: drives.map(serializeDrive),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createDrive = async (req, res) => {
  try {
    const validation = driveCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const data = validation.data;

    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company || !company.isActive) {
      return res.status(400).json({ message: 'Active company not found.' });
    }

    const depts = await prisma.department.findMany({
      where: { id: { in: data.departmentIds } },
      select: { id: true }
    });
    if (depts.length !== data.departmentIds.length) {
      return res.status(400).json({ message: 'One or more departmentIds are invalid.' });
    }

    const drive = await prisma.$transaction(async (tx) => {
      const created = await tx.placementDrive.create({
        data: {
          companyId: data.companyId,
          title: data.title,
          description: data.description,
          location: data.location,
          jobType: data.jobType || null,
          packageMin: data.packageMin ?? null,
          packageMax: data.packageMax ?? null,
          packageCtc: data.packageCtc ?? null,
          currency: data.currency || 'INR',
          applicationDeadline: new Date(data.applicationDeadline),
          driveDate: data.driveDate ? new Date(data.driveDate) : null,
          minCgpa: data.minCgpa ?? null,
          maxBacklogs: data.maxBacklogs ?? null,
          allowPlacedApplications: data.allowPlacedApplications ?? false,
          status: 'DRAFT',
          createdByUserId: req.user.id,
          eligibleDepartments: {
            create: data.departmentIds.map((departmentId) => ({ departmentId }))
          },
          eligibleBatches: {
            create: data.batchYears.map((batchYear) => ({ batchYear }))
          }
        },
        include: driveInclude
      });
      return created;
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.DRIVE_CREATED,
      entityType: 'PlacementDrive',
      entityId: drive.id,
      newValue: sanitizeForAudit({ id: drive.id, title: drive.title, companyId: drive.companyId }),
      ...getAuditMeta(req)
    });

    return res.status(201).json(serializeDrive(drive));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAdminDrive = async (req, res) => {
  try {
    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: {
        ...driveInclude,
        applications: {
          select: { stage: true },
        }
      }
    });
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    const stageCounts = {};
    for (const app of drive.applications) {
      stageCounts[app.stage] = (stageCounts[app.stage] || 0) + 1;
    }
    const { applications, ...rest } = drive;
    return res.json({ ...serializeDrive(rest), stageCounts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateDrive = async (req, res) => {
  try {
    const validation = driveUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const existing = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: { eligibleDepartments: true, eligibleBatches: true }
    });
    if (!existing) return res.status(404).json({ message: 'Drive not found.' });
    if (existing.status === 'CANCELLED' || existing.status === 'CLOSED') {
      return res.status(400).json({ message: `Cannot update a ${existing.status} drive.` });
    }

    const data = validation.data;

    // Lock eligibility criteria after publish
    if (existing.status === 'PUBLISHED') {
      const lockedFields = ['minCgpa', 'maxBacklogs', 'departmentIds', 'batchYears', 'allowPlacedApplications'];
      for (const f of lockedFields) {
        if (data[f] !== undefined) {
          return res.status(400).json({
            message: `Eligibility field "${f}" is locked after publication. Close the drive or create a new one.`
          });
        }
      }
    }

    const drive = await prisma.$transaction(async (tx) => {
      const updateData = {};
      const softFields = [
        'title', 'description', 'location', 'jobType', 'packageMin', 'packageMax',
        'packageCtc', 'currency', 'applicationDeadline', 'driveDate',
        'minCgpa', 'maxBacklogs', 'allowPlacedApplications'
      ];
      for (const f of softFields) {
        if (data[f] !== undefined) {
          if (f === 'applicationDeadline' || f === 'driveDate') {
            updateData[f] = data[f] ? new Date(data[f]) : null;
          } else {
            updateData[f] = data[f];
          }
        }
      }

      if (existing.status === 'DRAFT' && data.departmentIds) {
        await tx.driveEligibleDepartment.deleteMany({ where: { driveId: existing.id } });
        await tx.driveEligibleDepartment.createMany({
          data: data.departmentIds.map((departmentId) => ({ driveId: existing.id, departmentId }))
        });
      }
      if (existing.status === 'DRAFT' && data.batchYears) {
        await tx.driveEligibleBatch.deleteMany({ where: { driveId: existing.id } });
        await tx.driveEligibleBatch.createMany({
          data: data.batchYears.map((batchYear) => ({ driveId: existing.id, batchYear }))
        });
      }

      return tx.placementDrive.update({
        where: { id: existing.id },
        data: updateData,
        include: driveInclude
      });
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.DRIVE_UPDATED,
      entityType: 'PlacementDrive',
      entityId: drive.id,
      previousValue: sanitizeForAudit({ title: existing.title, status: existing.status }),
      newValue: sanitizeForAudit({ title: drive.title, status: drive.status }),
      ...getAuditMeta(req)
    });

    return res.json(serializeDrive(drive));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const publishDrive = async (req, res) => {
  try {
    const existing = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: {
        company: true,
        eligibleDepartments: true,
        eligibleBatches: true
      }
    });
    if (!existing) return res.status(404).json({ message: 'Drive not found.' });
    if (existing.status !== 'DRAFT') {
      return res.status(409).json({ message: 'Only DRAFT drives can be published.' });
    }
    if (!existing.eligibleDepartments.length || !existing.eligibleBatches.length) {
      return res.status(400).json({ message: 'Drive must have at least one eligible department and batch.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const drive = await tx.placementDrive.update({
        where: { id: existing.id, status: 'DRAFT' },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
        include: driveInclude
      });

      // Fan-out notifications to eligible students
      const students = await tx.student.findMany({
        where: {
          departmentId: { in: existing.eligibleDepartments.map((d) => d.departmentId) },
          batchYear: { in: existing.eligibleBatches.map((b) => b.batchYear) }
        },
        include: { placementProfile: true, user: { select: { id: true } } }
      });

      const driveInput = driveToEligibilityInput({
        ...drive,
        eligibleDepartments: existing.eligibleDepartments,
        eligibleBatches: existing.eligibleBatches
      });

      const notifications = [];
      for (const student of students) {
        const elig = evaluateEligibility(
          studentToEligibilityInput(student, student.placementProfile),
          driveInput,
          { requireResumeForApply: false }
        );
        if (elig.eligible || elig.reasons.some((r) =>
          ['DEPARTMENT', 'BATCH', 'DRIVE_STATUS', 'DEADLINE'].every((c) =>
            elig.reasons.find((x) => x.code === c)?.passed
          ) && ['DEPARTMENT', 'BATCH'].includes(r.code) && r.passed
        )) {
          // Notify students in eligible dept+batch (even if CGPA incomplete) so they can update profile
          const coreOk = ['DEPARTMENT', 'BATCH', 'DRIVE_STATUS', 'DEADLINE']
            .every((c) => elig.reasons.find((x) => x.code === c)?.passed);
          if (coreOk) {
            notifications.push({
              userId: student.user.id,
              title: `New placement drive: ${drive.title}`,
              message: `${existing.company.name} is hiring for ${drive.title}. Deadline: ${new Date(drive.applicationDeadline).toLocaleString()}.`,
              type: NOTIFICATION_TYPES.PLACEMENT,
              priority: NOTIFICATION_PRIORITIES.HIGH,
              relatedEntityType: 'PlacementDrive',
              relatedEntityId: drive.id
            });
          }
        }
      }

      // Chunk notifications
      for (let i = 0; i < notifications.length; i += 200) {
        await createManyNotifications(notifications.slice(i, i + 200), tx);
      }

      return drive;
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.DRIVE_PUBLISHED,
      entityType: 'PlacementDrive',
      entityId: result.id,
      previousValue: { status: 'DRAFT' },
      newValue: { status: 'PUBLISHED' },
      ...getAuditMeta(req)
    });

    return res.json(serializeDrive(result));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const closeDrive = async (req, res) => {
  try {
    const result = await prisma.placementDrive.updateMany({
      where: { id: req.params.id, status: 'PUBLISHED' },
      data: { status: 'CLOSED', closedAt: new Date() }
    });
    if (result.count === 0) {
      return res.status(409).json({ message: 'Drive not found or not PUBLISHED.' });
    }
    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: driveInclude
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.DRIVE_CLOSED,
      entityType: 'PlacementDrive',
      entityId: drive.id,
      previousValue: { status: 'PUBLISHED' },
      newValue: { status: 'CLOSED' },
      ...getAuditMeta(req)
    });

    return res.json(serializeDrive(drive));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const cancelDrive = async (req, res) => {
  try {
    const existing = await prisma.placementDrive.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Drive not found.' });
    if (existing.status === 'CANCELLED' || existing.status === 'CLOSED') {
      return res.status(409).json({ message: `Drive is already ${existing.status}.` });
    }

    const drive = await prisma.placementDrive.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', closedAt: new Date() },
      include: driveInclude
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.DRIVE_CANCELLED,
      entityType: 'PlacementDrive',
      entityId: drive.id,
      previousValue: { status: existing.status },
      newValue: { status: 'CANCELLED' },
      ...getAuditMeta(req)
    });

    return res.json(serializeDrive(drive));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const listDriveEligibleStudents = async (req, res) => {
  try {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Validation failed', errors: pagination.error.format() });
    }
    const { page, limit } = pagination.data;

    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: { eligibleDepartments: true, eligibleBatches: true }
    });
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    const driveInput = driveToEligibilityInput(drive);
    const where = {
      departmentId: { in: drive.eligibleDepartments.map((d) => d.departmentId) },
      batchYear: { in: drive.eligibleBatches.map((b) => b.batchYear) }
    };

    const [total, students, applications] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true, code: true } },
          placementProfile: true
        },
        orderBy: { rollNo: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.placementApplication.findMany({
        where: { driveId: drive.id },
        select: { studentId: true, stage: true }
      })
    ]);

    const appMap = new Map(applications.map((a) => [a.studentId, a]));

    const data = students.map((s) => {
      const elig = evaluateEligibility(
        studentToEligibilityInput(s, s.placementProfile),
        driveInput,
        {
          alreadyApplied: appMap.has(s.id),
          requireResumeForApply: false
        }
      );
      return {
        id: s.id,
        rollNo: s.rollNo,
        name: s.user.name,
        email: s.user.email,
        batchYear: s.batchYear,
        section: s.section,
        department: s.department,
        cgpa: s.cgpa != null ? Number(s.cgpa) : null,
        currentBacklogs: s.currentBacklogs,
        placementStatus: s.placementProfile?.placementStatus || 'UNPLACED',
        applicationStage: appMap.get(s.id)?.stage || null,
        eligible: elig.eligible,
        reasons: elig.reasons
      };
    });

    return res.json({
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const listDriveApplications = async (req, res) => {
  try {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Validation failed', errors: pagination.error.format() });
    }
    const { page, limit } = pagination.data;
    const where = { driveId: req.params.id };
    if (req.query.stage) where.stage = req.query.stage;

    const drive = await prisma.placementDrive.findUnique({ where: { id: req.params.id } });
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    const [total, applications] = await Promise.all([
      prisma.placementApplication.count({ where }),
      prisma.placementApplication.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              department: { select: { id: true, name: true, code: true } },
              placementProfile: { select: { placementStatus: true, isProfileComplete: true } }
            }
          },
          offer: true,
          stageHistory: {
            orderBy: { createdAt: 'asc' },
            include: { actorUser: { select: { id: true, name: true, role: true } } }
          }
        },
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const data = applications.map((a) => ({
      ...a,
      student: {
        ...serializeStudentAcademic(a.student),
        // Admin may see cgpa; resume path withheld unless explicit download endpoint
        placementProfile: a.student.placementProfile
      }
    }));

    return res.json({
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Student profile ─────────────────────────────────────────────────────────

export const getStudentPlacementProfile = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      include: {
        department: true,
        user: { select: { id: true, name: true, email: true } },
        placementProfile: true,
        placementOffers: {
          where: { status: 'ACCEPTED' },
          include: { company: true, drive: true }
        }
      }
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const profile = await ensurePlacementProfile(student.id);
    const fresh = profile.id === student.placementProfile?.id
      ? student.placementProfile
      : await prisma.studentPlacementProfile.findUnique({ where: { studentId: student.id } });

    return res.json({
      student: serializeStudentAcademic({
        id: student.id,
        rollNo: student.rollNo,
        batchYear: student.batchYear,
        section: student.section,
        department: student.department,
        cgpa: student.cgpa,
        currentBacklogs: student.currentBacklogs,
        user: student.user
      }),
      profile: {
        ...fresh,
        hasResume: Boolean(fresh?.resumePath)
      },
      acceptedOffers: student.placementOffers
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateStudentPlacementProfile = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const data = validation.data;
    const student = await prisma.student.findUnique({ where: { id: req.user.studentId } });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const profile = await prisma.$transaction(async (tx) => {
      await ensurePlacementProfile(student.id, tx);
      const updateData = {};
      for (const key of Object.keys(data)) {
        if (data[key] !== undefined) updateData[key] = emptyToNull(data[key]);
      }
      const updated = await tx.studentPlacementProfile.update({
        where: { studentId: student.id },
        data: updateData
      });
      const complete = computeProfileComplete(updated, student);
      if (updated.isProfileComplete !== complete) {
        return tx.studentPlacementProfile.update({
          where: { studentId: student.id },
          data: { isProfileComplete: complete }
        });
      }
      return updated;
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.PLACEMENT_PROFILE_UPDATED,
      entityType: 'StudentPlacementProfile',
      entityId: profile.id,
      newValue: sanitizeForAudit({ skills: profile.skills, bio: profile.bio }),
      ...getAuditMeta(req)
    });

    return res.json({ ...profile, hasResume: Boolean(profile.resumePath) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const uploadStudentResume = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No resume file uploaded.' });
    }

    const student = await prisma.student.findUnique({ where: { id: req.user.studentId } });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const fileRef = await storageAdapter.saveFile('resumes', req.file.originalname, req.file.buffer);

    const profile = await prisma.$transaction(async (tx) => {
      const existing = await ensurePlacementProfile(student.id, tx);
      if (existing.resumePath) {
        const [cat, ...rest] = existing.resumePath.split('/');
        await storageAdapter.deleteFile(cat, rest.join('/'));
      }
      const updated = await tx.studentPlacementProfile.update({
        where: { studentId: student.id },
        data: {
          resumePath: fileRef,
          originalResumeName: req.file.originalname,
          isProfileComplete: computeProfileComplete(
            { resumePath: fileRef },
            student
          )
        }
      });
      return updated;
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.PLACEMENT_RESUME_UPLOADED,
      entityType: 'StudentPlacementProfile',
      entityId: profile.id,
      newValue: { originalResumeName: profile.originalResumeName },
      ...getAuditMeta(req)
    });

    return res.json({
      ...profile,
      hasResume: true,
      resumePath: undefined // do not expose raw path unnecessarily
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const downloadOwnResume = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const profile = await prisma.studentPlacementProfile.findUnique({
      where: { studentId: req.user.studentId }
    });
    if (!profile?.resumePath) {
      return res.status(404).json({ message: 'No resume uploaded.' });
    }
    const [category, ...rest] = profile.resumePath.split('/');
    const filePath = storageAdapter.getFilePath(category, rest.join('/'));
    if (!filePath) return res.status(404).json({ message: 'Resume file missing.' });
    return res.download(filePath, profile.originalResumeName || 'resume.pdf');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpdateStudentEligibility = async (req, res) => {
  try {
    const validation = eligibilityUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const student = await prisma.student.findUnique({ where: { id: req.params.studentId } });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const data = {};
    if (validation.data.cgpa !== undefined) data.cgpa = validation.data.cgpa;
    if (validation.data.currentBacklogs !== undefined) data.currentBacklogs = validation.data.currentBacklogs;

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.student.update({
        where: { id: student.id },
        data
      });
      const profile = await ensurePlacementProfile(student.id, tx);
      await tx.studentPlacementProfile.update({
        where: { studentId: student.id },
        data: { isProfileComplete: computeProfileComplete(profile, s) }
      });
      return s;
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.STUDENT_ELIGIBILITY_UPDATED,
      entityType: 'Student',
      entityId: student.id,
      previousValue: { cgpa: student.cgpa != null ? Number(student.cgpa) : null, currentBacklogs: student.currentBacklogs },
      newValue: { cgpa: updated.cgpa != null ? Number(updated.cgpa) : null, currentBacklogs: updated.currentBacklogs },
      ...getAuditMeta(req)
    });

    return res.json(serializeStudentAcademic(updated));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const adminGetStudentPlacement = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: true,
        placementProfile: true,
        placementApplications: {
          include: {
            drive: { include: { company: true } },
            offer: true,
            stageHistory: { orderBy: { createdAt: 'asc' } }
          },
          orderBy: { appliedAt: 'desc' }
        },
        placementOffers: {
          include: { company: true, drive: true },
          orderBy: { offeredAt: 'desc' }
        }
      }
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    return res.json(serializeStudentAcademic(student));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const adminDownloadResume = async (req, res) => {
  try {
    const profile = await prisma.studentPlacementProfile.findUnique({
      where: { studentId: req.params.studentId }
    });
    if (!profile?.resumePath) {
      return res.status(404).json({ message: 'No resume uploaded.' });
    }
    const [category, ...rest] = profile.resumePath.split('/');
    const filePath = storageAdapter.getFilePath(category, rest.join('/'));
    if (!filePath) return res.status(404).json({ message: 'Resume file missing.' });
    return res.download(filePath, profile.originalResumeName || 'resume.pdf');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Student drives & applications ───────────────────────────────────────────

export const listStudentDrives = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      include: { placementProfile: true }
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const drives = await prisma.placementDrive.findMany({
      where: { status: { in: ['PUBLISHED', 'CLOSED'] } },
      include: {
        company: true,
        eligibleDepartments: true,
        eligibleBatches: true
      },
      orderBy: { applicationDeadline: 'asc' }
    });

    const apps = await prisma.placementApplication.findMany({
      where: { studentId: student.id },
      select: { driveId: true, stage: true, id: true }
    });
    const appMap = new Map(apps.map((a) => [a.driveId, a]));

    const data = drives.map((drive) => {
      const elig = evaluateEligibility(
        studentToEligibilityInput(student, student.placementProfile),
        driveToEligibilityInput(drive),
        {
          alreadyApplied: appMap.has(drive.id),
          requireResumeForApply: false
        }
      );
      return {
        ...serializeDrive(drive),
        eligible: elig.eligible,
        reasons: elig.reasons,
        application: appMap.get(drive.id) || null
      };
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getStudentDrive = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      include: { placementProfile: true }
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: {
        company: true,
        eligibleDepartments: { include: { department: true } },
        eligibleBatches: true
      }
    });
    if (!drive || (drive.status !== 'PUBLISHED' && drive.status !== 'CLOSED')) {
      return res.status(404).json({ message: 'Drive not found.' });
    }

    const existingApp = await prisma.placementApplication.findUnique({
      where: { driveId_studentId: { driveId: drive.id, studentId: student.id } }
    });

    const elig = evaluateEligibility(
      studentToEligibilityInput(student, student.placementProfile),
      driveToEligibilityInput(drive),
      {
        alreadyApplied: Boolean(existingApp),
        requireResumeForApply: false
      }
    );

    return res.json({
      ...serializeDrive(drive),
      eligible: elig.eligible,
      reasons: elig.reasons,
      application: existingApp
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const applyToDrive = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      include: { placementProfile: true, user: { select: { id: true } } }
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.id },
      include: {
        company: true,
        eligibleDepartments: true,
        eligibleBatches: true
      }
    });
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    const existing = await prisma.placementApplication.findUnique({
      where: { driveId_studentId: { driveId: drive.id, studentId: student.id } }
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already applied to this drive.' });
    }

    const elig = evaluateEligibility(
      studentToEligibilityInput(student, student.placementProfile),
      driveToEligibilityInput(drive),
      {
        alreadyApplied: false,
        requireResumeForApply: true
      }
    );

    if (!elig.eligible) {
      return res.status(400).json({
        message: 'Not eligible to apply.',
        eligibility: elig
      });
    }

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.placementApplication.create({
        data: {
          driveId: drive.id,
          studentId: student.id,
          stage: 'APPLIED',
          eligibilitySnapshot: elig
        }
      });
      await tx.applicationStageHistory.create({
        data: {
          applicationId: app.id,
          fromStage: null,
          toStage: 'APPLIED',
          actorUserId: req.user.id,
          remarks: 'Application submitted'
        }
      });
      await createNotification({
        userId: student.user.id,
        title: 'Application submitted',
        message: `Your application for ${drive.title} at ${drive.company.name} has been submitted.`,
        type: NOTIFICATION_TYPES.PLACEMENT,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        relatedEntityType: 'PlacementApplication',
        relatedEntityId: app.id
      }, tx);
      return app;
    });

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.APPLICATION_SUBMITTED,
      entityType: 'PlacementApplication',
      entityId: application.id,
      newValue: { driveId: drive.id, studentId: student.id, stage: 'APPLIED' },
      ...getAuditMeta(req)
    });

    return res.status(201).json(application);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'You have already applied to this drive.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const listStudentApplications = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const applications = await prisma.placementApplication.findMany({
      where: { studentId: req.user.studentId },
      include: {
        drive: { include: { company: true } },
        offer: true,
        stageHistory: {
          orderBy: { createdAt: 'asc' },
          include: { actorUser: { select: { id: true, name: true, role: true } } }
        }
      },
      orderBy: { appliedAt: 'desc' }
    });
    return res.json({ data: applications });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getStudentApplication = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const application = await prisma.placementApplication.findUnique({
      where: { id: req.params.id },
      include: {
        drive: { include: { company: true } },
        offer: true,
        stageHistory: {
          orderBy: { createdAt: 'asc' },
          include: { actorUser: { select: { id: true, name: true, role: true } } }
        }
      }
    });
    if (!application || application.studentId !== req.user.studentId) {
      return res.status(404).json({ message: 'Application not found.' });
    }
    return res.json(application);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const withdrawApplication = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.placementApplication.findUnique({
        where: { id: req.params.id },
        include: { drive: { include: { company: true } }, student: { include: { user: true } } }
      });
      if (!app || app.studentId !== req.user.studentId) {
        return { error: 404, message: 'Application not found.' };
      }
      if (!STUDENT_WITHDRAWABLE.has(app.stage)) {
        return { error: 409, message: `Cannot withdraw from stage ${app.stage}.` };
      }

      const updated = await tx.placementApplication.updateMany({
        where: { id: app.id, stage: app.stage },
        data: { stage: 'WITHDRAWN', withdrawnAt: new Date() }
      });
      if (updated.count === 0) {
        return { error: 409, message: 'Application stage changed concurrently.' };
      }

      await tx.applicationStageHistory.create({
        data: {
          applicationId: app.id,
          fromStage: app.stage,
          toStage: 'WITHDRAWN',
          actorUserId: req.user.id,
          remarks: 'Withdrawn by student'
        }
      });

      await createNotification({
        userId: app.student.user.id,
        title: 'Application withdrawn',
        message: `You withdrew your application for ${app.drive.title} at ${app.drive.company.name}.`,
        type: NOTIFICATION_TYPES.PLACEMENT,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        relatedEntityType: 'PlacementApplication',
        relatedEntityId: app.id
      }, tx);

      return { app, fromStage: app.stage };
    });

    if (result.error) {
      return res.status(result.error).json({ message: result.message });
    }

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.APPLICATION_WITHDRAWN,
      entityType: 'PlacementApplication',
      entityId: result.app.id,
      previousValue: { stage: result.fromStage },
      newValue: { stage: 'WITHDRAWN' },
      ...getAuditMeta(req)
    });

    const fresh = await prisma.placementApplication.findUnique({
      where: { id: result.app.id },
      include: { drive: { include: { company: true } }, stageHistory: true }
    });
    return res.json(fresh);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Admin stage / offers ────────────────────────────────────────────────────

export const changeApplicationStage = async (req, res) => {
  try {
    const validation = stageChangeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const { toStage, remarks } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.placementApplication.findUnique({
        where: { id: req.params.id },
        include: {
          drive: { include: { company: true } },
          student: { include: { user: true } }
        }
      });
      if (!app) return { error: 404, message: 'Application not found.' };

      if (!isTransitionAllowed(app.stage, toStage)) {
        return {
          error: 409,
          message: `Illegal transition from ${app.stage} to ${toStage}.`
        };
      }

      const updated = await tx.placementApplication.updateMany({
        where: { id: app.id, stage: app.stage },
        data: {
          stage: toStage,
          withdrawnAt: toStage === 'WITHDRAWN' ? new Date() : app.withdrawnAt
        }
      });
      if (updated.count === 0) {
        return { error: 409, message: 'Concurrent stage change detected.' };
      }

      await tx.applicationStageHistory.create({
        data: {
          applicationId: app.id,
          fromStage: app.stage,
          toStage,
          actorUserId: req.user.id,
          remarks: remarks || null
        }
      });

      let priority = NOTIFICATION_PRIORITIES.HIGH;
      if (toStage === 'SELECTED') priority = NOTIFICATION_PRIORITIES.URGENT;
      if (toStage === 'REJECTED') priority = NOTIFICATION_PRIORITIES.NORMAL;

      await createNotification({
        userId: app.student.user.id,
        title: `Application update: ${toStage}`,
        message: `Your application for ${app.drive.title} at ${app.drive.company.name} is now ${toStage}.${remarks ? ` Note: ${remarks}` : ''}`,
        type: NOTIFICATION_TYPES.PLACEMENT,
        priority,
        relatedEntityType: 'PlacementApplication',
        relatedEntityId: app.id
      }, tx);

      return { app, fromStage: app.stage, toStage };
    });

    if (result.error) {
      return res.status(result.error).json({ message: result.message });
    }

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.APPLICATION_STAGE_CHANGED,
      entityType: 'PlacementApplication',
      entityId: result.app.id,
      previousValue: { stage: result.fromStage },
      newValue: { stage: result.toStage, remarks },
      ...getAuditMeta(req)
    });

    const fresh = await prisma.placementApplication.findUnique({
      where: { id: result.app.id },
      include: {
        stageHistory: { orderBy: { createdAt: 'asc' } },
        student: { include: { user: { select: { name: true, email: true } } } },
        drive: { include: { company: true } },
        offer: true
      }
    });
    return res.json(fresh);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createOffer = async (req, res) => {
  try {
    const validation = offerCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const data = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.placementApplication.findUnique({
        where: { id: req.params.id },
        include: {
          drive: { include: { company: true } },
          student: { include: { user: true } },
          offer: true
        }
      });
      if (!app) return { error: 404, message: 'Application not found.' };
      if (app.offer) return { error: 409, message: 'Offer already exists for this application.' };

      // Ensure SELECTED (atomic with offer create if needed)
      let stage = app.stage;
      if (stage !== 'SELECTED') {
        if (!isTransitionAllowed(stage, 'SELECTED')) {
          return { error: 409, message: `Cannot create offer from stage ${stage}. Move to SELECTED first or via allowed path.` };
        }
        const upd = await tx.placementApplication.updateMany({
          where: { id: app.id, stage },
          data: { stage: 'SELECTED' }
        });
        if (upd.count === 0) return { error: 409, message: 'Concurrent stage change.' };
        await tx.applicationStageHistory.create({
          data: {
            applicationId: app.id,
            fromStage: stage,
            toStage: 'SELECTED',
            actorUserId: req.user.id,
            remarks: 'Auto-selected on offer creation'
          }
        });
        stage = 'SELECTED';
      }

      const offer = await tx.placementOffer.create({
        data: {
          applicationId: app.id,
          driveId: app.driveId,
          studentId: app.studentId,
          companyId: app.drive.companyId,
          ctc: data.ctc,
          ctcBreakdown: data.ctcBreakdown || null,
          location: data.location || null,
          roleTitle: data.roleTitle || app.drive.title,
          status: 'OFFERED',
          respondBy: data.respondBy ? new Date(data.respondBy) : null
        },
        include: { company: true, drive: true }
      });

      await createNotification({
        userId: app.student.user.id,
        title: 'You have received an offer!',
        message: `${app.drive.company.name} offered you ${offer.roleTitle || app.drive.title} (CTC: ${offer.ctc}).`,
        type: NOTIFICATION_TYPES.PLACEMENT,
        priority: NOTIFICATION_PRIORITIES.URGENT,
        relatedEntityType: 'PlacementOffer',
        relatedEntityId: offer.id
      }, tx);

      return { offer };
    });

    if (result.error) {
      return res.status(result.error).json({ message: result.message });
    }

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.OFFER_CREATED,
      entityType: 'PlacementOffer',
      entityId: result.offer.id,
      newValue: sanitizeForAudit({ ctc: result.offer.ctc, status: 'OFFERED' }),
      ...getAuditMeta(req)
    });

    return res.status(201).json(result.offer);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Offer already exists for this application.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const patchOffer = async (req, res) => {
  try {
    const validation = offerPatchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }
    const existing = await prisma.placementOffer.findUnique({
      where: { id: req.params.id },
      include: { student: { include: { user: true } }, company: true }
    });
    if (!existing) return res.status(404).json({ message: 'Offer not found.' });

    const data = validation.data;
    const updateData = {};
    if (data.ctc !== undefined) updateData.ctc = data.ctc;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.roleTitle !== undefined) updateData.roleTitle = data.roleTitle;
    if (data.respondBy !== undefined) updateData.respondBy = data.respondBy ? new Date(data.respondBy) : null;

    let auditAction = AUDIT_ACTIONS.OFFER_CREATED;
    if (data.status && data.status !== existing.status) {
      updateData.status = data.status;
      updateData.respondedAt = new Date();
      if (data.status === 'REVOKED') auditAction = AUDIT_ACTIONS.OFFER_REVOKED;
      if (data.status === 'EXPIRED') auditAction = AUDIT_ACTIONS.OFFER_EXPIRED;
      if (data.status === 'DECLINED') auditAction = AUDIT_ACTIONS.OFFER_DECLINED;
      if (data.status === 'ACCEPTED') {
        return res.status(400).json({ message: 'Use student accept endpoint or dedicated admin accept flow.' });
      }
    }

    const offer = await prisma.$transaction(async (tx) => {
      const updated = await tx.placementOffer.update({
        where: { id: existing.id },
        data: updateData,
        include: { company: true, drive: true }
      });

      if (data.status === 'REVOKED' || data.status === 'EXPIRED') {
        // If this was the only accepted offer, unplace — but these statuses aren't ACCEPTED
        await createNotification({
          userId: existing.student.user.id,
          title: `Offer ${data.status.toLowerCase()}`,
          message: `Your offer from ${existing.company.name} has been marked ${data.status}.`,
          type: NOTIFICATION_TYPES.PLACEMENT,
          priority: NOTIFICATION_PRIORITIES.HIGH,
          relatedEntityType: 'PlacementOffer',
          relatedEntityId: updated.id
        }, tx);
      }
      return updated;
    });

    if (data.status === 'REVOKED' || data.status === 'EXPIRED') {
      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: auditAction,
        entityType: 'PlacementOffer',
        entityId: offer.id,
        previousValue: { status: existing.status },
        newValue: { status: offer.status },
        ...getAuditMeta(req)
      });
    }

    return res.json(offer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const listAdminOffers = async (req, res) => {
  try {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Validation failed', errors: pagination.error.format() });
    }
    const { page, limit } = pagination.data;
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.companyId) where.companyId = req.query.companyId;
    if (req.query.studentId) where.studentId = req.query.studentId;

    const [total, offers] = await Promise.all([
      prisma.placementOffer.count({ where }),
      prisma.placementOffer.findMany({
        where,
        include: {
          company: true,
          drive: true,
          student: {
            include: {
              user: { select: { name: true, email: true } },
              department: { select: { code: true, name: true } }
            }
          }
        },
        orderBy: { offeredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return res.json({
      data: offers,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Student offers ──────────────────────────────────────────────────────────

export const listStudentOffers = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }
    const offers = await prisma.placementOffer.findMany({
      where: { studentId: req.user.studentId },
      include: { company: true, drive: true },
      orderBy: { offeredAt: 'desc' }
    });
    return res.json({ data: offers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const acceptOffer = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.placementOffer.findUnique({
        where: { id: req.params.id },
        include: { company: true, drive: true, student: { include: { user: true } } }
      });
      if (!offer || offer.studentId !== req.user.studentId) {
        return { error: 404, message: 'Offer not found.' };
      }
      if (offer.status !== 'OFFERED') {
        return { error: 409, message: `Offer is ${offer.status}; only OFFERED can be accepted.` };
      }

      // Atomic: accept this offer
      const accepted = await tx.placementOffer.updateMany({
        where: { id: offer.id, status: 'OFFERED' },
        data: { status: 'ACCEPTED', respondedAt: new Date() }
      });
      if (accepted.count === 0) {
        return { error: 409, message: 'Offer was already processed.' };
      }

      // Decline all other OFFERED offers for this student
      const siblings = await tx.placementOffer.findMany({
        where: {
          studentId: offer.studentId,
          status: 'OFFERED',
          id: { not: offer.id }
        }
      });
      if (siblings.length) {
        await tx.placementOffer.updateMany({
          where: {
            studentId: offer.studentId,
            status: 'OFFERED',
            id: { not: offer.id }
          },
          data: { status: 'DECLINED', respondedAt: new Date() }
        });
      }

      // Ensure only one ACCEPTED — if somehow another ACCEPTED exists, fail
      const otherAccepted = await tx.placementOffer.count({
        where: {
          studentId: offer.studentId,
          status: 'ACCEPTED',
          id: { not: offer.id }
        }
      });
      if (otherAccepted > 0) {
        throw new Error('CONFLICT_MULTI_ACCEPTED');
      }

      await ensurePlacementProfile(offer.studentId, tx);
      await tx.studentPlacementProfile.update({
        where: { studentId: offer.studentId },
        data: { placementStatus: 'PLACED' }
      });

      await createNotification({
        userId: offer.student.user.id,
        title: 'Offer accepted',
        message: `You accepted the offer from ${offer.company.name} (${offer.roleTitle || offer.drive.title}). Other pending offers were declined.`,
        type: NOTIFICATION_TYPES.PLACEMENT,
        priority: NOTIFICATION_PRIORITIES.HIGH,
        relatedEntityType: 'PlacementOffer',
        relatedEntityId: offer.id
      }, tx);

      return { offer, declinedCount: siblings.length };
    });

    if (result.error) {
      return res.status(result.error).json({ message: result.message });
    }

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.OFFER_ACCEPTED,
      entityType: 'PlacementOffer',
      entityId: result.offer.id,
      newValue: { status: 'ACCEPTED', declinedSiblings: result.declinedCount },
      ...getAuditMeta(req)
    });

    const fresh = await prisma.placementOffer.findUnique({
      where: { id: result.offer.id },
      include: { company: true, drive: true }
    });
    return res.json(fresh);
  } catch (error) {
    if (error.message === 'CONFLICT_MULTI_ACCEPTED') {
      return res.status(409).json({ message: 'Another accepted offer already exists.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const declineOffer = async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ message: 'Student profile required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.placementOffer.findUnique({
        where: { id: req.params.id },
        include: { company: true, student: { include: { user: true } } }
      });
      if (!offer || offer.studentId !== req.user.studentId) {
        return { error: 404, message: 'Offer not found.' };
      }
      if (offer.status !== 'OFFERED') {
        return { error: 409, message: `Offer is ${offer.status}; only OFFERED can be declined.` };
      }

      const updated = await tx.placementOffer.updateMany({
        where: { id: offer.id, status: 'OFFERED' },
        data: { status: 'DECLINED', respondedAt: new Date() }
      });
      if (updated.count === 0) {
        return { error: 409, message: 'Offer was already processed.' };
      }

      await createNotification({
        userId: offer.student.user.id,
        title: 'Offer declined',
        message: `You declined the offer from ${offer.company.name}.`,
        type: NOTIFICATION_TYPES.PLACEMENT,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        relatedEntityType: 'PlacementOffer',
        relatedEntityId: offer.id
      }, tx);

      return { offer };
    });

    if (result.error) {
      return res.status(result.error).json({ message: result.message });
    }

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.OFFER_DECLINED,
      entityType: 'PlacementOffer',
      entityId: result.offer.id,
      newValue: { status: 'DECLINED' },
      ...getAuditMeta(req)
    });

    const fresh = await prisma.placementOffer.findUnique({
      where: { id: result.offer.id },
      include: { company: true, drive: true }
    });
    return res.json(fresh);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Faculty read-only ───────────────────────────────────────────────────────

export const listFacultyDrives = async (req, res) => {
  try {
    if (!req.user.facultyId) {
      return res.status(403).json({ message: 'Faculty profile required.' });
    }
    const faculty = await prisma.faculty.findUnique({ where: { id: req.user.facultyId } });
    if (!faculty) return res.status(403).json({ message: 'Faculty not found.' });

    const drives = await prisma.placementDrive.findMany({
      where: {
        status: { in: ['PUBLISHED', 'CLOSED'] },
        eligibleDepartments: { some: { departmentId: faculty.departmentId } }
      },
      include: {
        company: { select: { id: true, name: true, industry: true } },
        eligibleBatches: true,
        _count: { select: { applications: true } }
      },
      orderBy: { applicationDeadline: 'asc' }
    });

    // Aggregated counts only — no individual CTC
    const data = [];
    for (const drive of drives) {
      const stageGroups = await prisma.placementApplication.groupBy({
        by: ['stage'],
        where: {
          driveId: drive.id,
          student: { departmentId: faculty.departmentId }
        },
        _count: true
      });
      const stageCounts = {};
      for (const g of stageGroups) stageCounts[g.stage] = g._count;
      data.push({
        id: drive.id,
        title: drive.title,
        location: drive.location,
        status: drive.status,
        applicationDeadline: drive.applicationDeadline,
        company: drive.company,
        eligibleBatches: drive.eligibleBatches,
        applicationCount: drive._count.applications,
        stageCounts
      });
    }

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getFacultyDriveSummary = async (req, res) => {
  try {
    if (!req.user.facultyId) {
      return res.status(403).json({ message: 'Faculty profile required.' });
    }
    const faculty = await prisma.faculty.findUnique({ where: { id: req.user.facultyId } });
    if (!faculty) return res.status(403).json({ message: 'Faculty not found.' });

    const drive = await prisma.placementDrive.findFirst({
      where: {
        id: req.params.id,
        eligibleDepartments: { some: { departmentId: faculty.departmentId } }
      },
      include: {
        company: { select: { id: true, name: true, industry: true } },
        eligibleBatches: true
      }
    });
    if (!drive) return res.status(404).json({ message: 'Drive not found or not in your department.' });

    const [applied, selected, deptStudents] = await Promise.all([
      prisma.placementApplication.count({
        where: { driveId: drive.id, student: { departmentId: faculty.departmentId } }
      }),
      prisma.placementApplication.count({
        where: {
          driveId: drive.id,
          stage: 'SELECTED',
          student: { departmentId: faculty.departmentId }
        }
      }),
      prisma.student.count({
        where: {
          departmentId: faculty.departmentId,
          batchYear: { in: drive.eligibleBatches.map((b) => b.batchYear) }
        }
      })
    ]);

    return res.json({
      id: drive.id,
      title: drive.title,
      status: drive.status,
      company: drive.company,
      eligibleBatches: drive.eligibleBatches,
      counts: { cohort: deptStudents, applied, selected }
      // Intentionally no package/CTC fields for faculty
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const listFacultyPlacementStudents = async (req, res) => {
  try {
    if (!req.user.facultyId) {
      return res.status(403).json({ message: 'Faculty profile required.' });
    }
    const faculty = await prisma.faculty.findUnique({ where: { id: req.user.facultyId } });
    if (!faculty) return res.status(403).json({ message: 'Faculty not found.' });

    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Validation failed', errors: pagination.error.format() });
    }
    const { page, limit } = pagination.data;
    const where = { departmentId: faculty.departmentId };
    if (req.query.batchYear) where.batchYear = req.query.batchYear;
    if (req.query.section) where.section = req.query.section;

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          placementProfile: { select: { placementStatus: true, isProfileComplete: true } },
          _count: { select: { placementApplications: true, placementOffers: true } }
        },
        orderBy: { rollNo: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    // No resume paths, no individual CTC
    const data = students.map((s) => ({
      id: s.id,
      rollNo: s.rollNo,
      name: s.user.name,
      email: s.user.email,
      batchYear: s.batchYear,
      section: s.section,
      cgpa: s.cgpa != null ? Number(s.cgpa) : null,
      currentBacklogs: s.currentBacklogs,
      placementStatus: s.placementProfile?.placementStatus || 'UNPLACED',
      isProfileComplete: s.placementProfile?.isProfileComplete || false,
      applicationCount: s._count.placementApplications,
      offerCount: s._count.placementOffers
    }));

    return res.json({
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getAdminAnalyticsSummary = async (req, res) => {
  try {
    const { departmentId, batchYear, section } = req.query;
    const studentWhere = {};
    if (departmentId) studentWhere.departmentId = departmentId;
    if (batchYear) studentWhere.batchYear = batchYear;
    if (section) studentWhere.section = section;

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        placementProfile: { select: { placementStatus: true } }
      }
    });
    const studentIds = students.map((s) => s.id);
    const N = students.length;
    const placed = students.filter((s) => s.placementProfile?.placementStatus === 'PLACED').length;

    const [applications, selectedApps, offers] = await Promise.all([
      prisma.placementApplication.count({
        where: studentIds.length ? { studentId: { in: studentIds } } : { studentId: 'none' }
      }),
      prisma.placementApplication.count({
        where: {
          stage: 'SELECTED',
          ...(studentIds.length ? { studentId: { in: studentIds } } : { studentId: 'none' })
        }
      }),
      prisma.placementOffer.findMany({
        where: studentIds.length ? { studentId: { in: studentIds } } : { studentId: 'none' },
        select: { status: true, ctc: true }
      })
    ]);

    const uniqueApplicants = studentIds.length
      ? (
          await prisma.placementApplication.groupBy({
            by: ['studentId'],
            where: { studentId: { in: studentIds } }
          })
        ).length
      : 0;

    const offerCounts = { OFFERED: 0, ACCEPTED: 0, DECLINED: 0, EXPIRED: 0, REVOKED: 0 };
    for (const o of offers) offerCounts[o.status] = (offerCounts[o.status] || 0) + 1;

    const acceptedCtcs = offers.filter((o) => o.status === 'ACCEPTED').map((o) => o.ctc);

    return res.json({
      cohortSize: N,
      placed,
      unplaced: N - placed,
      placementPercent: N === 0 ? 0 : Math.round((placed / N) * 10000) / 100,
      applications,
      uniqueApplicants,
      selectedApplications: selectedApps,
      offerCounts,
      packageStats: {
        count: acceptedCtcs.length,
        min: acceptedCtcs.length ? Math.min(...acceptedCtcs) : null,
        max: acceptedCtcs.length ? Math.max(...acceptedCtcs) : null,
        avg: acceptedCtcs.length
          ? Math.round((acceptedCtcs.reduce((a, b) => a + b, 0) / acceptedCtcs.length) * 100) / 100
          : null,
        median: computeMedian(acceptedCtcs)
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAnalyticsByCompany = async (req, res) => {
  try {
    const selected = await prisma.placementApplication.groupBy({
      by: ['driveId'],
      where: { stage: 'SELECTED' },
      _count: true
    });
    const driveIds = selected.map((s) => s.driveId);
    const drives = driveIds.length
      ? await prisma.placementDrive.findMany({
          where: { id: { in: driveIds } },
          include: { company: true }
        })
      : [];
    const driveMap = new Map(drives.map((d) => [d.id, d]));

    const acceptedOffers = await prisma.placementOffer.groupBy({
      by: ['companyId'],
      where: { status: 'ACCEPTED' },
      _count: true,
      _avg: { ctc: true },
      _min: { ctc: true },
      _max: { ctc: true }
    });

    const companyMap = new Map();
    for (const row of selected) {
      const drive = driveMap.get(row.driveId);
      if (!drive) continue;
      const cid = drive.companyId;
      if (!companyMap.has(cid)) {
        companyMap.set(cid, {
          companyId: cid,
          companyName: drive.company.name,
          selectedApplications: 0,
          acceptedOffers: 0,
          avgCtc: null,
          minCtc: null,
          maxCtc: null
        });
      }
      companyMap.get(cid).selectedApplications += row._count;
    }

    const companies = await prisma.company.findMany({
      where: { id: { in: acceptedOffers.map((o) => o.companyId) } }
    });
    const cName = new Map(companies.map((c) => [c.id, c.name]));
    for (const o of acceptedOffers) {
      if (!companyMap.has(o.companyId)) {
        companyMap.set(o.companyId, {
          companyId: o.companyId,
          companyName: cName.get(o.companyId) || 'Unknown',
          selectedApplications: 0,
          acceptedOffers: 0,
          avgCtc: null,
          minCtc: null,
          maxCtc: null
        });
      }
      const entry = companyMap.get(o.companyId);
      entry.acceptedOffers = o._count;
      entry.avgCtc = o._avg.ctc;
      entry.minCtc = o._min.ctc;
      entry.maxCtc = o._max.ctc;
    }

    return res.json({ data: Array.from(companyMap.values()) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAnalyticsByDepartment = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        students: {
          select: {
            id: true,
            placementProfile: { select: { placementStatus: true } }
          }
        }
      }
    });

    const data = [];
    for (const dept of departments) {
      const N = dept.students.length;
      const placed = dept.students.filter((s) => s.placementProfile?.placementStatus === 'PLACED').length;
      const ids = dept.students.map((s) => s.id);
      const accepted = ids.length
        ? await prisma.placementOffer.findMany({
            where: { studentId: { in: ids }, status: 'ACCEPTED' },
            select: { ctc: true }
          })
        : [];
      const ctcs = accepted.map((o) => o.ctc);
      data.push({
        departmentId: dept.id,
        code: dept.code,
        name: dept.name,
        cohortSize: N,
        placed,
        placementPercent: N === 0 ? 0 : Math.round((placed / N) * 10000) / 100,
        avgCtc: ctcs.length
          ? Math.round((ctcs.reduce((a, b) => a + b, 0) / ctcs.length) * 100) / 100
          : null,
        medianCtc: computeMedian(ctcs)
      });
    }
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAnalyticsByBatch = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      select: {
        id: true,
        batchYear: true,
        departmentId: true,
        placementProfile: { select: { placementStatus: true } }
      }
    });

    const groups = new Map();
    for (const s of students) {
      const key = s.batchYear;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    const data = [];
    for (const [batchYear, cohort] of groups.entries()) {
      const N = cohort.length;
      const placed = cohort.filter((s) => s.placementProfile?.placementStatus === 'PLACED').length;
      const ids = cohort.map((s) => s.id);
      const accepted = await prisma.placementOffer.findMany({
        where: { studentId: { in: ids }, status: 'ACCEPTED' },
        select: { ctc: true }
      });
      const ctcs = accepted.map((o) => o.ctc);
      data.push({
        batchYear,
        cohortSize: N,
        placed,
        placementPercent: N === 0 ? 0 : Math.round((placed / N) * 10000) / 100,
        avgCtc: ctcs.length
          ? Math.round((ctcs.reduce((a, b) => a + b, 0) / ctcs.length) * 100) / 100
          : null,
        medianCtc: computeMedian(ctcs)
      });
    }
    data.sort((a, b) => a.batchYear.localeCompare(b.batchYear));
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAnalyticsPackages = async (req, res) => {
  try {
    const offers = await prisma.placementOffer.findMany({
      where: { status: 'ACCEPTED' },
      select: { ctc: true, companyId: true, studentId: true }
    });
    const ctcs = offers.map((o) => o.ctc);
    const allOffers = await prisma.placementOffer.groupBy({
      by: ['status'],
      _count: true
    });
    const offerCounts = {};
    for (const g of allOffers) offerCounts[g.status] = g._count;

    return res.json({
      acceptedCount: ctcs.length,
      min: ctcs.length ? Math.min(...ctcs) : null,
      max: ctcs.length ? Math.max(...ctcs) : null,
      avg: ctcs.length
        ? Math.round((ctcs.reduce((a, b) => a + b, 0) / ctcs.length) * 100) / 100
        : null,
      median: computeMedian(ctcs),
      lowest: ctcs.length ? Math.min(...ctcs) : null,
      highest: ctcs.length ? Math.max(...ctcs) : null,
      offerCounts
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};
