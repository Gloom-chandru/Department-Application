import prisma from '../utils/db.js';
import { z } from 'zod';
import { calculateStudentRisk, calculateBulkRisk } from '../utils/riskEngine.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';

// Query schemas
const facultyFilterSchema = z.object({
  subjectId: z.string().uuid().optional(),
  batchYear: z.string().regex(/^\d{4}-\d{2,4}$/).optional(),
  section: z.string().max(2).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

const adminFilterSchema = z.object({
  departmentId: z.string().uuid().optional(),
  batchYear: z.string().regex(/^\d{4}-\d{2,4}$/).optional(),
  section: z.string().max(2).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  page: z.preprocess((val) => parseInt(val || '1'), z.number().int().positive().default(1)),
  limit: z.preprocess((val) => parseInt(val || '20'), z.number().int().positive().max(100).default(20)),
});

/**
 * GET /api/risk/student/me
 * Student views their own academic health & risk profile.
 */
export const getStudentMeRisk = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'User account is not linked to a student profile.' });
    }

    // Try finding latest snapshot
    let latest = await prisma.riskAssessment.findFirst({
      where: { studentId },
      orderBy: { calculatedAt: 'desc' },
      include: {
        student: {
          select: {
            rollNo: true,
            batchYear: true,
            section: true,
            user: { select: { name: true } },
            department: { select: { code: true, name: true } },
          },
        },
      },
    });

    // If no snapshot or older than 1 hour, calculate fresh
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!latest || new Date(latest.calculatedAt) < oneHourAgo) {
      const calculated = await calculateStudentRisk(studentId, { req, persist: true });
      return res.json(calculated);
    }

    res.json({
      studentId: latest.studentId,
      student: {
        name: latest.student.user.name,
        rollNo: latest.student.rollNo,
        batchYear: latest.student.batchYear,
        section: latest.student.section,
        department: latest.student.department.code,
      },
      riskScore: latest.riskScore,
      riskLevel: latest.riskLevel,
      attendanceScore: latest.attendanceScore,
      marksScore: latest.marksScore,
      assignmentScore: latest.assignmentScore,
      progressionScore: latest.progressionScore,
      dataCompleteness: latest.dataCompleteness,
      confidenceLevel: latest.confidenceLevel,
      factors: latest.factors,
      recommendations: latest.recommendations,
      calculatedAt: latest.calculatedAt,
      calculationVersion: latest.calculationVersion,
    });
  } catch (error) {
    console.error('Error fetching student risk profile:', error);
    res.status(500).json({ message: 'Server error retrieving academic health profile.' });
  }
};

/**
 * GET /api/risk/faculty/students
 * Faculty lists academic attention risk summary for students in assigned subjects.
 */
