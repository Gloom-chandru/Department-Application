import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';

describe('VIT Student Portal Integration Tests', () => {
  let studentToken = '';
  let facultyToken = '';
  let studentId = '';

  beforeAll(async () => {
    // Authenticate Student (Abishek) to fetch token
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'abishek.r@student.velammal.edu.in',
        password: 'password123'
      });
    
    studentToken = studentLogin.body.accessToken;
    studentId = studentLogin.body.user.studentId;

    // Authenticate Faculty (Ramesh Kumar) to fetch token
    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ramesh.kumar@velammal.edu.in',
        password: 'password123'
      });
    
    facultyToken = facultyLogin.body.accessToken;
  });

  describe('1. Authentication Endpoints', () => {
    test('POST /api/auth/login - Success on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'abishek.r@student.velammal.edu.in',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.role).toEqual('STUDENT');
    });

    test('POST /api/auth/login - Failure on invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'abishek.r@student.velammal.edu.in',
          password: 'wrong_password'
        });
      
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('2. Role-Based Access Control (RBAC) Protection', () => {
    test('GET /api/student/profile - Block if token is missing', async () => {
      const res = await request(app).get('/api/student/profile');
      expect(res.statusCode).toEqual(401);
    });

    test('GET /api/student/profile - Allow for STUDENT role', async () => {
      const res = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.rollNo).toEqual('2024AIDS002');
    });

    test('GET /api/student/profile - Deny (403) for FACULTY role', async () => {
      const res = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${facultyToken}`);
      
      expect(res.statusCode).toEqual(403);
    });
  });

  describe('3. Academic Attendance Calculation Logic', () => {
    test('GET /api/student/attendance - Check percentage accuracy', async () => {
      const res = await request(app)
        .get('/api/student/attendance')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('overall');
      expect(res.body).toHaveProperty('subjectWise');

      const { present, total, percentage } = res.body.overall;
      if (total > 0) {
        const expectedPct = parseFloat(((present / total) * 100).toFixed(2));
        expect(percentage).toEqual(expectedPct);
      } else {
        expect(percentage).toEqual(100.0);
      }
    });
  });

  describe('4. Database Unique Constraint Checks', () => {
    test('Database should reject duplicate Attendance records (studentId, subjectId, date)', async () => {
      const subject = await prisma.subject.findFirst();
      const testDate = new Date('2026-10-10T00:00:00.000Z');

      // Create first attendance log
      const first = await prisma.attendance.create({
        data: {
          studentId,
          subjectId: subject.id,
          date: testDate,
          status: 'PRESENT',
          markedById: (await prisma.user.findFirst({ where: { role: 'FACULTY' } })).id
        }
      });

      // Try inserting identical record
      await expect(
        prisma.attendance.create({
          data: {
            studentId,
            subjectId: subject.id,
            date: testDate,
            status: 'ABSENT',
            markedById: first.markedById
          }
        })
      ).rejects.toThrow();

      // Cleanup test date
      await prisma.attendance.delete({ where: { id: first.id } });
    });

    test('Database should reject duplicate Mark records (studentId, subjectId, examType)', async () => {
      const subject = await prisma.subject.findFirst();

      // Find first mark to check if unique constraint holds
      // If we attempt to write another INTERNAL1 mark for the same student/subject, it must fail
      const first = await prisma.mark.findFirst({
        where: { studentId, subjectId: subject.id, examType: 'INTERNAL1' }
      });

      if (first) {
        // Attempt insert
        await expect(
          prisma.mark.create({
            data: {
              studentId,
              subjectId: subject.id,
              examType: 'INTERNAL1',
              maxMarks: 50,
              marksObtained: 40
            }
          })
        ).rejects.toThrow();
      } else {
        // Create one first
        const testMark = await prisma.mark.create({
          data: {
            studentId,
            subjectId: subject.id,
            examType: 'INTERNAL1',
            maxMarks: 50,
            marksObtained: 40
          }
        });

        // Duplicate
        await expect(
          prisma.mark.create({
            data: {
              studentId,
              subjectId: subject.id,
              examType: 'INTERNAL1',
              maxMarks: 50,
              marksObtained: 35
            }
          })
        ).rejects.toThrow();

        // Cleanup
        await prisma.mark.delete({ where: { id: testMark.id } });
      }
    });
  });
});
