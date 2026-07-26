import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;

describe('Phase 7: Timetable & Schedule Management Integration Tests', () => {
  let adminToken, facultyToken, studentToken, otherFacultyToken, otherStudentToken;
  let adminId, facultyId, studentId, otherFacultyId, otherStudentId;
  let deptId, otherDeptId, subjectId, otherSubjectId, facultyProfileId, otherFacultyProfileId;
  let studentProfileId;

  // Period template IDs
  let period1Id, period2Id, breakPeriodId, period3Id, period4Id;

  // Room IDs
  let roomId;

  // Schedule IDs
  let draftScheduleId;

  beforeAll(async () => {
    const hash = await bcrypt.hash('TestPass123!', 10);

    // Clean up any lingering test data from previous runs
    await prisma.timetableSlot.deleteMany({ where: { schedule: { department: { code: { in: ['TTD', 'OTD'] } } } } });
    await prisma.timetableSchedule.deleteMany({ where: { department: { code: { in: ['TTD', 'OTD'] } } } });
    await prisma.student.deleteMany({ where: { rollNo: { in: ['TT001', 'TT002'] } } });
    await prisma.subject.deleteMany({ where: { department: { code: { in: ['TTD', 'OTD'] } } } });
    await prisma.faculty.deleteMany({ where: { user: { email: { startsWith: 'tt_' } } } });
    await prisma.periodTemplate.deleteMany({ where: { periodNumber: { gte: 100 } } });
    await prisma.room.deleteMany({ where: { department: { code: { in: ['TTD', 'OTD'] } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'tt_' } } });
    await prisma.department.deleteMany({ where: { code: { in: ['TTD', 'OTD'] } } });

    // Create departments
    const dept = await prisma.department.create({ data: { name: 'Timetable Test Dept', code: 'TTD' } });
    deptId = dept.id;
    const otherDept = await prisma.department.create({ data: { name: 'Other Test Dept', code: 'OTD' } });
    otherDeptId = otherDept.id;

    // Create admin
    const admin = await prisma.user.create({ data: { name: 'TT Admin', email: 'tt_admin@test.com', passwordHash: hash, role: 'ADMIN', departmentId: deptId } });
    adminId = admin.id;
    adminToken = jwt.sign({ id: admin.id, role: 'ADMIN', departmentId: deptId }, JWT_SECRET, { expiresIn: '1h' });

    // Create faculty
    const facUser = await prisma.user.create({ data: { name: 'TT Faculty', email: 'tt_fac@test.com', passwordHash: hash, role: 'FACULTY', departmentId: deptId } });
    facultyId = facUser.id;
    const facProfile = await prisma.faculty.create({ data: { userId: facUser.id, departmentId: deptId, designation: 'AP' } });
    facultyProfileId = facProfile.id;
    facultyToken = jwt.sign({ id: facUser.id, role: 'FACULTY', departmentId: deptId }, JWT_SECRET, { expiresIn: '1h' });

    // Create other faculty (same dept)
    const otherFacUser = await prisma.user.create({ data: { name: 'TT OtherFac', email: 'tt_ofac@test.com', passwordHash: hash, role: 'FACULTY', departmentId: deptId } });
    otherFacultyId = otherFacUser.id;
    const otherFacProfile = await prisma.faculty.create({ data: { userId: otherFacUser.id, departmentId: deptId, designation: 'AP' } });
    otherFacultyProfileId = otherFacProfile.id;
    otherFacultyToken = jwt.sign({ id: otherFacUser.id, role: 'FACULTY', departmentId: deptId }, JWT_SECRET, { expiresIn: '1h' });

    // Create student
    const stuUser = await prisma.user.create({ data: { name: 'TT Student', email: 'tt_stu@test.com', passwordHash: hash, role: 'STUDENT', departmentId: deptId } });
    studentId = stuUser.id;
    const stuProfile = await prisma.student.create({
      data: { userId: stuUser.id, rollNo: 'TT001', batchYear: '2024-28', section: 'A', mobileNo: '9000000001', guardianContact: '9000000002', departmentId: deptId }
    });
    studentProfileId = stuProfile.id;
    studentToken = jwt.sign({ id: stuUser.id, role: 'STUDENT', departmentId: deptId }, JWT_SECRET, { expiresIn: '1h' });

    // Create other student (different dept)
    const otherStuUser = await prisma.user.create({ data: { name: 'TT OtherStu', email: 'tt_ostu@test.com', passwordHash: hash, role: 'STUDENT', departmentId: otherDeptId } });
    otherStudentId = otherStuUser.id;
    await prisma.student.create({
      data: { userId: otherStuUser.id, rollNo: 'TT002', batchYear: '2024-28', section: 'A', mobileNo: '9000000003', guardianContact: '9000000004', departmentId: otherDeptId }
    });
    otherStudentToken = jwt.sign({ id: otherStuUser.id, role: 'STUDENT', departmentId: otherDeptId }, JWT_SECRET, { expiresIn: '1h' });

    // Create subjects
    const sub = await prisma.subject.create({ data: { name: 'TT Subject 1', code: 'TTS1', semester: 4, departmentId: deptId, facultyId: facultyProfileId } });
    subjectId = sub.id;
    const otherSub = await prisma.subject.create({ data: { name: 'TT Subject 2', code: 'TTS2', semester: 4, departmentId: deptId, facultyId: otherFacultyProfileId } });
    otherSubjectId = otherSub.id;

    // Create period templates
    const p1 = await prisma.periodTemplate.create({ data: { periodNumber: 101, name: 'Test P1', startTime: '09:00', endTime: '09:50', isBreak: false } });
    period1Id = p1.id;
    const p2 = await prisma.periodTemplate.create({ data: { periodNumber: 102, name: 'Test P2', startTime: '09:50', endTime: '10:40', isBreak: false } });
    period2Id = p2.id;
    const br = await prisma.periodTemplate.create({ data: { periodNumber: 103, name: 'Test Break', startTime: '10:40', endTime: '10:55', isBreak: true } });
    breakPeriodId = br.id;
    const p3 = await prisma.periodTemplate.create({ data: { periodNumber: 104, name: 'Test P3', startTime: '10:55', endTime: '11:45', isBreak: false } });
    period3Id = p3.id;
    const p4 = await prisma.periodTemplate.create({ data: { periodNumber: 105, name: 'Test P4', startTime: '11:45', endTime: '12:35', isBreak: false } });
    period4Id = p4.id;

    // Create a room
    const room = await prisma.room.create({ data: { roomNo: 'TT-R101', name: 'Test Room 101', type: 'CLASSROOM', departmentId: deptId } });
    roomId = room.id;

    // Set current_semester setting
    await prisma.setting.upsert({
      where: { key: 'current_semester' },
      update: { value: '4' },
      create: { key: 'current_semester', value: '4' }
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.timetableSlot.deleteMany({ where: { schedule: { department: { code: { in: ['TTD', 'OTD'] } } } } }).catch(() => {});
    await prisma.timetableSchedule.deleteMany({ where: { department: { code: { in: ['TTD', 'OTD'] } } } }).catch(() => {});
    await prisma.room.deleteMany({ where: { roomNo: { startsWith: 'TT-' } } }).catch(() => {});
    await prisma.periodTemplate.deleteMany({ where: { periodNumber: { gte: 101, lte: 110 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: 'tt_' } } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { user: { email: { startsWith: 'tt_' } } } }).catch(() => {});
    await prisma.subject.deleteMany({ where: { code: { in: ['TTS1', 'TTS2'] } } }).catch(() => {});
    await prisma.student.deleteMany({ where: { rollNo: { in: ['TT001', 'TT002'] } } }).catch(() => {});
    await prisma.faculty.deleteMany({ where: { user: { email: { startsWith: 'tt_' } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: 'tt_' } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { code: { in: ['TTD', 'OTD'] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  // Helper to clean schedules between tests
  async function cleanSchedules() {
    await prisma.timetableSlot.deleteMany({ where: { schedule: { departmentId: { in: [deptId, otherDeptId] } } } });
    await prisma.timetableSchedule.deleteMany({ where: { departmentId: { in: [deptId, otherDeptId] } } });
  }

  // ==================== 1. Authorization ====================
  describe('1. Authorization', () => {
    test('Unauthenticated request is rejected with 401', async () => {
      const res = await request(app).post('/api/timetable/schedules');
      expect(res.statusCode).toEqual(401);
    });

    test('Student cannot create schedules (403)', async () => {
      const res = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Test', effectiveFrom: '2026-08-01' });
      expect(res.statusCode).toEqual(403);
    });

    test('Faculty cannot create schedules (403)', async () => {
      const res = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Test', effectiveFrom: '2026-08-01' });
      expect(res.statusCode).toEqual(403);
    });

    test('Admin can create schedules', async () => {
      const res = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Auth Test Schedule', effectiveFrom: '2026-08-01' });
      expect(res.statusCode).toEqual(201);
      expect(res.body.status).toEqual('DRAFT');
      // Cleanup
      await prisma.timetableSchedule.delete({ where: { id: res.body.id } });
    });
  });

  // ==================== 2. PeriodTemplate ====================
  describe('2. PeriodTemplate Validation', () => {
    test('Valid period creation succeeds', async () => {
      const res = await request(app)
        .post('/api/timetable/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodNumber: 106, name: 'Extra P', startTime: '14:00', endTime: '14:50', isBreak: false });
      expect(res.statusCode).toEqual(201);
      expect(res.body.periodNumber).toEqual(106);
      // Cleanup
      await prisma.periodTemplate.delete({ where: { id: res.body.id } });
    });

    test('Invalid HH:mm format is rejected', async () => {
      const res = await request(app)
        .post('/api/timetable/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodNumber: 107, name: 'Bad', startTime: '9:00', endTime: '9:50' });
      expect(res.statusCode).toEqual(400);
    });

    test('startTime >= endTime is rejected', async () => {
      const res = await request(app)
        .post('/api/timetable/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodNumber: 107, name: 'Bad', startTime: '10:00', endTime: '09:50' });
      expect(res.statusCode).toEqual(400);
    });

    test('Overlapping period time ranges are rejected', async () => {
      const res = await request(app)
        .post('/api/timetable/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodNumber: 107, name: 'Overlap', startTime: '09:30', endTime: '10:20' });
      expect(res.statusCode).toEqual(409);
    });

    test('Break period cannot receive a timetable slot', async () => {
      await cleanSchedules();
      const schedRes = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Break Test', effectiveFrom: '2026-08-01' });
      const sid = schedRes.body.id;

      const slotRes = await request(app)
        .post(`/api/timetable/schedules/${sid}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: breakPeriodId, endPeriodId: breakPeriodId });
      expect(slotRes.statusCode).toEqual(409);
      expect(slotRes.body.errors[0]).toContain('break');
      await cleanSchedules();
    });
  });

  // ==================== 3. Room ====================
  describe('3. Room Validation', () => {
    test('Valid room creation succeeds', async () => {
      const res = await request(app)
        .post('/api/timetable/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roomNo: 'TT-R200', name: 'Test Lab', type: 'LAB', departmentId: deptId });
      expect(res.statusCode).toEqual(201);
      await prisma.room.delete({ where: { id: res.body.id } });
    });

    test('Duplicate roomNo is rejected', async () => {
      const res = await request(app)
        .post('/api/timetable/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roomNo: 'TT-R101' });
      expect(res.statusCode).toEqual(409);
    });

    test('Room deletion blocked when referenced by slot', async () => {
      await cleanSchedules();
      const sched = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Room Del Test', effectiveFrom: '2026-08-01T00:00:00.000Z', status: 'DRAFT', createdByUserId: adminId }
      });
      await prisma.timetableSlot.create({
        data: { scheduleId: sched.id, subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id, roomId }
      });

      const res = await request(app)
        .delete(`/api/timetable/rooms/${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(409);
      await cleanSchedules();
    });
  });

  // ==================== 4. Subject Validation ====================
  describe('4. Subject Validation', () => {
    test('Wrong semester subject is rejected', async () => {
      await cleanSchedules();
      // Create a subject with semester 6 instead of 4
      const wrongSemSub = await prisma.subject.create({
        data: { name: 'Wrong Sem', code: 'TTSWS', semester: 6, departmentId: deptId, facultyId: facultyProfileId }
      });

      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Sem Test', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: wrongSemSub.id, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });
      expect(res.statusCode).toEqual(409);
      expect(res.body.errors[0]).toContain('semester mismatch');

      await cleanSchedules();
      await prisma.subject.delete({ where: { id: wrongSemSub.id } });
    });

    test('Wrong department subject is rejected', async () => {
      await cleanSchedules();
      const wrongDeptSub = await prisma.subject.create({
        data: { name: 'Wrong Dept', code: 'TTSWD', semester: 4, departmentId: otherDeptId, facultyId: otherFacultyProfileId }
      });

      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Dept Test', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: wrongDeptSub.id, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });
      expect(res.statusCode).toEqual(409);
      expect(res.body.errors[0]).toContain('department mismatch');

      await cleanSchedules();
      await prisma.subject.delete({ where: { id: wrongDeptSub.id } });
    });
  });

  // ==================== 5. Class Group Conflict ====================
  describe('5. Class Group Conflict', () => {
    test('Overlapping class group slots rejected', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Class Conflict', effectiveFrom: '2026-08-01' });

      // First slot at period 1
      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      // Second slot at same period (different subject)
      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });
      expect(res.statusCode).toEqual(409);
      await cleanSchedules();
    });

    test('Non-overlapping class group slots are allowed', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'No Conflict', effectiveFrom: '2026-08-01' });

      const s1 = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });
      expect(s1.statusCode).toEqual(201);

      const s2 = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period2Id, endPeriodId: period2Id });
      expect(s2.statusCode).toEqual(201);
      await cleanSchedules();
    });
  });

  // ==================== 6. Faculty Conflict ====================
  describe('6. Faculty Conflict (Cross-Semester)', () => {
    test('Same faculty same time different semesters detected', async () => {
      await cleanSchedules();
      // Create a subject in semester 6 taught by the same faculty
      const sem6Sub = await prisma.subject.create({
        data: { name: 'Sem6 Sub', code: 'TTS6', semester: 6, departmentId: deptId, facultyId: facultyProfileId }
      });

      // Schedule A: semester 4
      const schedA = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Fac Conflict A', effectiveFrom: '2026-08-01' });

      await request(app)
        .post(`/api/timetable/schedules/${schedA.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      // Publish schedule A
      await prisma.timetableSchedule.update({ where: { id: schedA.body.id }, data: { status: 'PUBLISHED' } });

      // Schedule B: semester 6
      const schedB = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'B', semester: 6, name: 'Fac Conflict B', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${schedB.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: sem6Sub.id, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });
      expect(res.statusCode).toEqual(409);
      expect(res.body.errors[0]).toContain('Faculty conflict');

      await cleanSchedules();
      await prisma.subject.delete({ where: { id: sem6Sub.id } });
    });

    test('Different faculty at same time is allowed', async () => {
      await cleanSchedules();
      const schedA = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Diff Fac A', effectiveFrom: '2026-08-01' });

      await request(app)
        .post(`/api/timetable/schedules/${schedA.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      await prisma.timetableSchedule.update({ where: { id: schedA.body.id }, data: { status: 'PUBLISHED' } });

      const schedB = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'B', semester: 4, name: 'Diff Fac B', effectiveFrom: '2026-08-01' });

      // otherSubject is taught by otherFaculty — no conflict
      const res = await request(app)
        .post(`/api/timetable/schedules/${schedB.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });
      expect(res.statusCode).toEqual(201);
      await cleanSchedules();
    });
  });

  // ==================== 7. Room Conflict ====================
  describe('7. Room Conflict', () => {
    test('Same room same time across schedules detected', async () => {
      await cleanSchedules();
      const schedA = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Room Conflict A', effectiveFrom: '2026-08-01' });

      await request(app)
        .post(`/api/timetable/schedules/${schedA.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id, roomId });

      await prisma.timetableSchedule.update({ where: { id: schedA.body.id }, data: { status: 'PUBLISHED' } });

      const schedB = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'B', semester: 4, name: 'Room Conflict B', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${schedB.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id, roomId });
      expect(res.statusCode).toEqual(409);
      expect(res.body.errors[0]).toContain('Room conflict');
      await cleanSchedules();
    });

    test('Same room different time is allowed', async () => {
      await cleanSchedules();
      const schedA = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Room OK A', effectiveFrom: '2026-08-01' });

      await request(app)
        .post(`/api/timetable/schedules/${schedA.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id, roomId });

      await prisma.timetableSchedule.update({ where: { id: schedA.body.id }, data: { status: 'PUBLISHED' } });

      const schedB = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'B', semester: 4, name: 'Room OK B', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${schedB.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period3Id, endPeriodId: period3Id, roomId });
      expect(res.statusCode).toEqual(201);
      await cleanSchedules();
    });
  });

  // ==================== 8. Multi-Period ====================
  describe('8. Multi-Period Lab Sessions', () => {
    test('Valid double-period lab succeeds', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Lab Test', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 2, startPeriodId: period1Id, endPeriodId: period2Id });
      expect(res.statusCode).toEqual(201);
      await cleanSchedules();
    });

    test('Partial period overlap with another class fails', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Overlap Lab', effectiveFrom: '2026-08-01' });

      // Single period at P1
      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId: otherSubjectId, dayOfWeek: 2, startPeriodId: period1Id, endPeriodId: period1Id });

      // Lab P1-P2 should fail because P1 is already occupied
      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 2, startPeriodId: period1Id, endPeriodId: period2Id });
      expect(res.statusCode).toEqual(409);
      await cleanSchedules();
    });

    test('Period range spanning a break is rejected', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Break Span', effectiveFrom: '2026-08-01' });

      // P2 (102) to P3 (104) spans the break (103)
      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 2, startPeriodId: period2Id, endPeriodId: period3Id });
      expect(res.statusCode).toEqual(409);
      expect(res.body.errors[0]).toContain('break');
      await cleanSchedules();
    });
  });

  // ==================== 9. Bulk Operations ====================
  describe('9. Bulk Operations', () => {
    test('Atomic bulk success', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Bulk Test', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots/bulk`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slots: [
            { subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id },
            { subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period2Id, endPeriodId: period2Id }
          ]
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toContain('2');
      await cleanSchedules();
    });

    test('DB conflict rolls back entire batch', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Bulk Fail DB', effectiveFrom: '2026-08-01' });

      // Pre-create a slot at P1 Monday
      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      // Bulk includes a conflict at P1 Monday
      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots/bulk`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slots: [
            { subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period2Id, endPeriodId: period2Id },
            { subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id } // conflict
          ]
        });
      expect(res.statusCode).toEqual(409);

      // Verify no new slots were created (only the pre-existing one)
      const count = await prisma.timetableSlot.count({ where: { scheduleId: sched.body.id } });
      expect(count).toEqual(1); // only original
      await cleanSchedules();
    });

    test('Internal payload conflict rolls back entire batch', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Bulk Int Conflict', effectiveFrom: '2026-08-01' });

      // Two slots in the same batch both at Monday P1
      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots/bulk`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slots: [
            { subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id },
            { subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id }
          ]
        });
      expect(res.statusCode).toEqual(409);
      expect(res.body.conflicts.length).toBeGreaterThan(0);

      const count = await prisma.timetableSlot.count({ where: { scheduleId: sched.body.id } });
      expect(count).toEqual(0);
      await cleanSchedules();
    });
  });

  // ==================== 10. Schedule Lifecycle ====================
  describe('10. Schedule Lifecycle', () => {
    test('Draft schedule is hidden from Student timetable view', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Draft Hidden', effectiveFrom: '2026-01-01' });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      const res = await request(app)
        .get('/api/timetable/student?semester=4')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.schedule).toBeNull();
      await cleanSchedules();
    });

    test('Conflict-free schedule can be published', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Publish OK', effectiveFrom: '2026-01-01' });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(200);

      const updated = await prisma.timetableSchedule.findUnique({ where: { id: sched.body.id } });
      expect(updated.status).toEqual('PUBLISHED');
      await cleanSchedules();
    });

    test('Empty schedule cannot be published', async () => {
      await cleanSchedules();
      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Empty Pub', effectiveFrom: '2026-08-01' });

      const res = await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(409);
      await cleanSchedules();
    });

    test('Archived schedule is not treated as current student view', async () => {
      await cleanSchedules();
      const sched = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Archived', effectiveFrom: '2026-01-01T00:00:00.000Z', status: 'ARCHIVED', createdByUserId: adminId }
      });
      await prisma.timetableSlot.create({
        data: { scheduleId: sched.id, subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id }
      });

      const res = await request(app)
        .get('/api/timetable/student?semester=4')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.schedule).toBeNull();
      await cleanSchedules();
    });

    test('Overlapping published schedule is prevented at publication', async () => {
      await cleanSchedules();
      // Create and publish schedule A
      const schedA = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Overlap Pub A', effectiveFrom: '2026-01-01T00:00:00.000Z', status: 'DRAFT', createdByUserId: adminId }
      });
      await prisma.timetableSlot.create({
        data: { scheduleId: schedA.id, subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id }
      });
      await prisma.timetableSchedule.update({ where: { id: schedA.id }, data: { status: 'PUBLISHED' } });

      // Create schedule B for same class group and try to publish
      const schedB = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Overlap Pub B', effectiveFrom: '2026-06-01T00:00:00.000Z', status: 'DRAFT', createdByUserId: adminId }
      });
      await prisma.timetableSlot.create({
        data: { scheduleId: schedB.id, subjectId: otherSubjectId, dayOfWeek: 2, startPeriodId: period1Id, endPeriodId: period1Id }
      });

      const res = await request(app)
        .post(`/api/timetable/schedules/${schedB.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(409);
      expect(res.body.conflicts.some(c => c.errors[0].includes('overlap'))).toBe(true);
      await cleanSchedules();
    });
  });

  // ==================== 11. Student View ====================
  describe('11. Student View', () => {
    test('Student sees only own department/batch/section timetable', async () => {
      await cleanSchedules();
      // Create and publish for student's class group
      const sched = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Student View', effectiveFrom: '2026-01-01T00:00:00.000Z', status: 'PUBLISHED', createdByUserId: adminId }
      });
      await prisma.timetableSlot.create({
        data: { scheduleId: sched.id, subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id }
      });

      // Our student should see it
      const res = await request(app)
        .get('/api/timetable/student?semester=4')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.schedule).not.toBeNull();
      expect(res.body.slots.length).toEqual(1);

      // Other dept student should NOT see it
      const otherRes = await request(app)
        .get('/api/timetable/student?semester=4')
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(otherRes.statusCode).toEqual(200);
      expect(otherRes.body.schedule).toBeNull();
      await cleanSchedules();
    });

    test('Default semester from settings works when not specified', async () => {
      await cleanSchedules();
      const sched = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Default Sem', effectiveFrom: '2026-01-01T00:00:00.000Z', status: 'PUBLISHED', createdByUserId: adminId }
      });
      await prisma.timetableSlot.create({
        data: { scheduleId: sched.id, subjectId, dayOfWeek: 3, startPeriodId: period1Id, endPeriodId: period1Id }
      });

      // Don't specify semester — should use current_semester=4
      const res = await request(app)
        .get('/api/timetable/student')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.semester).toEqual(4);
      expect(res.body.slots.length).toEqual(1);
      await cleanSchedules();
    });
  });

  // ==================== 12. Faculty View ====================
  describe('12. Faculty View', () => {
    test('Faculty sees only own teaching schedule', async () => {
      await cleanSchedules();
      const sched = await prisma.timetableSchedule.create({
        data: { departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Faculty View', effectiveFrom: '2026-01-01T00:00:00.000Z', status: 'PUBLISHED', createdByUserId: adminId }
      });
      // Slot for faculty
      await prisma.timetableSlot.create({
        data: { scheduleId: sched.id, subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id }
      });
      // Slot for other faculty
      await prisma.timetableSlot.create({
        data: { scheduleId: sched.id, subjectId: otherSubjectId, dayOfWeek: 1, startPeriodId: period2Id, endPeriodId: period2Id }
      });

      const res = await request(app)
        .get('/api/timetable/faculty')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.slots.length).toEqual(1);
      expect(res.body.slots[0].subject.code).toEqual('TTS1');
      await cleanSchedules();
    });
  });

  // ==================== 13. Notifications ====================
  describe('13. Notifications', () => {
    test('Draft slot edits produce no student notification', async () => {
      await cleanSchedules();
      await prisma.notification.deleteMany({ where: { userId: studentId, type: 'TIMETABLE_CHANGED' } });

      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Draft Notif', effectiveFrom: '2026-08-01' });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      const notifs = await prisma.notification.count({ where: { userId: studentId, type: 'TIMETABLE_CHANGED' } });
      expect(notifs).toEqual(0);
      await cleanSchedules();
    });

    test('Publication produces consolidated notification for student and faculty', async () => {
      await cleanSchedules();
      await prisma.notification.deleteMany({ where: { userId: { in: [studentId, facultyId] }, type: 'TIMETABLE_CHANGED' } });

      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Pub Notif', effectiveFrom: '2026-01-01' });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const studentNotifs = await prisma.notification.count({ where: { userId: studentId, type: 'TIMETABLE_CHANGED' } });
      expect(studentNotifs).toEqual(1);

      const facultyNotifs = await prisma.notification.count({ where: { userId: facultyId, type: 'TIMETABLE_CHANGED' } });
      expect(facultyNotifs).toEqual(1);
      await cleanSchedules();
    });
  });

  // ==================== 14. Audit ====================
  describe('14. Audit', () => {
    test('Publication event is logged', async () => {
      await cleanSchedules();
      await prisma.auditLog.deleteMany({ where: { actorUserId: adminId, action: 'TIMETABLE_PUBLISHED' } });

      const sched = await request(app)
        .post('/api/timetable/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: deptId, batchYear: '2024-28', section: 'A', semester: 4, name: 'Audit Test', effectiveFrom: '2026-01-01' });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/slots`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectId, dayOfWeek: 1, startPeriodId: period1Id, endPeriodId: period1Id });

      await request(app)
        .post(`/api/timetable/schedules/${sched.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const logs = await prisma.auditLog.findMany({ where: { actorUserId: adminId, action: 'TIMETABLE_PUBLISHED' } });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      await cleanSchedules();
    });
  });
});