export const getFacultyStudentsRisk = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Access denied. Faculty profile required.' });
    }

    const validation = facultyFilterSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid filters supplied.', errors: validation.error.format() });
    }

    const { subjectId, batchYear, section, riskLevel } = validation.data;

    // Get subjects taught by faculty
    const facultySubjects = await prisma.subject.findMany({
      where: { facultyId },
      select: { id: true, departmentId: true, code: true, name: true },
    });

    if (facultySubjects.length === 0) {
      return res.json({
        summary: { total: 0, high: 0, medium: 0, low: 0 },
        students: [],
      });
    }

    let targetDepartmentId = facultySubjects[0].departmentId;
    if (subjectId) {
      const match = facultySubjects.find((s) => s.id === subjectId);
      if (!match) {
        return res.status(403).json({ message: 'Access denied. You do not teach this subject.' });
      }
      targetDepartmentId = match.departmentId;
    }

    // Build student query
    const studentWhere = { departmentId: targetDepartmentId };
    if (batchYear) studentWhere.batchYear = batchYear;
    if (section) studentWhere.section = section;

    const eligibleStudents = await prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    });

    const studentIds = eligibleStudents.map((s) => s.id);
    if (studentIds.length === 0) {
      return res.json({
        summary: { total: 0, high: 0, medium: 0, low: 0 },
        students: [],
      });
    }

    // Get latest risk assessments for these students
    const latestAssessments = await prisma.riskAssessment.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { calculatedAt: 'desc' },
      distinct: ['studentId'],
      include: {
        student: {
          select: {
            id: true,
            rollNo: true,
            batchYear: true,
            section: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    // If some students have no snapshot, calculate in bulk
    const foundStudentIds = new Set(latestAssessments.map((a) => a.studentId));
    const missingStudentIds = studentIds.filter((id) => !foundStudentIds.has(id));

    let freshCalculated = [];
    if (missingStudentIds.length > 0) {
      freshCalculated = await calculateBulkRisk(missingStudentIds, { req, persist: true });
    }

    const allList = [
      ...latestAssessments.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        rollNo: a.student.rollNo,
        name: a.student.user.name,
        batchYear: a.student.batchYear,
        section: a.student.section,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
        attendanceScore: a.attendanceScore,
        marksScore: a.marksScore,
        dataCompleteness: a.dataCompleteness,
        confidenceLevel: a.confidenceLevel,
        factorsCount: Array.isArray(a.factors) ? a.factors.length : 0,
        calculatedAt: a.calculatedAt,
      })),
      ...freshCalculated.map((c) => ({
        id: c.studentId,
        studentId: c.studentId,
        rollNo: c.student.rollNo,
        name: c.student.name,
        batchYear: c.student.batchYear,
        section: c.student.section,
        riskScore: c.riskScore,
        riskLevel: c.riskLevel,
        attendanceScore: c.attendanceScore,
        marksScore: c.marksScore,
        dataCompleteness: c.dataCompleteness,
        confidenceLevel: c.confidenceLevel,
        factorsCount: c.factors.length,
        calculatedAt: c.calculatedAt,
      })),
    ];

    let filtered = allList;
    if (riskLevel) {
      filtered = allList.filter((item) => item.riskLevel === riskLevel);
    }

    const summary = {
      total: allList.length,
      high: allList.filter((s) => s.riskLevel === 'HIGH').length,
      medium: allList.filter((s) => s.riskLevel === 'MEDIUM').length,
      low: allList.filter((s) => s.riskLevel === 'LOW').length,
    };

    res.json({
      summary,
      subjects: facultySubjects,
      students: filtered,
    });
  } catch (error) {
    console.error('Error fetching faculty student risk view:', error);
    res.status(500).json({ message: 'Server error loading academic risk profiles.' });
  }
};

/**
 * GET /api/risk/faculty/student/:studentId
 * Faculty views detailed risk breakdown for authorized student.
 */
export const getFacultyStudentDetailRisk = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    const { studentId } = req.params;

    if (!facultyId) {
      return res.status(403).json({ message: 'Access denied. Faculty profile required.' });
    }

    // Verify student exists & belongs to faculty's department
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { departmentId: true },
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Verify faculty teaches at least one subject in student's department
    const facultyTeachesInDept = await prisma.subject.findFirst({
      where: { facultyId, departmentId: student.departmentId },
    });

    if (!facultyTeachesInDept) {
      return res.status(403).json({ message: 'Access denied. You do not teach subjects for this student.' });
    }

    const result = await calculateStudentRisk(studentId, { req, persist: false });
    res.json(result);
  } catch (error) {
    console.error('Error fetching faculty student risk detail:', error);
    res.status(500).json({ message: 'Server error retrieving student risk details.' });
  }
};

/**
 * GET /api/risk/admin/summary
 * Admin views system-wide risk distribution and department benchmarks.
 */
