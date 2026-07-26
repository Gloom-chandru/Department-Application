import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import { sanitizeForAudit, computeDiff } from '../src/utils/audit.js';

describe('Phase 2: Audit Logging Integration & Unit Tests', () => {
  let adminToken = '';
  let studentToken = '';
  let facultyToken = '';
  let testSubjectId = '';
  let testStudentId = '';

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@velammal.edu.in',
        password: 'password123'
      });
    adminToken = adminLogin.body.accessToken;

    // 2. Authenticate Student
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'abishek.r@student.velammal.edu.in',
        password: 'password123'
      });
    studentToken = studentLogin.body.accessToken;
    testStudentId = studentLogin.body.user.studentId;

    // 3. Authenticate Faculty
    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ramesh.kumar@velammal.edu.in',
        password: 'password123'
      });
    facultyToken = facultyLogin.body.accessToken;

    // Fetch a valid subject taught by Ramesh Kumar
    const subjects = await prisma.subject.findMany();
    if (subjects.length > 0) {
      testSubjectId = subjects[0].id;
    }
  });

  describe('1. Role-Based Access Control (RBAC) Protection', () => {
    test('Unauthenticated -> Audit API = 401 Unauthorized', async () => {
      const res = await request(app).get('/api/audit');
      expect(res.statusCode).toEqual(401);
    });

    test('STUDENT -> Audit API = 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.statusCode).toEqual(403);
    });

    test('FACULTY -> Audit API = 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.statusCode).toEqual(403);
    });

    test('ADMIN -> Audit API = 200 Allowed', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('logs');
      expect(res.body).toHaveProperty('pagination');
    });
  });

  describe('2. Sanitization Logic Validation', () => {
    test('Correct sensitive-field redaction', () => {
      const payload = {
        password: 'myPassword123',
        passwordHash: 'sha256-hash-value',
        hashedPassword: 'hash',
        currentPassword: 'old',
        newPassword: 'new',
        token: 'jwt-token-string',
        accessToken: 'access-string',
        refreshToken: 'refresh-string',
        jwtSecret: 'key',
        apiKey: 'api-key-1234',
        authorization: 'Bearer foo',
        credential: 'user-credentials',
        databasePassword: 'db-password'
      };

      const sanitized = sanitizeForAudit(payload);
      for (const key of Object.keys(payload)) {
        expect(sanitized[key]).toEqual('[REDACTED]');
      }
    });

    test('Harmless non-sensitive fields remain unchanged', () => {
      const payload = {
        name: 'Velammal Principal',
        email: 'admin@velammal.edu.in',
        rollNo: '2024CSE001',
        mobileNo: '9876543210',
        section: 'A',
        batchYear: '2024-28'
      };

      const sanitized = sanitizeForAudit(payload);
      expect(sanitized).toEqual(payload);
    });

    test('Handles null, Date, arrays, and nested structures', () => {
      const testDate = new Date();
      const payload = {
        user: {
          name: 'Ramesh',
          secretKey: 'my-secret',
        },
        items: [
          { id: 1, password: 'foo' },
          { id: 2, password: 'bar' }
        ],
        timestamp: testDate,
        value: null
      };

      const sanitized = sanitizeForAudit(payload);
      expect(sanitized.user.name).toEqual('Ramesh');
      expect(sanitized.user.secretKey).toEqual('[REDACTED]');
      expect(sanitized.items[0].password).toEqual('[REDACTED]');
      expect(sanitized.items[1].password).toEqual('[REDACTED]');
      expect(sanitized.timestamp).toEqual(testDate.toISOString());
      expect(sanitized.value).toBeNull();
    });
  });

  describe('3. Transaction Rollback & Audit Atomicity', () => {
    test('Simulated Marks Failure rolls back the entire transaction', async () => {
      // Find initial count of logs
      const initialLogs = await prisma.auditLog.count();

      // Enter marks exceeding maxMarks which raises an exception
      const res = await request(app)
        .post('/api/faculty/marks')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          examType: 'INTERNAL1',
          maxMarks: 50,
          records: [
            { studentId: testStudentId, marksObtained: 99 } // Invalid: 99 > 50
          ]
        });

      expect(res.statusCode).toEqual(500);

      // Confirm no audit logs were created
      const finalLogs = await prisma.auditLog.count();
      expect(finalLogs).toEqual(initialLogs);
    });
  });

  describe('4. No-Op Update Filtering', () => {
    test('Entering identical marks does not generate new audit log records', async () => {
      // 1. Enter initial marks
      await request(app)
        .post('/api/faculty/marks')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          examType: 'INTERNAL1',
          maxMarks: 100,
          records: [
            { studentId: testStudentId, marksObtained: 85 }
          ]
        });

      // Find logs count before no-op update
      const beforeLogs = await prisma.auditLog.count();

      // 2. Submit identical marks
      await request(app)
        .post('/api/faculty/marks')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          examType: 'INTERNAL1',
          maxMarks: 100,
          records: [
            { studentId: testStudentId, marksObtained: 85 } // Same mark
          ]
        });

      // Find logs count after
      const afterLogs = await prisma.auditLog.count();
      expect(afterLogs).toEqual(beforeLogs);
    });
  });

  describe('5. Pagination Protection & Capping', () => {
    test('Limit request is capped at 100', async () => {
      const res = await request(app)
        .get('/api/audit?limit=1000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.pagination.limit).toEqual(100);
    });

    test('Invalid filter inputs return 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/audit?startDate=invalid-date-format')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(400);
    });
  });
});
