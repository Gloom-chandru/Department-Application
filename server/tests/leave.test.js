import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import storageAdapter from '../src/utils/storageService.js';
import fs from 'fs';
import path from 'path';

describe('Phase 6: Leave & OD Management System Integration Tests', () => {
  let adminToken = '';
  
  let facultyToken = '';
  let facultyId = '';
  let facultyUserId = '';
  
  let otherFacultyToken = '';
  let otherFacultyId = '';
  let otherFacultyUserId = '';
  
  let studentToken = '';
  let studentId = '';
  let studentUserId = '';
  let studentDeptId = '';
  
  let otherStudentToken = '';
  let otherStudentId = '';

  let diffDeptFacultyId = '';
  let diffDeptFacultyUserId = '';
  let diffDeptId = '';

  let pdfFileBuffer = Buffer.from('%PDF-1.4 ... mock pdf content ...');
  let invalidFileBuffer = Buffer.from('EXE spoof content');

  beforeAll(async () => {
    // 1. Authenticate users
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@velammal.edu.in', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh.kumar@velammal.edu.in', password: 'password123' });
    facultyToken = facultyLogin.body.accessToken;
    facultyId = facultyLogin.body.user.facultyId;
    facultyUserId = facultyLogin.body.user.id;

    const otherFacultyLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.lakshmi@velammal.edu.in', password: 'password123' });
    otherFacultyToken = otherFacultyLogin.body.accessToken;
    otherFacultyId = otherFacultyLogin.body.user.facultyId;
    otherFacultyUserId = otherFacultyLogin.body.user.id;

    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
    studentToken = studentLogin.body.accessToken;
    studentId = studentLogin.body.user.studentId;
    
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });
    studentUserId = student.userId;
    studentDeptId = student.departmentId;

    const otherStudentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'santhosh.c@student.velammal.edu.in', password: 'password123' });
    otherStudentToken = otherStudentLogin.body.accessToken;
    otherStudentId = otherStudentLogin.body.user.studentId;

    // Create a mock faculty in a different department
    diffDeptId = (await prisma.department.create({
      data: { name: 'Mock Mechanical', code: 'MECH_MOCK' }
    })).id;

    const diffUser = await prisma.user.create({
      data: {
        name: 'Mech Reviewer',
        email: 'mech.reviewer@velammal.edu.in',
        passwordHash: 'dummy',
        role: 'FACULTY',
        departmentId: diffDeptId
      }
    });
    diffDeptFacultyUserId = diffUser.id;

    const diffFac = await prisma.faculty.create({
      data: {
        userId: diffUser.id,
        departmentId: diffDeptId,
        designation: 'Assistant Professor'
      }
    });
    diffDeptFacultyId = diffFac.id;
  });

  afterAll(async () => {
    // Cleanup mock different department faculty
    await prisma.approvalHistory.deleteMany({
      where: { request: { studentId: { in: [studentId, otherStudentId] } } }
    });
    await prisma.leaveODRequest.deleteMany({
      where: { studentId: { in: [studentId, otherStudentId] } }
    });
    if (diffDeptFacultyId) {
      await prisma.faculty.delete({ where: { id: diffDeptFacultyId } });
    }
    if (diffDeptFacultyUserId) {
      await prisma.user.delete({ where: { id: diffDeptFacultyUserId } });
    }
    if (diffDeptId) {
      await prisma.department.delete({ where: { id: diffDeptId } });
    }
  });

  describe('1. Reviewer Selection & Department Verification', () => {
    test('Student can list available reviewers in their own department', async () => {
      const res = await request(app)
        .get('/api/requests/reviewers')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      const ids = res.body.map(f => f.id);
      expect(ids).toContain(facultyId);
      expect(ids).toContain(otherFacultyId);
      expect(ids).not.toContain(diffDeptFacultyId);

      // Verify sensitive account metadata is excluded
      const first = res.body[0];
      expect(first.passwordHash).toBeUndefined();
      expect(first.password).toBeUndefined();
    });

    test('Student cannot submit a request selecting a reviewer from another department', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'I need leave for personal work.',
          startDate: '2026-08-15',
          endDate: '2026-08-17',
          reviewerFacultyId: diffDeptFacultyId
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Temporary reviewer-selection policy');
    });
  });

  describe('2. Leave & OD Submissions, Date Rules, and Document Security', () => {
    test('Student can submit a valid Leave request without an attachment', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'This is a valid leave reason of at least ten characters.',
          startDate: '2026-08-10',
          endDate: '2026-08-12',
          reviewerFacultyId: facultyId
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.status).toEqual('PENDING');
      expect(res.body.requestType).toEqual('LEAVE');
    });

    test('Same-day requests are allowed', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'OD',
          reason: 'This is a valid same day request reason text.',
          startDate: todayStr,
          endDate: todayStr,
          reviewerFacultyId: facultyId
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.status).toEqual('PENDING');
    });

    test('Past-date (retrospective) requests are rejected', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'This is a retrospective leave request.',
          startDate: '2020-01-01',
          endDate: '2020-01-02',
          reviewerFacultyId: facultyId
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Past-date requests are not allowed');
    });

    test('Invalid date ranges (endDate before startDate) are rejected', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'This has an invalid reverse date order.',
          startDate: '2026-09-10',
          endDate: '2026-09-08',
          reviewerFacultyId: facultyId
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('startDate cannot be after endDate');
    });
  });

  describe('3. Date Overlap Protection', () => {
    let baseRequestId = '';

    beforeAll(async () => {
      // Clear previous requests first to prevent test state cross-pollution
      await prisma.approvalHistory.deleteMany({
        where: { request: { studentId } }
      });
      await prisma.leaveODRequest.deleteMany({
        where: { studentId }
      });

      // Create a base pending request for Aug 20 - Aug 25
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'Base overlapping request for dates.',
          startDate: '2026-08-20',
          endDate: '2026-08-25',
          reviewerFacultyId: facultyId
        });
      baseRequestId = res.body.id;
    });

    test('Student cannot submit a request overlapping a PENDING request', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'OD',
          reason: 'This overlaps the middle of the pending request.',
          startDate: '2026-08-22',
          endDate: '2026-08-23',
          reviewerFacultyId: facultyId
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Overlap detected');
    });

    test('Cancelled requests do not block future requests for the same date', async () => {
      // Cancel the base request first
      await request(app)
        .patch(`/api/requests/${baseRequestId}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Now request for overlapping dates should succeed
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'OD',
          reason: 'This should now succeed because previous request is cancelled.',
          startDate: '2026-08-22',
          endDate: '2026-08-23',
          reviewerFacultyId: facultyId
        });

      expect(res.statusCode).toEqual(201);
    });
  });

  describe('4. File Security & Access Isolation', () => {
    let reqWithDocId = '';
    let filePathToCleanup = '';

    test('Student can submit request with a valid PDF supporting document', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('document', pdfFileBuffer, 'medical.pdf')
        .field('requestType', 'LEAVE')
        .field('reason', 'Sick leave with valid document attachment.')
        .field('startDate', '2026-10-05')
        .field('endDate', '2026-10-07')
        .field('reviewerFacultyId', facultyId);

      expect(res.statusCode).toEqual(201);
      reqWithDocId = res.body.id;
      filePathToCleanup = res.body.attachmentPath;
      expect(res.body.originalDocumentName).toEqual('medical.pdf');
    });

    test('Student owner can download their own request document', async () => {
      const res = await request(app)
        .get(`/api/requests/${reqWithDocId}/document`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    test('Assigned faculty reviewer can download request document', async () => {
      const res = await request(app)
        .get(`/api/requests/${reqWithDocId}/document`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toEqual(200);
    });

    test('Unassigned same-department faculty cannot download request document', async () => {
      const res = await request(app)
        .get(`/api/requests/${reqWithDocId}/document`)
        .set('Authorization', `Bearer ${otherFacultyToken}`); // Priya is not the assigned reviewer

      expect(res.statusCode).toEqual(403);
    });

    test('Other students cannot download request document', async () => {
      const res = await request(app)
        .get(`/api/requests/${reqWithDocId}/document`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.statusCode).toEqual(403);
    });

    test('Admin is blocked from downloading request document due to Privacy boundaries', async () => {
      const res = await request(app)
        .get(`/api/requests/${reqWithDocId}/document`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('Privacy boundaries');
    });

    test('Security check: path traversal attempts are rejected', async () => {
      const res = await request(app)
        .get(`/api/requests/..%2F..%2F..%2Fetc/document`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('5. Reviewer Approvals, Concurrency, and Relational History Logs', () => {
    let reviewReqId = '';

    beforeEach(async () => {
      // Clear previous requests first to prevent state cross-pollution and overlap blocks
      await prisma.approvalHistory.deleteMany({
        where: { request: { studentId } }
      });
      await prisma.leaveODRequest.deleteMany({
        where: { studentId }
      });

      // Create a fresh pending request for each review test case
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'Fresh pending request for approval tests.',
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          reviewerFacultyId: facultyId
        });
      reviewReqId = res.body.id;
    });

    test('Reviewer cannot be changed by the student after submission', async () => {
      // Try to put reviewerFacultyId in PUT or PATCH
      const res = await request(app)
        .put(`/api/requests/${reviewReqId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reviewerFacultyId: otherFacultyId });

      // There is no edit API exposed to students
      expect(res.statusCode).toEqual(404);
    });

    test('Reviewer can approve request, creating APPROVED event in history', async () => {
      const res = await request(app)
        .patch(`/api/requests/${reviewReqId}/approve`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ remarks: 'Looks good.' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.request.status).toEqual('APPROVED');

      // Verify history
      const history = await prisma.approvalHistory.findMany({
        where: { requestId: reviewReqId },
        orderBy: { createdAt: 'asc' }
      });

      expect(history.length).toEqual(2);
      expect(history[0].action).toEqual('SUBMITTED');
      expect(history[1].action).toEqual('APPROVED');
      expect(history[1].remarks).toEqual('Looks good.');
    });

    test('Reviewer can reject request, requiring remarks', async () => {
      // Reject without remarks fails
      const resFail = await request(app)
        .patch(`/api/requests/${reviewReqId}/reject`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({});
      expect(resFail.statusCode).toEqual(400);

      // Reject with remarks succeeds
      const res = await request(app)
        .patch(`/api/requests/${reviewReqId}/reject`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ remarks: 'Missing details.' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.request.status).toEqual('REJECTED');

      // Verify history
      const history = await prisma.approvalHistory.findMany({
        where: { requestId: reviewReqId },
        orderBy: { createdAt: 'asc' }
      });
      expect(history[1].action).toEqual('REJECTED');
      expect(history[1].remarks).toEqual('Missing details.');
    });

    test('Concurrency protection: double approvals or approve + reject races allow only one transition', async () => {
      // Make simultaneous calls
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/requests/${reviewReqId}/approve`)
          .set('Authorization', `Bearer ${facultyToken}`)
          .send({ remarks: 'First' }),
        request(app)
          .patch(`/api/requests/${reviewReqId}/reject`)
          .set('Authorization', `Bearer ${facultyToken}`)
          .send({ remarks: 'Second' })
      ]);

      // Exactly one must succeed with 200, the other must fail with 409 conflict
      const statuses = [res1.statusCode, res2.statusCode];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Verify exactly one action is appended to history after SUBMITTED
      const history = await prisma.approvalHistory.findMany({
        where: { requestId: reviewReqId }
      });
      expect(history.length).toEqual(2);
    });

    test('Concurrency protection: approve + student cancel race allows only one transition', async () => {
      const [resApprove, resCancel] = await Promise.all([
        request(app)
          .patch(`/api/requests/${reviewReqId}/approve`)
          .set('Authorization', `Bearer ${facultyToken}`)
          .send({ remarks: 'Approved' }),
        request(app)
          .patch(`/api/requests/${reviewReqId}/cancel`)
          .set('Authorization', `Bearer ${studentToken}`)
      ]);

      const statuses = [resApprove.statusCode, resCancel.statusCode];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      const history = await prisma.approvalHistory.findMany({
        where: { requestId: reviewReqId }
      });
      expect(history.length).toEqual(2);
    });
  });

  describe('6. Attendance Separation Verification', () => {
    test('Attendance rows remain completely unaffected after a Leave request is approved', async () => {
      // 1. Create a student attendance log
      const attDate = new Date('2026-12-01T00:00:00.000Z');
      const att = await prisma.attendance.create({
        data: {
          studentId,
          subjectId: (await prisma.subject.findFirst()).id,
          date: attDate,
          status: 'ABSENT',
          markedById: facultyUserId
        }
      });

      // 2. Submit and approve Leave for that same day
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestType: 'LEAVE',
          reason: 'Testing absence alignment logic.',
          startDate: '2026-12-01',
          endDate: '2026-12-01',
          reviewerFacultyId: facultyId
        });

      await request(app)
        .patch(`/api/requests/${reqRes.body.id}/approve`)
        .set('Authorization', `Bearer ${facultyToken}`);

      // 3. Confirm attendance log remains ABSENT
      const updatedAtt = await prisma.attendance.findUnique({
        where: { id: att.id }
      });
      expect(updatedAtt.status).toEqual('ABSENT');

      // Cleanup
      await prisma.attendance.delete({ where: { id: att.id } });
    });
  });
});
