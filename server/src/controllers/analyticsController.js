import prisma from '../utils/db.js';
import { z } from 'zod';
import { 
  calculateAttendancePercentage, 
  calculateClassesNeededForTarget, 
  calculateClassesCanMiss,
  normalizeMarkPercentage
} from '../utils/analyticsMath.js';

// Schema validation for query parameters
const filterSchema = z.object({
  departmentId: z.string().uuid().optional(),
  batchYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  section: z.string().max(2).optional(),
  examType: z.enum(['INTERNAL1', 'INTERNAL2', 'SEMESTER']).optional()
});

/**
 * GET /api/analytics/student/summary
 * Retrieves overall attendance, missable classes, normalized subject averages, and progression comparisons for the logged-in student.
 */
export const getStudentSummary = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'User profile is not associated with a student account.' });
    }

    // 1. Fetch student info
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true } },
        department: { select: { name: true, code: true } }
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // 2. Fetch subject metadata
    const subjects = await prisma.subject.findMany({
      where: { departmentId: student.departmentId },
      select: { id: true, name: true, code: true, semester: true }
    });

    // 3. Fetch grouped attendance counts directly (avoids N+1)
    const attendanceGroups = await prisma.attendance.groupBy({
      by: ['subjectId', 'status'],
      where: { studentId },
      _count: { id: true }
    });

    // Map database counts to dictionary
    const attMap = {};
    attendanceGroups.forEach(g => {
      if (!attMap[g.subjectId]) {
        attMap[g.subjectId] = { PRESENT: 0, ABSENT: 0 };
      }
      attMap[g.subjectId][g.status] = g._count.id;
    });

    // Fetch low attendance threshold setting
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'low_attendance_threshold' },
    });
    const threshold = parseFloat(thresholdSetting?.value || '75');

    let totalClassesHeld = 0;
    let totalPresent = 0;

    const subjectWiseAttendance = subjects.map(sub => {
      const counts = attMap[sub.id] || { PRESENT: 0, ABSENT: 0 };
      const total = counts.PRESENT + counts.ABSENT;
      const present = counts.PRESENT;
      
      totalClassesHeld += total;
      totalPresent += present;

      const percentage = calculateAttendancePercentage(present, total);

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        semester: sub.semester,
        present,
        total,
        percentage,
        isLow: percentage !== null ? percentage < threshold : false
      };
    });

    const overallPercentage = calculateAttendancePercentage(totalPresent, totalClassesHeld);
    const classesNeeded = overallPercentage !== null ? calculateClassesNeededForTarget(totalPresent, totalClassesHeld, threshold) : 0;
    const classesCanMiss = overallPercentage !== null ? calculateClassesCanMiss(totalPresent, totalClassesHeld, threshold) : 0;

    // 4. Fetch marks and normalize
    const marksData = await prisma.mark.findMany({
      where: { studentId },
      include: {
        subject: { select: { name: true, code: true } }
      }
    });

    const normalizedMarks = [];
    const invalidMarks = [];

    marksData.forEach(m => {
      try {
        const percentage = normalizeMarkPercentage(m.marksObtained, m.maxMarks);
        normalizedMarks.push({
          id: m.id,
          subjectId: m.subjectId,
          subjectName: m.subject.name,
          subjectCode: m.subject.code,
          examType: m.examType,
          percentage
        });
      } catch (err) {
        invalidMarks.push({
          id: m.id,
          subjectCode: m.subject.code,
          examType: m.examType,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          reason: err.message
        });
      }
    });

    // Group normalized marks by subject for overview averages
    const subjectMarksMap = {};
    normalizedMarks.forEach(m => {
      if (!subjectMarksMap[m.subjectId]) {
        subjectMarksMap[m.subjectId] = {
          subjectName: m.subjectName,
          subjectCode: m.subjectCode,
          scores: []
        };
      }
      subjectMarksMap[m.subjectId].scores.push(m.percentage);
    });

    const subjectPerformance = Object.entries(subjectMarksMap).map(([subjectId, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        subjectId,
        subjectName: data.subjectName,
        subjectCode: data.subjectCode,
        percentage: parseFloat(avg.toFixed(2))
      };
    });

    // Group normalized marks by examType for assessment comparisons
    const examTypeScores = { INTERNAL1: [], INTERNAL2: [], SEMESTER: [] };
    normalizedMarks.forEach(m => {
      if (examTypeScores[m.examType]) {
        examTypeScores[m.examType].push(m.percentage);
      }
    });

    const assessmentComparison = Object.entries(examTypeScores).map(([examType, scores]) => ({
      examType,
      averagePercentage: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null
    }));

    res.json({
      student: {
        name: student.user.name,
        rollNo: student.rollNo,
        batchYear: student.batchYear,
        section: student.section,
        department: student.department.name
      },
      attendance: {
        overall: {
          present: totalPresent,
          total: totalClassesHeld,
          percentage: overallPercentage,
          threshold,
          classesNeeded,
          classesCanMiss
        },
        subjectWise: subjectWiseAttendance
      },
      academics: {
        subjectWisePerformance: subjectPerformance,
        assessmentProgression: assessmentComparison,
        dataQualityIssues: invalidMarks.length > 0 ? invalidMarks : undefined
      }
    });
  } catch (error) {
    console.error('Error loading student summary:', error);
    res.status(500).json({ message: 'Server error loading student summary analytics' });
  }
};

