import prisma from './db.js';

export const AUDIT_ACTIONS = {
  ATTENDANCE_CREATED: 'ATTENDANCE_CREATED',
  ATTENDANCE_UPDATED: 'ATTENDANCE_UPDATED',
  MARK_CREATED: 'MARK_CREATED',
  MARK_UPDATED: 'MARK_UPDATED',
  STUDENT_CREATED: 'STUDENT_CREATED',
  STUDENT_UPDATED: 'STUDENT_UPDATED',
  STUDENT_DELETED: 'STUDENT_DELETED',
  FACULTY_CREATED: 'FACULTY_CREATED',
  FACULTY_UPDATED: 'FACULTY_UPDATED',
  FACULTY_DELETED: 'FACULTY_DELETED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED',
  ASSIGNMENT_PUBLISHED: 'ASSIGNMENT_PUBLISHED',
  ASSIGNMENT_CLOSED: 'ASSIGNMENT_CLOSED',
  SUBMISSION_GRADED: 'SUBMISSION_GRADED',
  LEAVE_REQUEST_SUBMITTED: 'LEAVE_REQUEST_SUBMITTED',
  LEAVE_REQUEST_APPROVED: 'LEAVE_REQUEST_APPROVED',
  LEAVE_REQUEST_REJECTED: 'LEAVE_REQUEST_REJECTED',
  LEAVE_REQUEST_CANCELLED: 'LEAVE_REQUEST_CANCELLED',
  OD_REQUEST_SUBMITTED: 'OD_REQUEST_SUBMITTED',
  OD_REQUEST_APPROVED: 'OD_REQUEST_APPROVED',
  OD_REQUEST_REJECTED: 'OD_REQUEST_REJECTED',
  OD_REQUEST_CANCELLED: 'OD_REQUEST_CANCELLED',
  TIMETABLE_SCHEDULE_CREATED: 'TIMETABLE_SCHEDULE_CREATED',
  TIMETABLE_SLOT_CREATED: 'TIMETABLE_SLOT_CREATED',
  TIMETABLE_SLOT_UPDATED: 'TIMETABLE_SLOT_UPDATED',
  TIMETABLE_SLOT_DELETED: 'TIMETABLE_SLOT_DELETED',
  TIMETABLE_PUBLISHED: 'TIMETABLE_PUBLISHED',
  TIMETABLE_ARCHIVED: 'TIMETABLE_ARCHIVED'
};

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'hashedpassword',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'jwtsecret',
  'secret',
  'clientsecret',
  'apikey',
  'authorization',
  'credential',
  'databasepassword'
];

/**
 * Recursively scans and sanitizes objects, arrays, and nested structures.
 * Normalizes keys to lowercase alphanumeric strings for strict comparison.
 * Ensures credentials are redacted before logs are created.
 */
export const sanitizeForAudit = (data) => {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data.toISOString();
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForAudit(item));
  }
  
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSensitive = SENSITIVE_KEYS.includes(normalizedKey) || 
                          normalizedKey.includes('password') || 
                          normalizedKey.includes('secret') || 
                          normalizedKey.includes('token') || 
                          normalizedKey.includes('jwt') || 
                          normalizedKey.includes('apikey') ||
                          normalizedKey.includes('credential');

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForAudit(value);
      }
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Compares two objects and isolates changed fields to save DB storage.
 */
export const computeDiff = (prev, next) => {
  if (!prev || !next) return { prev, next, hasChanges: prev !== next };
  const diffPrev = {};
  const diffNew = {};
  let hasChanges = false;

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of allKeys) {
    // Skip database metadata fields that change automatically
    if (['createdAt', 'updatedAt', 'passwordHash'].includes(key)) {
      continue;
    }

    const prevVal = prev[key];
    const nextVal = next[key];

    const prevStr = prevVal instanceof Date ? prevVal.toISOString() : JSON.stringify(prevVal);
    const nextStr = nextVal instanceof Date ? nextVal.toISOString() : JSON.stringify(nextVal);

    if (prevStr !== nextStr) {
      diffPrev[key] = prevVal;
      diffNew[key] = nextVal;
      hasChanges = true;
    }
  }
  return { diffPrev, diffNew, hasChanges };
};

/**
 * Transaction-aware audit log helper.
 * If 'tx' (prisma transaction client) is provided, inserts using the transaction.
 * Errors are not caught, so any logging failure will trigger transactional rollback.
 */
export const logAudit = async ({
  actorUserId,
  actorRole,
  action,
  entityType,
  entityId,
  previousValue = null,
  newValue = null,
  req = null
}, tx = null) => {
  // Validate action constant
  if (!Object.values(AUDIT_ACTIONS).includes(action)) {
    throw new Error(`Invalid audit action: ${action}`);
  }

  const client = tx || prisma;

  // Sanitize values
  const cleanPrev = previousValue ? sanitizeForAudit(previousValue) : null;
  const cleanNew = newValue ? sanitizeForAudit(newValue) : null;

  // Normalized API Route (without query parameters)
  let apiRoute = null;
  if (req) {
    apiRoute = (req.baseUrl || '') + (req.route?.path || req.path || '');
  }

  await client.auditLog.create({
    data: {
      actorUserId,
      actorRole,
      action,
      entityType,
      entityId,
      previousValue: cleanPrev,
      newValue: cleanNew,
      ipAddress: req?.ip || null,
      apiRoute,
      httpMethod: req?.method || null
    }
  });
};