export const getAdminSummaryRisk = async (req, res) => {
  try {
    const validation = adminFilterSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid filters supplied.', errors: validation.error.format() });
    }

    const { departmentId, batchYear, section } = validation.data;

    // Student filter
    const studentWhere = {};
    if (departmentId) studentWhere.departmentId = departmentId;
    if (batchYear) studentWhere.batchYear = batchYear;
    if (section) studentWhere.section = section;

    const totalStudents = await prisma.student.count({ where: studentWhere });

    // Fetch latest risk assessments
    const latestAssessments = await prisma.riskAssessment.findMany({
      where: {
        student: studentWhere,
      },
      orderBy: { calculatedAt: 'desc' },
      distinct: ['studentId'],
      include: {
        student: { select: { departmentId: true, batchYear: true, section: true } },
      },
    });

    const distribution = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    let totalScoreSum = 0;
    const deptScoresMap = {};
    const factorCategoriesCount = {};

    latestAssessments.forEach((a) => {
      distribution[a.riskLevel] += 1;
      totalScoreSum += a.riskScore;

      const deptId = a.student.departmentId;
      if (!deptScoresMap[deptId]) deptScoresMap[deptId] = [];
      deptScoresMap[deptId].push(a.riskScore);

      if (Array.isArray(a.factors)) {
        a.factors.forEach((f) => {
          factorCategoriesCount[f.category] = (factorCategoriesCount[f.category] || 0) + 1;
        });
      }
    });

    const averageRiskScore = latestAssessments.length > 0
      ? parseFloat((totalScoreSum / latestAssessments.length).toFixed(2))
      : 0;

    // Fetch departments for name resolution
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
    });

    const departmentBenchmarks = departments.map((d) => {
      const scores = deptScoresMap[d.id] || [];
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        studentCount: scores.length,
        averageRiskScore: parseFloat(avg.toFixed(2)),
        highRiskCount: latestAssessments.filter((a) => a.student.departmentId === d.id && a.riskLevel === 'HIGH').length,
      };
    });

    res.json({
      counters: {
        totalStudents,
        assessedStudents: latestAssessments.length,
        averageRiskScore,
      },
      distribution,
      departmentBenchmarks,
      topFactorCategories: Object.entries(factorCategoriesCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (error) {
    console.error('Error fetching admin risk summary:', error);
    res.status(500).json({ message: 'Server error retrieving risk analytics summary.' });
  }
};

/**
 * GET /api/risk/admin/students
 * Admin paginated list of all student risk profiles.
 */
export const getAdminStudentsRisk = async (req, res) => {
  try {
    const validation = adminFilterSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid query parameters.', errors: validation.error.format() });
    }

    const { departmentId, batchYear, section, riskLevel, page, limit } = validation.data;

    const studentWhere = {};
    if (departmentId) studentWhere.departmentId = departmentId;
    if (batchYear) studentWhere.batchYear = batchYear;
    if (section) studentWhere.section = section;

    const assessmentWhere = { student: studentWhere };
    if (riskLevel) assessmentWhere.riskLevel = riskLevel;

    const [total, assessments] = await Promise.all([
      prisma.riskAssessment.count({ where: assessmentWhere }),
      prisma.riskAssessment.findMany({
        where: assessmentWhere,
        orderBy: { calculatedAt: 'desc' },
        distinct: ['studentId'],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: {
            select: {
              id: true,
              rollNo: true,
              batchYear: true,
              section: true,
              user: { select: { name: true, email: true } },
              department: { select: { code: true } },
            },
          },
        },
      }),
    ]);

    const formatted = assessments.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      name: a.student.user.name,
      rollNo: a.student.rollNo,
      department: a.student.department.code,
      batchYear: a.student.batchYear,
      section: a.student.section,
      riskScore: a.riskScore,
      riskLevel: a.riskLevel,
      attendanceScore: a.attendanceScore,
      marksScore: a.marksScore,
      dataCompleteness: a.dataCompleteness,
      confidenceLevel: a.confidenceLevel,
      calculatedAt: a.calculatedAt,
    }));

    res.json({
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      students: formatted,
    });
  } catch (error) {
    console.error('Error listing admin student risk profiles:', error);
    res.status(500).json({ message: 'Server error listing student risk profiles.' });
  }
};

/**
 * GET /api/risk/admin/student/:studentId
 * Admin views individual student risk profile.
 */
export const getAdminStudentDetailRisk = async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await calculateStudentRisk(studentId, { req, persist: false });
    res.json(result);
  } catch (error) {
    console.error('Error fetching admin student risk detail:', error);
    res.status(500).json({ message: 'Server error loading student risk details.' });
  }
};

/**
 * POST /api/risk/admin/recalculate
 * Admin triggers bulk risk recalculation for scope.
 */
export const recalculateAdminRisk = async (req, res) => {
  try {
    const validation = adminFilterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid payload filters.', errors: validation.error.format() });
    }

    const { departmentId, batchYear, section } = validation.data;

    const studentWhere = {};
    if (departmentId) studentWhere.departmentId = departmentId;
    if (batchYear) studentWhere.batchYear = batchYear;
    if (section) studentWhere.section = section;

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      return res.json({ message: 'No matching students found to recalculate.', count: 0 });
    }

    const results = await calculateBulkRisk(studentIds, { req, persist: true });

    // Log audit action
    await logAudit(
      {
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.RISK_RECALCULATION_TRIGGERED,
        entityType: 'RiskAssessment',
        entityId: null,
        newValue: { count: results.length, departmentId, batchYear, section },
        req,
      },
      prisma
    );

    res.json({
      message: `Successfully recalculated academic risk for ${results.length} student(s).`,
      count: results.length,
    });
  } catch (error) {
    console.error('Error recalculating admin risk:', error);
    res.status(500).json({ message: 'Server error performing risk recalculation.' });
  }
};
