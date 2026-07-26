import prisma from '../utils/db.js';
import { generateWorkbook, generateCsv } from '../utils/excelService.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';

export async function exportPlacementApplications({ departmentId, batchYear, stage, format = 'xlsx' }, actor, req) {
  const where = {};
  if (stage) where.stage = stage;
  if (departmentId || batchYear) {
    where.student = {};
    if (departmentId) where.student.departmentId = departmentId;
    if (batchYear) where.student.batchYear = batchYear;
  }

  const apps = await prisma.placementApplication.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          department: { select: { code: true } }
        }
      },
      drive: { include: { company: true } }
    },
    orderBy: { appliedAt: 'desc' }
  });

  const columns = [
    { header: 'Roll No', key: 'rollNo', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Department', key: 'department', width: 12 },
    { header: 'Batch', key: 'batchYear', width: 12 },
    { header: 'Company', key: 'company', width: 20 },
    { header: 'Role', key: 'role', width: 22 },
    { header: 'Stage', key: 'stage', width: 14 },
    { header: 'Applied At', key: 'appliedAt', width: 20 }
  ];

  const rows = apps.map((a) => ({
    rollNo: a.student.rollNo,
    name: a.student.user.name,
    department: a.student.department.code,
    batchYear: a.student.batchYear,
    company: a.drive.company.name,
    role: a.drive.title,
    stage: a.stage,
    appliedAt: a.appliedAt.toISOString()
  }));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.PLACEMENT_APPLICATIONS_EXPORTED,
    entityType: 'PlacementApplication',
    entityId: null,
    newValue: { count: rows.length },
    ipAddress: req?.ip || null,
    apiRoute: req?.originalUrl || null,
    httpMethod: req?.method || null
  });

  if (format === 'csv') {
    return {
      buffer: generateCsv({ columns, rows }),
      contentType: 'text/csv',
      filename: 'placement_applications.csv'
    };
  }
  const buffer = await generateWorkbook({
    title: 'Placement Applications',
    subtitle: `Exported ${rows.length} applications`,
    columns,
    rows
  });
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'placement_applications.xlsx'
  };
}

export async function exportPlacementOffers({ departmentId, batchYear, status, format = 'xlsx' }, actor, req) {
  const where = {};
  if (status) where.status = status;
  if (departmentId || batchYear) {
    where.student = {};
    if (departmentId) where.student.departmentId = departmentId;
    if (batchYear) where.student.batchYear = batchYear;
  }

  const offers = await prisma.placementOffer.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          department: { select: { code: true } }
        }
      },
      company: true,
      drive: true
    },
    orderBy: { offeredAt: 'desc' }
  });

  const columns = [
    { header: 'Roll No', key: 'rollNo', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Department', key: 'department', width: 12 },
    { header: 'Batch', key: 'batchYear', width: 12 },
    { header: 'Company', key: 'company', width: 20 },
    { header: 'Role', key: 'role', width: 22 },
    { header: 'CTC', key: 'ctc', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Offered At', key: 'offeredAt', width: 20 }
  ];

  const rows = offers.map((o) => ({
    rollNo: o.student.rollNo,
    name: o.student.user.name,
    department: o.student.department.code,
    batchYear: o.student.batchYear,
    company: o.company.name,
    role: o.roleTitle || o.drive.title,
    ctc: o.ctc,
    status: o.status,
    offeredAt: o.offeredAt.toISOString()
  }));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.PLACEMENT_OFFERS_EXPORTED,
    entityType: 'PlacementOffer',
    entityId: null,
    newValue: { count: rows.length },
    ipAddress: req?.ip || null,
    apiRoute: req?.originalUrl || null,
    httpMethod: req?.method || null
  });

  if (format === 'csv') {
    return {
      buffer: generateCsv({ columns, rows }),
      contentType: 'text/csv',
      filename: 'placement_offers.csv'
    };
  }
  const buffer = await generateWorkbook({
    title: 'Placement Offers',
    subtitle: `Exported ${rows.length} offers`,
    columns,
    rows
  });
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'placement_offers.xlsx'
  };
}

export async function exportPlacementRoster({ departmentId, batchYear, format = 'xlsx' }, actor, req) {
  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (batchYear) where.batchYear = batchYear;

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { name: true } },
      department: { select: { code: true } },
      placementProfile: true,
      placementOffers: {
        where: { status: 'ACCEPTED' },
        include: { company: true },
        take: 1
      }
    },
    orderBy: { rollNo: 'asc' }
  });

  const columns = [
    { header: 'Roll No', key: 'rollNo', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Department', key: 'department', width: 12 },
    { header: 'Batch', key: 'batchYear', width: 12 },
    { header: 'CGPA', key: 'cgpa', width: 10 },
    { header: 'Backlogs', key: 'backlogs', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Accepted Company', key: 'company', width: 20 },
    { header: 'Accepted CTC', key: 'ctc', width: 14 }
  ];

  const rows = students.map((s) => {
    const accepted = s.placementOffers[0];
    return {
      rollNo: s.rollNo,
      name: s.user.name,
      department: s.department.code,
      batchYear: s.batchYear,
      cgpa: s.cgpa != null ? Number(s.cgpa) : '',
      backlogs: s.currentBacklogs,
      status: s.placementProfile?.placementStatus || 'UNPLACED',
      company: accepted?.company?.name || '',
      ctc: accepted?.ctc ?? ''
    };
  });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.PLACEMENT_ROSTER_EXPORTED,
    entityType: 'Student',
    entityId: null,
    newValue: { count: rows.length },
    ipAddress: req?.ip || null,
    apiRoute: req?.originalUrl || null,
    httpMethod: req?.method || null
  });

  if (format === 'csv') {
    return {
      buffer: generateCsv({ columns, rows }),
      contentType: 'text/csv',
      filename: 'placement_roster.csv'
    };
  }
  const buffer = await generateWorkbook({
    title: 'Placement Roster',
    subtitle: `Exported ${rows.length} students`,
    columns,
    rows
  });
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'placement_roster.xlsx'
  };
}
