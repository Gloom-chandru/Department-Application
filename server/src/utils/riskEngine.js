import prisma from './db.js';
import { 
  calculateAttendancePercentage, 
  calculateClassesNeededForTarget, 
  normalizeMarkPercentage 
} from './analyticsMath.js';
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from './notificationService.js';
import { logAudit, AUDIT_ACTIONS } from './audit.js';

export const RISK_VERSION = 'v1';

export const BASE_WEIGHTS = {
  attendance: 40,
  marks: 35,
  assignment: 20,
  progression: 5,
};

/**
 * Classifies a risk score into LOW, MEDIUM, or HIGH.
 */
export const classifyRiskLevel = (score) => {
  if (score >= 65) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
};

/**
 * Classifies data completeness into confidence level.
 */
export const classifyConfidenceLevel = (completenessPct) => {
  if (completenessPct >= 75) return 'HIGH';
  if (completenessPct >= 50) return 'MEDIUM';
  return 'LOW';
};

/**
 * Helper to calculate attendance risk for a student.
 */
export const computeAttendanceRisk = (attendanceRecords, subjects, threshold = 75) => {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return { available: false, score: 0, factors: [], recommendations: [], overallPct: null };
  }

  // Group by subject
  const subjectMap = {};
  let totalPresent = 0;
  let totalClasses = attendanceRecords.length;

  attendanceRecords.forEach((att) => {
    if (!subjectMap[att.subjectId]) {
      subjectMap[att.subjectId] = { present: 0, total: 0 };
    }
    subjectMap[att.subjectId].total += 1;
    if (att.status === 'PRESENT') {
      subjectMap[att.subjectId].present += 1;
      totalPresent += 1;
    }
  });

  const overallPct = calculateAttendancePercentage(totalPresent, totalClasses);
  if (overallPct === null) {
    return { available: false, score: 0, factors: [], recommendations: [], overallPct: null };
  }

  // Base score from overall percentage
  let score = 0;
  if (overallPct >= 85) {
    score = 0;
  } else if (overallPct >= 75) {
    score = 25 * ((85 - overallPct) / 10);
  } else if (overallPct >= 65) {
    score = 50 + 25 * ((75 - overallPct) / 10);
  } else {
    score = 75 + 25 * ((65 - overallPct) / 65);
  }

  const factors = [];
  const recommendations = [];

  if (overallPct < threshold) {
    factors.push({
      category: 'ATTENDANCE',
      severity: overallPct < 65 ? 'HIGH' : 'MEDIUM',
      message: `Overall attendance is ${overallPct}%, which is below the ${threshold}% requirement.`,
      points: parseFloat(score.toFixed(1)),
      entityId: null,
    });

    const needed = calculateClassesNeededForTarget(totalPresent, totalClasses, threshold);
    if (needed > 0 && isFinite(needed)) {
      recommendations.push(`Attend the next ${needed} consecutive class(es) to reach the ${threshold}% attendance requirement.`);
    }
  }

  // Subject-level check
  let lowSubjectPenalty = 0;
  const subjectsMapById = new Map((subjects || []).map((s) => [s.id, s]));

  Object.entries(subjectMap).forEach(([subId, counts]) => {
    const subPct = calculateAttendancePercentage(counts.present, counts.total);
    if (subPct !== null && subPct < threshold) {
      lowSubjectPenalty += 10;
      const subObj = subjectsMapById.get(subId);
      const subName = subObj ? `${subObj.code} (${subObj.name})` : 'assigned subject';
      factors.push({
        category: 'ATTENDANCE_SUBJECT',
        severity: subPct < 65 ? 'HIGH' : 'MEDIUM',
        message: `Attendance in ${subName} is ${subPct}%, below required ${threshold}%.`,
        points: 10,
        entityId: subId,
      });
    }
  });

  const finalScore = Math.min(100, Math.max(0, score + lowSubjectPenalty));
  return {
    available: true,
    score: parseFloat(finalScore.toFixed(2)),
    factors,
    recommendations,
    overallPct,
  };
};

/**
 * Helper to calculate marks risk for a student.
 */
