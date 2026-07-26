import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { 
  calculateAttendancePercentage, 
  calculateClassesNeededForTarget, 
  calculateClassesCanMiss,
  normalizeMarkPercentage
} from '../src/utils/analyticsMath.js';

describe('Phase 4: Advanced Academic Analytics Tests', () => {
  let adminToken = '';
  let studentToken = '';
  let studentUserId = '';
  let studentId = '';
  
  let facultyToken = '';
  let facultyId = '';
  let facultyUserId = '';
  let unauthorizedFacultyToken = '';
  
  let testSubjectId = '';
  let otherSubjectId = '';

  beforeAll(async () => {
    // Clean up any stale dummy student data
    await prisma.user.deleteMany({
      where: { email: 'dummy.student@student.velammal.edu.in' }
    });

    // 1. Logins
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@velammal.edu.in', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
    studentToken = studentLogin.body.accessToken;
    studentId = studentLogin.body.user.studentId;

    const studentProf = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true }
    });
    studentUserId = studentProf.userId;

    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh.kumar@velammal.edu.in', password: 'password123' });
    facultyToken = facultyLogin.body.accessToken;
    facultyId = facultyLogin.body.user.facultyId;

    const facultyProf = await prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { userId: true }
    });
    facultyUserId = facultyProf.userId;

    // Login an unauthorized faculty for subject access checks
    // Let's check another faculty profile in the db
    const otherFaculty = await prisma.faculty.findFirst({
      where: { id: { not: facultyId } },
      include: { user: true }
    });

    if (otherFaculty) {
      // We will mock check or simulate a login for them
      // To make it simple, we will register/login with seed credentials
      // Let's search faculty seed accounts or login with 'suresh.kumar@velammal.edu.in'
      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'suresh.kumar@velammal.edu.in', password: 'password123' });
      unauthorizedFacultyToken = otherLogin.body.accessToken;
    }

    // Subjects
    const subjects = await prisma.subject.findMany();
    if (subjects.length > 0) {
      testSubjectId = subjects.find(s => s.facultyId === facultyId)?.id || subjects[0].id;
      otherSubjectId = subjects.find(s => s.facultyId !== facultyId)?.id || subjects[0].id;
    }
  });

  describe('1. Attendance & Marks Mathematics', () => {
    test('calculateAttendancePercentage calculates correct percentage', () => {
      expect(calculateAttendancePercentage(15, 20)).toEqual(75.0);
      expect(calculateAttendancePercentage(0, 5)).toEqual(0.0);
    });

    test('calculateAttendancePercentage returns null when T = 0', () => {
      expect(calculateAttendancePercentage(0, 0)).toBeNull();
    });

    test('calculateAttendancePercentage throws on invalid inputs', () => {
      expect(() => calculateAttendancePercentage(-1, 5)).toThrow();
      expect(() => calculateAttendancePercentage(6, 5)).toThrow();
    });

    test('calculateClassesNeededForTarget calculates required consecutive classes', () => {
      // 34/50 = 68%, target = 75%. Needs 14 consecutive present classes:
      // (34+14)/(50+14) = 48/64 = 75%
      expect(calculateClassesNeededForTarget(34, 50, 75)).toEqual(14);
      
      // Already at/above target
      expect(calculateClassesNeededForTarget(40, 50, 75)).toEqual(0);
      
      // Target at 0 is invalid
      expect(() => calculateClassesNeededForTarget(34, 50, 0)).toThrow();
    });

    test('calculateClassesCanMiss calculates safe missable classes count', () => {
      // 40/50 = 80%, target = 75%. Can miss 3 consecutive classes:
      // 40/53 = 75.47% (safe), 40/54 = 74.07% (below)
      expect(calculateClassesCanMiss(40, 50, 75)).toEqual(3);

      // Already below target
      expect(calculateClassesCanMiss(30, 50, 75)).toEqual(0);
    });

    test('normalizeMarkPercentage calculates correct percentage', () => {
      expect(normalizeMarkPercentage(18, 20)).toEqual(90.0);
      expect(normalizeMarkPercentage(72, 100)).toEqual(72.0);
    });

    test('normalizeMarkPercentage throws on invalid maximum values', () => {
      expect(() => normalizeMarkPercentage(5, 0)).toThrow('Maximum marks must be greater than zero');
      expect(() => normalizeMarkPercentage(-5, 100)).toThrow('Obtained marks cannot be negative');
      expect(() => normalizeMarkPercentage(105, 100)).toThrow('Obtained marks cannot exceed maximum');
    });
  });

  describe('2. Endpoint Authorization Rules', () => {
    test('Unauthenticated guest is rejected with 401', async () => {
      const res = await request(app).get('/api/analytics/student/summary');
      expect(res.statusCode).toEqual(401);
    });

    test('Student can access their own summary analytics', async () => {
      const res = await request(app)
        .get('/api/analytics/student/summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.student.rollNo).toEqual('2024AI001');
      expect(res.body.attendance.overall).toHaveProperty('percentage');
      expect(res.body.academics).toHaveProperty('subjectWisePerformance');
    });

    test('Student cannot access admin summary analytics', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(403);
    });

    test('Faculty can access assigned subject analytics', async () => {
      const res = await request(app)
        .get(`/api/analytics/faculty/subject/${testSubjectId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.summary).toHaveProperty('averageNormalizedScore');
    });

    test('Faculty cannot access another faculty\'s subject analytics', async () => {
      if (unauthorizedFacultyToken) {
        const res = await request(app)
          .get(`/api/analytics/faculty/subject/${testSubjectId}`)
          .set('Authorization', `Bearer ${unauthorizedFacultyToken}`);

        expect(res.statusCode).toEqual(403);
      }
    });

    test('Admin can access global summary analytics', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.counters).toHaveProperty('students');
      expect(res.body.overall).toHaveProperty('averageNormalizedScore');
    });
  });

  describe('3. Filters & Data-Quality Handling', () => {
    test('Admin dashboard filter parameters validation', async () => {
      // Valid filter
      const resVal = await request(app)
        .get('/api/analytics/admin/summary?batchYear=2024-2028')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resVal.statusCode).toEqual(200);

      // Invalid filter structure is rejected
      const resInv = await request(app)
        .get('/api/analytics/admin/summary?batchYear=2024_2028')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resInv.statusCode).toEqual(400);
    });

    test('Gracefully handles students with no attendance or marks records without crashing', async () => {
      // 1. Create a dummy student user
      const dummyUser = await prisma.user.create({
        data: {
          name: 'Dummy Student',
          email: 'dummy.student@student.velammal.edu.in',
          passwordHash: 'dummyhash',
          role: 'STUDENT'
        }
      });

      const dummyStudent = await prisma.student.create({
        data: {
          userId: dummyUser.id,
          rollNo: 'DUMMY001',
          batchYear: '2024-2028',
          section: 'A',
          mobileNo: '1234567890',
          guardianContact: '0987654321',
          departmentId: (await prisma.department.findFirst()).id
        }
      });

      // 2. Programmatically sign token to bypass login bcrypt delays/failures
      const dummyToken = jwt.sign({
        id: dummyUser.id,
        name: dummyUser.name,
        email: dummyUser.email,
        role: dummyUser.role,
        studentId: dummyStudent.id,
        facultyId: null,
        departmentId: dummyUser.departmentId || null
      }, config.jwtSecret);

      const res = await request(app)
        .get('/api/analytics/student/summary')
        .set('Authorization', `Bearer ${dummyToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.attendance.overall.percentage).toBeNull(); // Empty attendance returns null
      expect(res.body.academics.subjectWisePerformance).toEqual([]); // Empty marks returns empty array

      // Cleanup
      await prisma.student.delete({ where: { id: dummyStudent.id } });
      await prisma.user.delete({ where: { id: dummyUser.id } });
    });
  });
});