/**
 * GET /api/analytics/faculty/subject/:subjectId
 * Retrieves aggregated class list performance, score distributions, and attendance warnings. Scopes to authorized subject only.
 */
export const getFacultySubjectAnalytics = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const facultyId = req.user.facultyId;

    if (!facultyId) {
      return res.status(403).json({ message: 'Access denied. User profile is not a faculty account.' });
    }

    // 1. Verify subject ownership/authorization
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        department: { select: { code: true } }
      }
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if (subject.facultyId !== facultyId) {
      return res.status(403).json({ message: 'Access denied. You do not teach this subject.' });
    }

    // 2. Fetch marks for this subject
    const marksData = await prisma.mark.findMany({
      where: { subjectId },
      include: {
        student: {
          select: {
            id: true,
            rollNo: true,
            user: { select: { name: true } }
          }
        }
      }
    });

    const normalizedScores = [];
    const invalidMarks = [];
    
    // Score buckets for distribution histogram
    const scoreBuckets = {
      under50: 0,
      between50And75: 0,
      between75And90: 0,
      above90: 0
    };

    marksData.forEach(m => {
      try {
        const pct = normalizeMarkPercentage(m.marksObtained, m.maxMarks);
        normalizedScores.push(pct);

        if (pct < 50) scoreBuckets.under50++;
        else if (pct >= 50 && pct < 75) scoreBuckets.between50And75++;
        else if (pct >= 75 && pct < 90) scoreBuckets.between75And90++;
        else scoreBuckets.above90++;
      } catch (err) {
        invalidMarks.push({ id: m.id, marksObtained: m.marksObtained, maxMarks: m.maxMarks });
      }
    });

    const averageNormalizedScore = normalizedScores.length > 0
      ? parseFloat((normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length).toFixed(2))
      : null;

    const highestScore = normalizedScores.length > 0 ? Math.max(...normalizedScores) : null;
    const lowestScore = normalizedScores.length > 0 ? Math.min(...normalizedScores) : null;

    // 3. Fetch grouped student attendance for this subject (avoids N+1)
    const attendanceGroups = await prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { subjectId },
      _count: { id: true }
    });

    const studentAttMap = {};
    attendanceGroups.forEach(g => {
      if (!studentAttMap[g.studentId]) {
        studentAttMap[g.studentId] = { PRESENT: 0, ABSENT: 0 };
      }
      studentAttMap[g.studentId][g.status] = g._count.id;
    });

    // Get overall system threshold
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'low_attendance_threshold' },
    });
    const threshold = parseFloat(thresholdSetting?.value || '75');

    const studentAttendanceMetrics = [];
    let totalPresent = 0;
    let totalClasses = 0;

    Object.entries(studentAttMap).forEach(([studentId, counts]) => {
      const total = counts.PRESENT + counts.ABSENT;
      const present = counts.PRESENT;
      totalPresent += present;
      totalClasses += total;

      const percentage = calculateAttendancePercentage(present, total);
      studentAttendanceMetrics.push({
        studentId,
        percentage,
        isBelowThreshold: percentage !== null ? percentage < threshold : false
      });
    });

    const averageAttendance = totalClasses > 0
      ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2))
      : null;

    // Fetch names of students below required attendance
    const belowThresholdIds = studentAttendanceMetrics
      .filter(m => m.isBelowThreshold)
      .map(m => m.studentId);

    const attentionRequiredStudents = await prisma.student.findMany({
      where: { id: { in: belowThresholdIds } },
      select: {
        id: true,
        rollNo: true,
        batchYear: true,
        section: true,
        user: { select: { name: true } }
      }
    });

    const attentionRequiredReport = attentionRequiredStudents.map(s => {
      const metric = studentAttendanceMetrics.find(m => m.studentId === s.id);
      return {
        id: s.id,
        name: s.user.name,
        rollNo: s.rollNo,
        batchYear: s.batchYear,
        section: s.section,
        attendancePercentage: metric?.percentage
      };
    });

    res.json({
      subject: {
        name: subject.name,
        code: subject.code,
        semester: subject.semester,
        department: subject.department.code
      },
      summary: {
        totalEnrolled: studentAttendanceMetrics.length,
        averageNormalizedScore,
        highestScore,
        lowestScore,
        averageAttendance,
        belowThresholdCount: attentionRequiredReport.length
      },
      distribution: {
        marks: scoreBuckets,
        invalidRecords: invalidMarks.length > 0 ? invalidMarks : undefined
      },
      attendanceAttentionRequired: attentionRequiredReport
    });
  } catch (error) {
    console.error('Error loading faculty subject analytics:', error);
    res.status(500).json({ message: 'Server error loading subject analytics' });
  }
};