export const computeMarksRisk = (markRecords) => {
  if (!markRecords || markRecords.length === 0) {
    return { available: false, score: 0, factors: [], recommendations: [], averagePct: null };
  }

  const validNormalized = [];
  markRecords.forEach((m) => {
    try {
      const pct = normalizeMarkPercentage(m.marksObtained, m.maxMarks);
      validNormalized.push({ ...m, pct });
    } catch (e) {
      // Ignore invalid entries
    }
  });

  if (validNormalized.length === 0) {
    return { available: false, score: 0, factors: [], recommendations: [], averagePct: null };
  }

  const sumPct = validNormalized.reduce((acc, m) => acc + m.pct, 0);
  const averagePct = parseFloat((sumPct / validNormalized.length).toFixed(2));

  let score = 0;
  if (averagePct >= 80) {
    score = 0;
  } else if (averagePct >= 65) {
    score = 30 * ((80 - averagePct) / 15);
  } else if (averagePct >= 50) {
    score = 30 + 35 * ((65 - averagePct) / 15);
  } else {
    score = 65 + 35 * ((50 - averagePct) / 50);
  }

  score = Math.min(100, Math.max(0, score));

  const factors = [];
  const recommendations = [];

  if (averagePct < 65) {
    factors.push({
      category: 'MARKS',
      severity: averagePct < 50 ? 'HIGH' : 'MEDIUM',
      message: `Normalized assessment average is ${averagePct}%.`,
      points: parseFloat(score.toFixed(1)),
      entityId: null,
    });
    recommendations.push(`Review course concepts for upcoming assessments to improve mark average from ${averagePct}%.`);
  }

  return {
    available: true,
    score: parseFloat(score.toFixed(2)),
    factors,
    recommendations,
    averagePct,
  };
};

/**
 * Helper to calculate assignment risk for a student.
 */
export const computeAssignmentRisk = (assignments, submissions, student) => {
  if (!assignments || assignments.length === 0) {
    return { available: false, score: 0, factors: [], recommendations: [] };
  }

  const now = new Date();
  
  // Filter assignments targeted to student whose deadline has passed
  const eligibleAssignments = assignments.filter((a) => {
    if (a.status !== 'PUBLISHED' && a.status !== 'CLOSED') return false;
    if (new Date(a.dueAt) >= now) return false; // Not due yet
    if (a.batchYear && a.batchYear !== student.batchYear) return false;
    if (a.section && a.section !== student.section) return false;
    return true;
  });

  if (eligibleAssignments.length === 0) {
    return { available: false, score: 0, factors: [], recommendations: [] };
  }

  const submissionMap = new Map((submissions || []).map((s) => [s.assignmentId, s]));

  let unsubmittedOverdueCount = 0;
  let gradedScores = [];
  const factors = [];
  const recommendations = [];

  eligibleAssignments.forEach((a) => {
    const sub = submissionMap.get(a.id);
    if (!sub) {
      unsubmittedOverdueCount += 1;
    } else if (sub.status === 'GRADED' && sub.marksAwarded !== null && sub.marksAwarded !== undefined) {
      try {
        const pct = normalizeMarkPercentage(sub.marksAwarded, a.maxMarks);
        const gradeRisk = Math.max(0, 100 - pct);
        gradedScores.push(gradeRisk);
      } catch (e) {
        // Skip invalid
      }
    }
  });

  const unsubmittedPenalty = unsubmittedOverdueCount * 40;
  const avgGradedRisk = gradedScores.length > 0 ? gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length : 0;
  
  const finalScore = Math.min(100, Math.max(0, unsubmittedPenalty + avgGradedRisk));

  if (unsubmittedOverdueCount > 0) {
    factors.push({
      category: 'ASSIGNMENT',
      severity: unsubmittedOverdueCount >= 2 ? 'HIGH' : 'MEDIUM',
      message: `${unsubmittedOverdueCount} past-due assignment(s) missing submission.`,
      points: unsubmittedPenalty,
      entityId: null,
    });
    recommendations.push(`Complete and submit the ${unsubmittedOverdueCount} overdue assignment(s).`);
  }

  return {
    available: true,
    score: parseFloat(finalScore.toFixed(2)),
    factors,
    recommendations,
  };
};

/**
 * Helper to calculate progression risk for a student.
 */
