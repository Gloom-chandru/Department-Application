import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import storageAdapter from '../src/utils/storageService.js';
import fs from 'fs';
import path from 'path';

describe('Phase 5: Assignment Management System Integration Tests', () => {
  let adminToken = '';
  
  let facultyToken = '';
  let facultyId = '';
  
  let unauthorizedFacultyToken = '';
  let unauthorizedFacultyId = '';
  
  let studentToken = '';
  let studentId = '';
  let studentUserId = '';
  
  let subjectId = '';
  let otherSubjectId = '';
  
  let draftAssignmentId = '';
  let publishedAssignmentId = '';
  let closedAssignmentId = '';

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

    const otherFacultyLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.lakshmi@velammal.edu.in', password: 'password123' });
    unauthorizedFacultyToken = otherFacultyLogin.body.accessToken;
    unauthorizedFacultyId = otherFacultyLogin.body.user.facultyId;

    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
    studentToken = studentLogin.body.accessToken;
    studentId = studentLogin.body.user.studentId;
    
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });
    studentUserId = student.userId;

    // Subjects
    const subjects = await prisma.subject.findMany({ where: { facultyId } });
    if (subjects.length > 0) {
      subjectId = subjects[0].id;
    }
    const otherSubjects = await prisma.subject.findMany({ where: { facultyId: unauthorizedFacultyId } });
    if (otherSubjects.length > 0) {
      otherSubjectId = otherSubjects[0].id;
    }
  });

  describe('1. Assignment Creation & Validation Rules', () => {
    test('Faculty can create a draft assignment without batchYear', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId,
          title: 'Draft Homework',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          maxMarks: 100,
          status: 'DRAFT'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.status).toEqual('DRAFT');
      expect(res.body.batchYear).toBeNull();
      draftAssignmentId = res.body.id;
    });

    test('Faculty cannot publish an assignment without batchYear', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId,
          title: 'Published Homework',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          maxMarks: 100,
          status: 'PUBLISHED'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('batchYear is required');
    });

    test('Faculty cannot create assignments for subjects taught by others', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: otherSubjectId,
          title: 'Unauthorized HW',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          maxMarks: 100,
          status: 'DRAFT'
        });

      expect(res.statusCode).toEqual(403);
    });

    test('Faculty can create a published assignment with batchYear', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId,
          title: 'Published Homework',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          maxMarks: 50,
          status: 'PUBLISHED',
          batchYear: '2024-28'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.status).toEqual('PUBLISHED');
      expect(res.body.batchYear).toEqual('2024-28');
      publishedAssignmentId = res.body.id;
    });
  });

  describe('2. Audience Filters & Visibility Rules', () => {
    test('Student sees published assignments matching their batch & dept', async () => {
      const res = await request(app)
        .get('/api/assignments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      const ids = res.body.map(a => a.id);
      expect(ids).toContain(publishedAssignmentId);
      expect(ids).not.toContain(draftAssignmentId);
    });

    test('Student cannot see assignments targeted to another batch', async () => {
      // 1. Create assignment for unrelated batch "2023-2027"
      const resCreate = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId,
          title: 'Other Batch Homework',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          maxMarks: 50,
          status: 'PUBLISHED',
          batchYear: '2023-2027'
        });
      
      const otherBatchId = resCreate.body.id;

      // 2. Fetch assignments list
      const resList = await request(app)
        .get('/api/assignments')
        .set('Authorization', `Bearer ${studentToken}`);
      
      const ids = resList.body.map(a => a.id);
      expect(ids).not.toContain(otherBatchId);

      // Cleanup
      await prisma.assignment.delete({ where: { id: otherBatchId } });
    });

    test('Student cannot see assignments targeted to another section', async () => {
      // Current student is section A. Let's create an assignment for section B
      const resCreate = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId,
          title: 'Section B Homework',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          maxMarks: 50,
          status: 'PUBLISHED',
          batchYear: '2024-28',
          section: 'B'
        });
      
      const otherSecId = resCreate.body.id;

      // Fetch assignments list
      const resList = await request(app)
        .get('/api/assignments')
        .set('Authorization', `Bearer ${studentToken}`);
      
      const ids = resList.body.map(a => a.id);
      expect(ids).not.toContain(otherSecId);

      // Cleanup
      await prisma.assignment.delete({ where: { id: otherSecId } });
    });
  });

  describe('3. Student Submissions & Versions', () => {
    let mockFileBuffer = Buffer.from('hello pdf signature');
    // Prepend fake PDF magic bytes so validation passes
    let pdfFileBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n'), mockFileBuffer]);

    test('Student submits initial submission (Version 1)', async () => {
      const res = await request(app)
        .post(`/api/assignments/${publishedAssignmentId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('submission', pdfFileBuffer, 'homework.pdf');

      expect(res.statusCode).toEqual(200);
      expect(res.body.versionNumber).toEqual(1);
    });

    test('Student replaces submission before deadline (creates Version 2)', async () => {
      const res = await request(app)
        .post(`/api/assignments/${publishedAssignmentId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('submission', pdfFileBuffer, 'homework_new.pdf');

      expect(res.statusCode).toEqual(200);
      expect(res.body.versionNumber).toEqual(2);

      // Verify two versions exist in the database
      const submission = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId: publishedAssignmentId, studentId } },
        include: { versions: true }
      });
      expect(submission.versions.length).toEqual(2);
      expect(submission.versions[0].versionNumber).toEqual(1);
      expect(submission.versions[1].versionNumber).toEqual(2);
    });

    test('Student cannot submit to CLOSED assignment', async () => {
      // 1. Create a closed assignment
      const closedRes = await prisma.assignment.create({
        data: {
          subjectId,
          title: 'Closed Homework',
          description: 'This is a description that is at least 10 chars.',
          dueAt: new Date(Date.now() - 86400000), // In the past
          maxMarks: 50,
          status: 'CLOSED',
          batchYear: '2024-28'
        }
      });
      closedAssignmentId = closedRes.id;

      // 2. Submit file
      const res = await request(app)
        .post(`/api/assignments/${closedAssignmentId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('submission', pdfFileBuffer, 'homework.pdf');

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('not open for submissions');
    });
  });

  describe('4. File Download Security & Admin Privacy', () => {
    test('Student can download their own submission versions', async () => {
      // Fetch version number 1
      const res = await request(app)
        .get(`/api/assignments/${publishedAssignmentId}/submissions/${studentId}/versions/1/download`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    test('Student cannot download another student\'s submission file', async () => {
      // Try with studentId of another user
      const res = await request(app)
        .get(`/api/assignments/${publishedAssignmentId}/submissions/some-other-id/versions/1/download`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(403);
    });

    test('Admin is blocked from downloading student submission files due to privacy boundaries', async () => {
      const res = await request(app)
        .get(`/api/assignments/${publishedAssignmentId}/submissions/${studentId}/versions/1/download`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('Privacy boundaries');
    });
  });

  describe('5. Grading & Replacement Reset Rules', () => {
    let mockFileBuffer = Buffer.from('%PDF-1.4\nhello');

    test('Faculty can grade an assignment submission', async () => {
      const sub = await prisma.assignmentSubmission.findFirst({
        where: { assignmentId: publishedAssignmentId, studentId }
      });

      const res = await request(app)
        .patch(`/api/assignments/${publishedAssignmentId}/submissions/${sub.id}/grade`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksAwarded: 45,
          feedback: 'Excellent work!'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('GRADED');
      expect(res.body.marksAwarded).toEqual(45);
    });

    test('Grading exceeds maxMarks is rejected', async () => {
      const sub = await prisma.assignmentSubmission.findFirst({
        where: { assignmentId: publishedAssignmentId, studentId }
      });

      const res = await request(app)
        .patch(`/api/assignments/${publishedAssignmentId}/submissions/${sub.id}/grade`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksAwarded: 99, // max marks is 50
          feedback: 'Outstanding'
        });

      expect(res.statusCode).toEqual(400);
    });

    test('Replacing graded submission resets grades and requires re-grading', async () => {
      const res = await request(app)
        .post(`/api/assignments/${publishedAssignmentId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('submission', mockFileBuffer, 'homework_v3.pdf');

      expect(res.statusCode).toEqual(200);

      // Verify grades are reset to null and status returned to SUBMITTED
      const sub = await prisma.assignmentSubmission.findFirst({
        where: { assignmentId: publishedAssignmentId, studentId }
      });
      expect(sub.status).toEqual('SUBMITTED');
      expect(sub.marksAwarded).toBeNull();
      expect(sub.feedback).toBeNull();
      expect(sub.gradedAt).toBeNull();
      expect(sub.gradedById).toBeNull();
    });
  });

  describe('6. Hard Delete Prevention Rules', () => {
    test('Published assignments cannot be deleted', async () => {
      const res = await request(app)
        .delete(`/api/assignments/${publishedAssignmentId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Published or closed assignments cannot be deleted');
    });

    test('Faculty can delete DRAFT assignments', async () => {
      const res = await request(app)
        .delete(`/api/assignments/${draftAssignmentId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('deleted successfully');
    });
  });

  afterAll(async () => {
    // Delete any remaining files in storage to keep disk clean
    const submissions = await prisma.assignmentSubmissionVersion.findMany();
    for (const sub of submissions) {
      const filename = sub.fileReference.split('/')[1];
      await storageAdapter.deleteFile('submissions', filename);
    }

    // Clean up created entities
    await prisma.assignmentSubmissionVersion.deleteMany();
    await prisma.assignmentSubmission.deleteMany();
    await prisma.assignment.deleteMany({
      where: { id: { in: [publishedAssignmentId, closedAssignmentId] } }
    });
  });
});
