import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import { 
  computeAttendanceRisk, 
  computeMarksRisk, 
  computeAssignmentRisk, 
  computeProgressionRisk,
  classifyRiskLevel,
  classifyConfidenceLevel,
  calculateStudentRisk,
  calculateBulkRisk
} from '../src/utils/riskEngine.js';

describe('Phase 9: Academic Risk & Early-Warning System Backend Tests', () => {
  let studentToken, facultyToken, adminToken;
  let studentUser, facultyUser, adminUser;
  let department, student, faculty, subject;

  beforeAll(async () => {
    // Clean database test data if needed or fetch existing seed data
    department = await prisma.department.findFirst({ where: { code: 'AIDS' } }) 
      || await prisma.department.create({ data: { name: 'Artificial Intelligence', code: 'AIDS' } });

    // Seed test users & tokens if needed
    // Fetch seed users
    const sUser = await prisma.user.findFirst({ where: { role: 'STUDENT' }, include: { studentProfile: true } });
    const fUser = await prisma.user.findFirst({ where: { role: 'FACULTY' }, include: { facultyProfile: true } });
    const aUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (sUser && fUser && aUser) {
      studentUser = sUser;
      student = sUser.studentProfile;
      facultyUser = fUser;
      faculty = fUser.facultyProfile;
      adminUser = aUser;

      // Logins for tokens
      const sRes = await request(app).post('/api/auth/login').send({ email: studentUser.email, password: 'password123' });
      studentToken = sRes.body.token;

      const fRes = await request(app).post('/api/auth/login').send({ email: facultyUser.email, password: 'password123' });
      facultyToken = fRes.body.token;

      const aRes = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'password123' });
      adminToken = aRes.body.token;
    }
  });

  // =====================================================
  // 1. RISK ENGINE MATH & CLASSIFICATION UNIT TESTS
  // =====================================================
  describe('1. Risk Engine Math & Component Calculation', () => {
    test('classifyRiskLevel boundaries', () => {
      expect(classifyRiskLevel(0)).toBe('LOW');
      expect(classifyRiskLevel(34.99)).toBe('LOW');
      expect(classifyRiskLevel(35)).toBe('MEDIUM');
      expect(classifyRiskLevel(64.99)).toBe('MEDIUM');
      expect(classifyRiskLevel(65)).toBe('HIGH');
      expect(classifyRiskLevel(100)).toBe('HIGH');
    });

    test('classifyConfidenceLevel boundaries', () => {
      expect(classifyConfidenceLevel(100)).toBe('HIGH');
      expect(classifyConfidenceLevel(75)).toBe('HIGH');
      expect(classifyConfidenceLevel(50)).toBe('MEDIUM');
      expect(classifyConfidenceLevel(25)).toBe('LOW');
      expect(classifyConfidenceLevel(0)).toBe('LOW');
    });

    test('computeAttendanceRisk returns 0 risk for high attendance', () => {
      const records = [
        { subjectId: 's1', status: 'PRESENT' },
        { subjectId: 's1', status: 'PRESENT' },
        { subjectId: 's1', status: 'PRESENT' },
        { subjectId: 's1', status: 'PRESENT' },
      ];
      const res = computeAttendanceRisk(records, [{ id: 's1', code: 'CS101', name: 'CS' }], 75);
      expect(res.available).toBe(true);
      expect(res.score).toBe(0);
      expect(res.overallPct).toBe(100);
      expect(res.factors.length).toBe(0);
    });

    test('computeAttendanceRisk handles low attendance with subject penalties', () => {
      const records = [
        { subjectId: 's1', status: 'ABSENT' },
        { subjectId: 's1', status: 'ABSENT' },
        { subjectId: 's1', status: 'ABSENT' },
        { subjectId: 's1', status: 'PRESENT' }, // 25%
      ];
      const res = computeAttendanceRisk(records, [{ id: 's1', code: 'CS101', name: 'CS' }], 75);
      expect(res.available).toBe(true);
      expect(res.score).toBeGreaterThan(70);
      expect(res.factors.length).toBeGreaterThan(0);
    });

    test('computeAttendanceRisk handles missing attendance records without error', () => {
      const res = computeAttendanceRisk([], [], 75);
      expect(res.available).toBe(false);
      expect(res.score).toBe(0);
      expect(res.overallPct).toBeNull();
    });

    test('computeMarksRisk normalizes marks correctly', () => {
      const marks = [
        { marksObtained: 40, maxMarks: 50 }, // 80%
        { marksObtained: 45, maxMarks: 50 }, // 90%
      ];
      const res = computeMarksRisk(marks);
      expect(res.available).toBe(true);
      expect(res.score).toBe(0);
      expect(res.averagePct).toBe(85);
    });

    test('computeMarksRisk handles low normalized marks', () => {
      const marks = [
        { marksObtained: 15, maxMarks: 50 }, // 30%
        { marksObtained: 20, maxMarks: 50 }, // 40%
      ];
      const res = computeMarksRisk(marks);
      expect(res.available).toBe(true);
      expect(res.score).toBeGreaterThan(65);
      expect(res.factors[0].category).toBe('MARKS');
    });

    test('computeMarksRisk handles empty marks gracefully', () => {
      const res = computeMarksRisk([]);
      expect(res.available).toBe(false);
      expect(res.score).toBe(0);
    });

    test('computeAssignmentRisk ignores future and non-targeted assignments', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const assignments = [
        { id: 'a1', status: 'PUBLISHED', dueAt: futureDate, maxMarks: 50, batchYear: '2024-28', section: 'A' },
        { id: 'a2', status: 'DRAFT', dueAt: new Date(Date.now() - 1000), maxMarks: 50 },
        { id: 'a3', status: 'PUBLISHED', dueAt: new Date(Date.now() - 1000), maxMarks: 50, batchYear: '2020-24' }, // Not student's batch
      ];
      const student = { batchYear: '2024-28', section: 'A' };
      const res = computeAssignmentRisk(assignments, [], student);
      expect(res.available).toBe(false);
      expect(res.score).toBe(0);
    });

    test('computeAssignmentRisk penalizes overdue missing assignments', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const assignments = [
        { id: 'a1', status: 'PUBLISHED', dueAt: pastDate, maxMarks: 50, batchYear: '2024-28', section: 'A' }
      ];
      const student = { batchYear: '2024-28', section: 'A' };
      const res = computeAssignmentRisk(assignments, [], student);
      expect(res.available).toBe(true);
      expect(res.score).toBe(40);
      expect(res.factors[0].category).toBe('ASSIGNMENT');
    });

    test('computeProgressionRisk calculates score decline between assessments', () => {
      const marks = [
        { examType: 'INTERNAL1', marksObtained: 45, maxMarks: 50 }, // 90%
        { examType: 'INTERNAL2', marksObtained: 30, maxMarks: 50 }, // 60% (30% drop)
      ];
      const res = computeProgressionRisk(marks);
      expect(res.available).toBe(true);
      expect(res.score).toBe(75); // 30 * 2.5 = 75
      expect(res.factors[0].category).toBe('PROGRESSION');
    });
  });

  // =====================================================
  // 2. INTEGRATION & API ENDPOINTS
  // =====================================================
  describe('2. Risk API Endpoints & Authorization', () => {
    test('GET /api/risk/student/me - Unauthenticated returns 401', async () => {
      const res = await request(app).get('/api/risk/student/me');
      expect(res.status).toBe(401);
    });

    test('GET /api/risk/student/me - Student accesses own risk profile', async () => {
      if (!studentToken) return;
      const res = await request(app)
        .get('/api/risk/student/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('riskScore');
      expect(res.body).toHaveProperty('riskLevel');
      expect(res.body).toHaveProperty('dataCompleteness');
      expect(res.body).toHaveProperty('confidenceLevel');
      expect(Array.isArray(res.body.factors)).toBe(true);
      expect(Array.isArray(res.body.recommendations)).toBe(true);
    });

    test('GET /api/risk/student/me - Denied for FACULTY role', async () => {
      if (!facultyToken) return;
      const res = await request(app)
        .get('/api/risk/student/me')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
    });

    test('GET /api/risk/faculty/students - Faculty lists student risk summary', async () => {
      if (!facultyToken) return;
      const res = await request(app)
        .get('/api/risk/faculty/students')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(Array.isArray(res.body.students)).toBe(true);
    });

    test('GET /api/risk/admin/summary - Admin views system-wide risk summary', async () => {
      if (!adminToken) return;
      const res = await request(app)
        .get('/api/risk/admin/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('counters');
      expect(res.body).toHaveProperty('distribution');
      expect(Array.isArray(res.body.departmentBenchmarks)).toBe(true);
    });

    test('POST /api/risk/admin/recalculate - Admin triggers bulk recalculation', async () => {
      if (!adminToken) return;
      const res = await request(app)
        .post('/api/risk/admin/recalculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count');
    });
  });
});
