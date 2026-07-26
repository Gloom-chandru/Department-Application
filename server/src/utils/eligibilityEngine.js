/**
 * Phase 10 — Placement eligibility engine (pure functions).
 * Never derives CGPA from marks; uses Student.cgpa + currentBacklogs only.
 */

export const APPLICATION_STAGES = [
  'APPLIED',
  'SHORTLISTED',
  'APTITUDE',
  'TECHNICAL',
  'HR',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN'
];

/** Allowed admin/student stage transitions: from → Set of to */
export const STAGE_TRANSITIONS = {
  APPLIED: new Set(['SHORTLISTED', 'APTITUDE', 'TECHNICAL', 'HR', 'REJECTED', 'WITHDRAWN']),
  SHORTLISTED: new Set(['APTITUDE', 'TECHNICAL', 'HR', 'REJECTED', 'WITHDRAWN']),
  APTITUDE: new Set(['TECHNICAL', 'HR', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN']),
  TECHNICAL: new Set(['HR', 'REJECTED', 'WITHDRAWN']),
  HR: new Set(['SELECTED', 'REJECTED', 'WITHDRAWN']),
  SELECTED: new Set([]),
  REJECTED: new Set([]),
  WITHDRAWN: new Set([])
};

/** Student may only withdraw from these non-terminal stages */
export const STUDENT_WITHDRAWABLE = new Set([
  'APPLIED',
  'SHORTLISTED',
  'APTITUDE',
  'TECHNICAL',
  'HR'
]);

export const isTransitionAllowed = (fromStage, toStage) => {
  const allowed = STAGE_TRANSITIONS[fromStage];
  return Boolean(allowed && allowed.has(toStage));
};

/**
 * Compute median of numeric array. Empty → null.
 */
export const computeMedian = (values) => {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

/**
 * Evaluate eligibility for one student against one drive.
 *
 * @param {object} student - { departmentId, batchYear, cgpa, currentBacklogs, placementStatus, hasResume }
 * @param {object} drive - { status, applicationDeadline, minCgpa, maxBacklogs, allowPlacedApplications,
 *                            eligibleDepartmentIds: string[], eligibleBatchYears: string[] }
 * @param {object} options - { now?: Date, alreadyApplied?: boolean, requireResumeForApply?: boolean }
 */
export const evaluateEligibility = (student, drive, options = {}) => {
  const now = options.now || new Date();
  const requireResumeForApply = options.requireResumeForApply === true;
  const reasons = [];

  const push = (code, passed, message, extra = {}) => {
    reasons.push({ code, passed, message, ...extra });
  };

  // DRIVE_STATUS
  const statusOk = drive.status === 'PUBLISHED';
  push(
    'DRIVE_STATUS',
    statusOk,
    statusOk ? 'Drive is published and open for applications' : `Drive status is ${drive.status}; must be PUBLISHED`
  );

  // DEADLINE
  const deadline = drive.applicationDeadline instanceof Date
    ? drive.applicationDeadline
    : new Date(drive.applicationDeadline);
  const deadlineOk = !Number.isNaN(deadline.getTime()) && now.getTime() <= deadline.getTime();
  push(
    'DEADLINE',
    deadlineOk,
    deadlineOk
      ? 'Application deadline has not passed'
      : `Application deadline (${deadline.toISOString()}) has passed`,
    { deadline: deadline.toISOString() }
  );

  // DEPARTMENT
  const deptIds = drive.eligibleDepartmentIds || [];
  const deptOk = deptIds.length > 0 && deptIds.includes(student.departmentId);
  push(
    'DEPARTMENT',
    deptOk,
    deptOk
      ? 'Student department is eligible'
      : deptIds.length === 0
        ? 'No departments are eligible for this drive'
        : 'Student department is not in the eligible department list',
    { studentDepartmentId: student.departmentId, eligibleDepartmentIds: deptIds }
  );

  // BATCH
  const batches = drive.eligibleBatchYears || [];
  const batchOk = batches.length > 0 && batches.includes(student.batchYear);
  push(
    'BATCH',
    batchOk,
    batchOk
      ? `Batch ${student.batchYear} is eligible`
      : batches.length === 0
        ? 'No batches are eligible for this drive'
        : `Batch ${student.batchYear} is not eligible`,
    { studentBatchYear: student.batchYear, eligibleBatchYears: batches }
  );

  // CGPA
  const minCgpa = drive.minCgpa != null ? Number(drive.minCgpa) : null;
  if (minCgpa != null) {
    const cgpaPresent = student.cgpa != null && student.cgpa !== '';
    const cgpaVal = cgpaPresent ? Number(student.cgpa) : null;
    push(
      'CGPA_PRESENT',
      cgpaPresent,
      cgpaPresent ? 'CGPA is on record' : 'CGPA is missing; required for this drive',
      { actual: cgpaVal, required: minCgpa }
    );
    const cgpaOk = cgpaPresent && cgpaVal >= minCgpa;
    push(
      'CGPA_MIN',
      cgpaOk,
      cgpaOk
        ? `CGPA ${cgpaVal} meets minimum ${minCgpa}`
        : cgpaPresent
          ? `CGPA ${cgpaVal} < required ${minCgpa}`
          : `Cannot verify CGPA against minimum ${minCgpa}`,
      { actual: cgpaVal, required: minCgpa }
    );
  } else {
    push('CGPA_MIN', true, 'No minimum CGPA required for this drive');
  }

  // BACKLOGS
  const maxBacklogs = drive.maxBacklogs != null ? Number(drive.maxBacklogs) : null;
  if (maxBacklogs != null) {
    const backlogs = Number(student.currentBacklogs ?? 0);
    const backlogOk = backlogs <= maxBacklogs;
    push(
      'BACKLOGS_MAX',
      backlogOk,
      backlogOk
        ? `Backlogs ${backlogs} ≤ allowed ${maxBacklogs}`
        : `Backlogs ${backlogs} > allowed ${maxBacklogs}`,
      { actual: backlogs, required: maxBacklogs }
    );
  } else {
    push('BACKLOGS_MAX', true, 'No backlog limit for this drive');
  }

  // ALREADY PLACED
  const isPlaced = student.placementStatus === 'PLACED';
  if (isPlaced && !drive.allowPlacedApplications) {
    push(
      'ALREADY_PLACED_POLICY',
      false,
      'Student is already placed; this drive does not allow placed applications',
      { placementStatus: student.placementStatus }
    );
  } else {
    push(
      'ALREADY_PLACED_POLICY',
      true,
      isPlaced
        ? 'Placed student is allowed to apply for this drive'
        : 'Student is not placed',
      { placementStatus: student.placementStatus || 'UNPLACED' }
    );
  }

  // ALREADY APPLIED
  if (options.alreadyApplied) {
    push('NOT_ALREADY_APPLIED', false, 'Student has already applied to this drive');
  } else {
    push('NOT_ALREADY_APPLIED', true, 'No existing application for this drive');
  }

  // RESUME (hard only when applying)
  if (requireResumeForApply) {
    const hasResume = Boolean(student.hasResume);
    push(
      'PROFILE_RESUME',
      hasResume,
      hasResume ? 'Resume is uploaded' : 'Resume is required to apply'
    );
  } else {
    push(
      'PROFILE_RESUME',
      true,
      student.hasResume ? 'Resume is on file' : 'Resume not required for eligibility listing',
      { hasResume: Boolean(student.hasResume) }
    );
  }

  const eligible = reasons.every((r) => r.passed);
  return { eligible, reasons };
};

/**
 * Build drive eligibility input shape from Prisma drive with includes.
 */
export const driveToEligibilityInput = (drive) => ({
  status: drive.status,
  applicationDeadline: drive.applicationDeadline,
  minCgpa: drive.minCgpa != null ? Number(drive.minCgpa) : null,
  maxBacklogs: drive.maxBacklogs,
  allowPlacedApplications: Boolean(drive.allowPlacedApplications),
  eligibleDepartmentIds: (drive.eligibleDepartments || []).map((d) => d.departmentId),
  eligibleBatchYears: (drive.eligibleBatches || []).map((b) => b.batchYear)
});

/**
 * Build student eligibility input from Prisma student + profile.
 */
export const studentToEligibilityInput = (student, profile = null) => ({
  departmentId: student.departmentId,
  batchYear: student.batchYear,
  cgpa: student.cgpa != null ? Number(student.cgpa) : null,
  currentBacklogs: student.currentBacklogs ?? 0,
  placementStatus: profile?.placementStatus || student.placementProfile?.placementStatus || 'UNPLACED',
  hasResume: Boolean(profile?.resumePath || student.placementProfile?.resumePath)
});