/**
 * GET /api/analytics/admin/summary
 * Retrieves system-wide academic averages, batch Comparisons, and department benchmarks.
 */
export const getAdminSummary = async (req, res) => {
  try {
    const filtersResult = filterSchema.safeParse(req.query);
    if (!filtersResult.success) {
      return res.status(400).json({ message: 'Invalid filters supplied.' });
    }

    const { departmentId, batchYear, section } = filtersResult.data;

    // Build scoped student filter
    const studentFilter = {};
    if (departmentId) studentFilter.departmentId = departmentId;
    if (batchYear) studentFilter.batchYear = batchYear;
    if (section) studentFilter.section = section;

    // 1. Core KPIs
    const [totalStudents, totalFaculty, totalSubjects] = await Promise.all([
      prisma.student.count({ where: studentFilter }),
      prisma.faculty.count({ where: departmentId ? { departmentId } : undefined }),
      prisma.subject.count({ where: departmentId ? { departmentId } : undefined })
    ]);

    // 2. Retrieve attendance raw records for normalized calculation (grouped counts)
    const attendanceFilter = {};
    if (departmentId || batchYear || section) {
      attendanceFilter.student = studentFilter;
    }

    const rawAttendance = await prisma.attendance.findMany({
      where: attendanceFilter,
      select: {
        status: true,
        student: {
          select: {
            id: true,
            departmentId: true,
            batchYear: true,
            section: true
          }
        }
      }
    });

    // Compute overall system statistics from attendance logs
    let globalPresent = 0;
    const studentAttTotals = {};
    const departmentAttCounts = {};
    const batchAttCounts = {};
    const sectionAttCounts = {};

    rawAttendance.forEach(att => {
      const s = att.student;
      if (!s) return;

      // Group counts per student for overall at-risk tally
      if (!studentAttTotals[s.id]) studentAttTotals[s.id] = { PRESENT: 0, ABSENT: 0 };
      studentAttTotals[s.id][att.status]++;

      if (att.status === 'PRESENT') globalPresent++;

      // Department grouping
      if (!departmentAttCounts[s.departmentId]) departmentAttCounts[s.departmentId] = { P: 0, T: 0 };
      departmentAttCounts[s.departmentId].T++;
      if (att.status === 'PRESENT') departmentAttCounts[s.departmentId].P++;

      // Batch grouping
      if (!batchAttCounts[s.batchYear]) batchAttCounts[s.batchYear] = { P: 0, T: 0 };
      batchAttCounts[s.batchYear].T++;
      if (att.status === 'PRESENT') batchAttCounts[s.batchYear].P++;

      // Section grouping (combine batch + section)
      const secKey = `${s.batchYear} - Sec ${s.section}`;
      if (!sectionAttCounts[secKey]) sectionAttCounts[secKey] = { P: 0, T: 0 };
      sectionAttCounts[secKey].T++;
      if (att.status === 'PRESENT') sectionAttCounts[secKey].P++;
    });

    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'low_attendance_threshold' },
    });
    const threshold = parseFloat(thresholdSetting?.value || '75');

    let belowThresholdCount = 0;
    Object.values(studentAttTotals).forEach(counts => {
      const total = counts.PRESENT + counts.ABSENT;
      const pct = calculateAttendancePercentage(counts.PRESENT, total);
      if (pct !== null && pct < threshold) {
        belowThresholdCount++;
      }
    });

    const overallAttendance = rawAttendance.length > 0
      ? parseFloat(((globalPresent / rawAttendance.length) * 100).toFixed(2))
      : null;

    // 3. Normalized Marks Aggregation
    const markFilter = {};
    if (departmentId || batchYear || section) {
      markFilter.student = studentFilter;
    }

    const rawMarks = await prisma.mark.findMany({
      where: markFilter,
      select: {
        examType: true,
        marksObtained: true,
        maxMarks: true,
        student: {
          select: {
            departmentId: true,
            batchYear: true,
            section: true
          }
        }
      }
    });

    const globalNormalizedScores = [];
    const departmentScores = {};
    const batchScores = {};
    const examTypeScores = { INTERNAL1: [], INTERNAL2: [], SEMESTER: [] };

    rawMarks.forEach(m => {
      if (m.maxMarks <= 0 || m.marksObtained < 0 || m.marksObtained > m.maxMarks) return; // ignore invalid entries

      const pct = (m.marksObtained / m.maxMarks) * 100;
      globalNormalizedScores.push(pct);

      const s = m.student;
      if (!s) return;

      if (!departmentScores[s.departmentId]) departmentScores[s.departmentId] = [];
      departmentScores[s.departmentId].push(pct);

      if (!batchScores[s.batchYear]) batchScores[s.batchYear] = [];
      batchScores[s.batchYear].push(pct);

      if (examTypeScores[m.examType]) {
        examTypeScores[m.examType].push(pct);
      }
    });

    const averageNormalizedScore = globalNormalizedScores.length > 0
      ? parseFloat((globalNormalizedScores.reduce((a, b) => a + b, 0) / globalNormalizedScores.length).toFixed(2))
      : null;

    // Fetch department mapping profiles to resolve names
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true }
    });

    const departmentSummary = departments.map(d => {
      const att = departmentAttCounts[d.id];
      const scores = departmentScores[d.id] || [];
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        attendancePercentage: att ? parseFloat(((att.P / att.T) * 100).toFixed(2)) : null,
        averageScore: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null
      };
    });

    const batchSummary = Object.keys(batchAttCounts).map(batch => {
      const att = batchAttCounts[batch];
      const scores = batchScores[batch] || [];
      return {
        batch,
        attendancePercentage: att ? parseFloat(((att.P / att.T) * 100).toFixed(2)) : null,
        averageScore: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null
      };
    });

    const sectionAttendanceSummary = Object.entries(sectionAttCounts).map(([sectionLabel, counts]) => ({
      section: sectionLabel,
      attendancePercentage: parseFloat(((counts.P / counts.T) * 100).toFixed(2))
    }));

    const examTypeComparison = Object.entries(examTypeScores).map(([examType, scores]) => ({
      examType,
      averagePercentage: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null
    }));

    res.json({
      counters: {
        students: totalStudents,
        faculty: totalFaculty,
        subjects: totalSubjects,
        belowRequiredAttendanceCount: belowThresholdCount
      },
      overall: {
        attendancePercentage: overallAttendance,
        averageNormalizedScore,
        lowAttendanceThreshold: threshold
      },
      departmentComparison: departmentSummary,
      batchComparison: batchSummary,
      sectionAttendance: sectionAttendanceSummary,
      examTypeComparison
    });
  } catch (error) {
    console.error('Error fetching admin summary:', error);
    res.status(500).json({ message: 'Server error loading dashboard analytics' });
  }
};