export const computeProgressionRisk = (markRecords) => {
  if (!markRecords || markRecords.length < 2) {
    return { available: false, score: 0, factors: [], recommendations: [] };
  }

  // Order exam types: INTERNAL1 -> INTERNAL2 -> SEMESTER
  const examOrder = ['INTERNAL1', 'INTERNAL2', 'SEMESTER'];
  const grouped = { INTERNAL1: [], INTERNAL2: [], SEMESTER: [] };

  markRecords.forEach((m) => {
    try {
      const pct = normalizeMarkPercentage(m.marksObtained, m.maxMarks);
      if (grouped[m.examType]) {
        grouped[m.examType].push(pct);
      }
    } catch (e) {
      // Skip
    }
  });

  const avgs = [];
  examOrder.forEach((type) => {
    if (grouped[type].length > 0) {
      const avg = grouped[type].reduce((a, b) => a + b, 0) / grouped[type].length;
      avgs.push({ type, avg });
    }
  });

  if (avgs.length < 2) {
    return { available: false, score: 0, factors: [], recommendations: [] };
  }

  // Calculate decline between consecutive comparable assessments
  let maxDecline = 0;
  let declineInfo = null;

  for (let i = 0; i < avgs.length - 1; i++) {
    const diff = avgs[i].avg - avgs[i + 1].avg;
    if (diff > maxDecline) {
      maxDecline = diff;
      declineInfo = { from: avgs[i].type, to: avgs[i + 1].type, drop: parseFloat(diff.toFixed(2)) };
    }
  }

  const score = Math.min(100, Math.max(0, maxDecline * 2.5));
  const factors = [];
  const recommendations = [];

  if (maxDecline > 5 && declineInfo) {
    factors.push({
      category: 'PROGRESSION',
      severity: maxDecline > 15 ? 'HIGH' : 'MEDIUM',
      message: `Performance declined by ${declineInfo.drop}% between ${declineInfo.from} and ${declineInfo.to}.`,
      points: parseFloat(score.toFixed(1)),
      entityId: null,
    });
    recommendations.push(`Address score decline of ${declineInfo.drop}% between ${declineInfo.from} and ${declineInfo.to}.`);
  }

  return {
    available: true,
    score: parseFloat(score.toFixed(2)),
    factors,
    recommendations,
  };
};

/**
 * Calculates academic risk for a single student.
 */
export const calculateStudentRisk = async (studentId, options = {}) => {
  const { db = prisma, req = null, persist = true } = options;

  // 1. Fetch student profile
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  });

  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  // 2. Fetch data in parallel
  const [attendanceRecords, markRecords, subjects, assignments, submissions, thresholdSetting] = await Promise.all([
    db.attendance.findMany({ where: { studentId } }),
    db.mark.findMany({ where: { studentId } }),
    db.subject.findMany({ where: { departmentId: student.departmentId } }),
    db.assignment.findMany({ where: { subject: { departmentId: student.departmentId } } }),
    db.assignmentSubmission.findMany({ where: { studentId } }),
    db.setting.findUnique({ where: { key: 'low_attendance_threshold' } }),
  ]);

  const threshold = parseFloat(thresholdSetting?.value || '75');

  // 3. Compute components
  const attResult = computeAttendanceRisk(attendanceRecords, subjects, threshold);
  const marksResult = computeMarksRisk(markRecords);
  const assgResult = computeAssignmentRisk(assignments, submissions, student);
  const progResult = computeProgressionRisk(markRecords);

  const signals = [
    { name: 'attendance', weight: BASE_WEIGHTS.attendance, ...attResult },
    { name: 'marks', weight: BASE_WEIGHTS.marks, ...marksResult },
    { name: 'assignment', weight: BASE_WEIGHTS.assignment, ...assgResult },
    { name: 'progression', weight: BASE_WEIGHTS.progression, ...progResult },
  ];

  const availableSignals = signals.filter((s) => s.available);
  const activeCount = availableSignals.length;
  const dataCompleteness = (activeCount / 4) * 100;
  const confidenceLevel = classifyConfidenceLevel(dataCompleteness);

  let overallScore = 0;
  if (activeCount > 0) {
    const totalActiveWeight = availableSignals.reduce((acc, s) => acc + s.weight, 0);
    const weightedSum = availableSignals.reduce((acc, s) => acc + s.score * s.weight, 0);
    overallScore = weightedSum / totalActiveWeight;
  }

  overallScore = parseFloat(Math.min(100, Math.max(0, overallScore)).toFixed(2));
  const riskLevel = classifyRiskLevel(overallScore);

  const factors = [
    ...attResult.factors,
    ...marksResult.factors,
    ...assgResult.factors,
    ...progResult.factors,
  ];

  const recommendations = [
    ...attResult.recommendations,
    ...marksResult.recommendations,
    ...assgResult.recommendations,
    ...progResult.recommendations,
  ];

  const result = {
    studentId,
    student: {
      name: student.user.name,
      rollNo: student.rollNo,
      batchYear: student.batchYear,
      section: student.section,
      department: student.department.code,
    },
    riskScore: overallScore,
    riskLevel,
    attendanceScore: attResult.score,
    marksScore: marksResult.score,
    assignmentScore: assgResult.score,
    progressionScore: progResult.score,
    dataCompleteness,
    confidenceLevel,
    factors,
    recommendations,
    calculatedAt: new Date().toISOString(),
    calculationVersion: RISK_VERSION,
  };

  if (persist) {
    // Check previous assessment to detect level escalation & notify
    const previousAssessment = await db.riskAssessment.findFirst({
      where: { studentId },
      orderBy: { calculatedAt: 'desc' },
    });

    const snapshot = await db.riskAssessment.create({
      data: {
        studentId,
        riskScore: overallScore,
        riskLevel,
        attendanceScore: attResult.score,
        marksScore: marksResult.score,
        assignmentScore: assgResult.score,
        progressionScore: progResult.score,
        dataCompleteness,
        confidenceLevel,
        factors,
        recommendations,
        calculatedAt: new Date(),
        calculationVersion: RISK_VERSION,
      },
    });

    result.id = snapshot.id;

    // Check risk escalation for notification
    const levelRanks = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    const prevRank = previousAssessment ? levelRanks[previousAssessment.riskLevel] : 0;
    const currRank = levelRanks[riskLevel];

    if (previousAssessment && currRank > prevRank) {
      // Risk level escalated! Check 7-day cooldown for notification
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentNotification = await db.notification.findFirst({
        where: {
          userId: student.user.id,
          type: NOTIFICATION_TYPES.ACADEMIC_RISK,
          createdAt: { gte: sevenDaysAgo },
        },
      });

      if (!recentNotification) {
        await createNotification(
          {
            userId: student.user.id,
            title: `Academic Attention Alert: ${riskLevel} Risk`,
            message: `Your academic health level has transitioned to ${riskLevel} Risk (Score: ${overallScore}). Please check your Academic Health Dashboard for recommendations.`,
            type: NOTIFICATION_TYPES.ACADEMIC_RISK,
            priority: riskLevel === 'HIGH' ? NOTIFICATION_PRIORITIES.URGENT : NOTIFICATION_PRIORITIES.HIGH,
            relatedEntityType: 'RiskAssessment',
            relatedEntityId: snapshot.id,
          },
          db
        );
      }

      // Log audit for level transition
      await logAudit(
        {
          actorUserId: req?.user?.id || student.user.id,
          actorRole: req?.user?.role || 'SYSTEM',
          action: AUDIT_ACTIONS.RISK_LEVEL_CHANGED,
          entityType: 'RiskAssessment',
          entityId: snapshot.id,
          previousValue: { riskLevel: previousAssessment.riskLevel, score: previousAssessment.riskScore },
          newValue: { riskLevel, score: overallScore },
          req,
        },
        db
      );
    }
  }

  return result;
};

/**
 * Calculates risk for multiple students efficiently without N+1 queries.
 */
export const calculateBulkRisk = async (studentIds, options = {}) => {
  const { db = prisma, req = null, persist = true } = options;

  if (!studentIds || studentIds.length === 0) return [];

  // Batch query students
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, code: true } },
    },
  });

  const deptIds = [...new Set(students.map((s) => s.departmentId))];

  // Batch query raw records
  const [attendanceList, markList, subjectList, assignmentList, submissionList, thresholdSetting] = await Promise.all([
    db.attendance.findMany({ where: { studentId: { in: studentIds } } }),
    db.mark.findMany({ where: { studentId: { in: studentIds } } }),
    db.subject.findMany({ where: { departmentId: { in: deptIds } } }),
    db.assignment.findMany({ where: { subject: { departmentId: { in: deptIds } } } }),
    db.assignmentSubmission.findMany({ where: { studentId: { in: studentIds } } }),
    db.setting.findUnique({ where: { key: 'low_attendance_threshold' } }),
  ]);

  const threshold = parseFloat(thresholdSetting?.value || '75');

  // Group by studentId
  const attendanceByStudent = new Map();
  attendanceList.forEach((att) => {
    if (!attendanceByStudent.has(att.studentId)) attendanceByStudent.set(att.studentId, []);
    attendanceByStudent.get(att.studentId).push(att);
  });

  const marksByStudent = new Map();
  markList.forEach((m) => {
    if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, []);
    marksByStudent.get(m.studentId).push(m);
  });

  const submissionsByStudent = new Map();
  submissionList.forEach((sub) => {
    if (!submissionsByStudent.has(sub.studentId)) submissionsByStudent.set(sub.studentId, []);
    submissionsByStudent.get(sub.studentId).push(sub);
  });

  const subjectsByDept = new Map();
  subjectList.forEach((sub) => {
    if (!subjectsByDept.has(sub.departmentId)) subjectsByDept.set(sub.departmentId, []);
    subjectsByDept.get(sub.departmentId).push(sub);
  });

  const assignmentsByDept = new Map();
  assignmentList.forEach((a) => {
    const deptId = a.subject?.departmentId || subjectList.find((s) => s.id === a.subjectId)?.departmentId;
    if (deptId) {
      if (!assignmentsByDept.has(deptId)) assignmentsByDept.set(deptId, []);
      assignmentsByDept.get(deptId).push(a);
    }
  });

  const results = [];
  const snapshotsToCreate = [];

  for (const student of students) {
    const attRecords = attendanceByStudent.get(student.id) || [];
    const markRecords = marksByStudent.get(student.id) || [];
    const deptSubjects = subjectsByDept.get(student.departmentId) || [];
    const deptAssignments = assignmentsByDept.get(student.departmentId) || [];
    const studentSubmissions = submissionsByStudent.get(student.id) || [];

    const attResult = computeAttendanceRisk(attRecords, deptSubjects, threshold);
    const marksResult = computeMarksRisk(markRecords);
    const assgResult = computeAssignmentRisk(deptAssignments, studentSubmissions, student);
    const progResult = computeProgressionRisk(markRecords);

    const signals = [
      { name: 'attendance', weight: BASE_WEIGHTS.attendance, ...attResult },
      { name: 'marks', weight: BASE_WEIGHTS.marks, ...marksResult },
      { name: 'assignment', weight: BASE_WEIGHTS.assignment, ...assgResult },
      { name: 'progression', weight: BASE_WEIGHTS.progression, ...progResult },
    ];

    const availableSignals = signals.filter((s) => s.available);
    const activeCount = availableSignals.length;
    const dataCompleteness = (activeCount / 4) * 100;
    const confidenceLevel = classifyConfidenceLevel(dataCompleteness);

    let overallScore = 0;
    if (activeCount > 0) {
      const totalActiveWeight = availableSignals.reduce((acc, s) => acc + s.weight, 0);
      const weightedSum = availableSignals.reduce((acc, s) => acc + s.score * s.weight, 0);
      overallScore = weightedSum / totalActiveWeight;
    }

    overallScore = parseFloat(Math.min(100, Math.max(0, overallScore)).toFixed(2));
    const riskLevel = classifyRiskLevel(overallScore);

    const factors = [
      ...attResult.factors,
      ...marksResult.factors,
      ...assgResult.factors,
      ...progResult.factors,
    ];

    const recommendations = [
      ...attResult.recommendations,
      ...marksResult.recommendations,
      ...assgResult.recommendations,
      ...progResult.recommendations,
    ];

    const calcObj = {
      studentId: student.id,
      student: {
        name: student.user.name,
        rollNo: student.rollNo,
        batchYear: student.batchYear,
        section: student.section,
        department: student.department.code,
      },
      riskScore: overallScore,
      riskLevel,
      attendanceScore: attResult.score,
      marksScore: marksResult.score,
      assignmentScore: assgResult.score,
      progressionScore: progResult.score,
      dataCompleteness,
      confidenceLevel,
      factors,
      recommendations,
      calculatedAt: new Date().toISOString(),
      calculationVersion: RISK_VERSION,
    };

    results.push(calcObj);

    if (persist) {
      snapshotsToCreate.push({
        studentId: student.id,
        riskScore: overallScore,
        riskLevel,
        attendanceScore: attResult.score,
        marksScore: marksResult.score,
        assignmentScore: assgResult.score,
        progressionScore: progResult.score,
        dataCompleteness,
        confidenceLevel,
        factors,
        recommendations,
        calculatedAt: new Date(),
        calculationVersion: RISK_VERSION,
      });
    }
  }

  if (persist && snapshotsToCreate.length > 0) {
    await db.riskAssessment.createMany({
      data: snapshotsToCreate,
    });
  }

  return results;
};
