import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import { runBackfill } from '../src/utils/backfillNotifications.js';
import * as notificationService from '../src/utils/notificationService.js';

describe('Phase 3: Smart Notification System Integration & Unit Tests', () => {
  let adminToken = '';
  let studentToken = '';
  let facultyToken = '';
  
  let studentId = '';
  let studentUserId = '';
  let facultyId = '';
  let facultyUserId = '';
  let testSubjectId = '';

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
    studentId = studentLogin.body.user.studentId;

    // Get Student User ID
    const studentProf = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true }
    });
    studentUserId = studentProf.userId;

    // 3. Authenticate Faculty
    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ramesh.kumar@velammal.edu.in',
        password: 'password123'
      });
    facultyToken = facultyLogin.body.accessToken;
    facultyId = facultyLogin.body.user.facultyId;

    // Get Faculty User ID
    const facultyProf = await prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { userId: true }
    });
    facultyUserId = facultyProf.userId;

    const subjects = await prisma.subject.findMany();
    if (subjects.length > 0) {
      testSubjectId = subjects[0].id;
    }
  });

  describe('1. Backfill Script Verification', () => {
    test('Backfill utility completes cleanly with existing database state', async () => {
      const metrics = await runBackfill();
      expect(metrics.totalAfter).toEqual(metrics.totalBefore);
      expect(metrics.orphanedCount).toEqual(0);
    });
  });

  describe('2. Service Validation Constraints', () => {
    test('Invalid notification type is rejected', async () => {
      await expect(
        notificationService.createNotification({
          userId: studentUserId,
          title: 'Title',
          message: 'Message',
          type: 'INVALID_TYPE'
        })
      ).rejects.toThrow('Invalid notification type');
    });

    test('Invalid notification priority is rejected', async () => {
      await expect(
        notificationService.createNotification({
          userId: studentUserId,
          title: 'Title',
          message: 'Message',
          type: 'SYSTEM',
          priority: 'CRITICAL' // Invalid: Must be URGENT, HIGH, NORMAL, LOW
        })
      ).rejects.toThrow('Invalid notification priority');
    });
  });

  describe('3. Inbox Scope & Ownership API Security', () => {
    let studentNotifId = '';
    let facultyNotifId = '';

    beforeAll(async () => {
      // Create a student notification
      const sn = await notificationService.createNotification({
        userId: studentUserId,
        title: 'Student Alert',
        message: 'Info for student',
        type: 'SYSTEM'
      });
      studentNotifId = sn.id;

      // Create a faculty notification
      const fn = await notificationService.createNotification({
        userId: facultyUserId,
        title: 'Faculty Alert',
        message: 'Info for faculty',
        type: 'SYSTEM'
      });
      facultyNotifId = fn.id;
    });

    test('Student can retrieve their own notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.notifications.some(n => n.id === studentNotifId)).toBe(true);
    });

    test('Student cannot retrieve or view another user\'s notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.body.notifications.some(n => n.id === facultyNotifId)).toBe(false);
    });

    test('Student cannot mark another user\'s notification as read', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${facultyNotifId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(404);
    });

    test('Student cannot archive another user\'s notification', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${facultyNotifId}/archive`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(404);
    });

    test('Student can mark their own notification as read', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${studentNotifId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      
      const check = await prisma.notification.findUnique({ where: { id: studentNotifId } });
      expect(check.readStatus).toBe(true);
      expect(check.readAt).not.toBeNull();
    });

    test('Student can archive their own notification', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${studentNotifId}/archive`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);

      const check = await prisma.notification.findUnique({ where: { id: studentNotifId } });
      expect(check.archivedAt).not.toBeNull();
    });

    test('Archived notifications are excluded from the default inbox query', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.body.notifications.some(n => n.id === studentNotifId)).toBe(false);
    });
  });

  describe('4. Attendance Warning Deduplication', () => {
    test('Deduplication prevents warning spam within a 24-hour window', async () => {
      // 1. Clear existing notifications
      await prisma.notification.deleteMany({
        where: { userId: studentUserId }
      });

      // 2. Set threshold to 100% to guarantee drop warning
      await prisma.setting.update({
        where: { key: 'low_attendance_threshold' },
        data: { value: '100' }
      });

      // 3. Mark ABSENT first time -> Trigger alert
      await request(app)
        .post('/api/faculty/attendance')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          date: '2026-08-10',
          records: [{ studentId, status: 'ABSENT' }]
        });

      // 4. Mark ABSENT second time -> Deduplicated
      await request(app)
        .post('/api/faculty/attendance')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          date: '2026-08-11',
          records: [{ studentId, status: 'ABSENT' }]
        });

      const alertsCount = await prisma.notification.count({
        where: {
          userId: studentUserId,
          type: 'ATTENDANCE_WARNING'
        }
      });

      expect(alertsCount).toEqual(1);
    });
  });

  describe('5. Marks Notifications & No-Op Filters', () => {
    test('Adding new marks generates notification', async () => {
      // Clear existing marks first to ensure creation trigger runs
      await prisma.mark.deleteMany({
        where: {
          studentId,
          subjectId: testSubjectId,
          examType: 'INTERNAL2'
        }
      });

      // Clear existing notifications
      await prisma.notification.deleteMany({
        where: { userId: studentUserId, type: 'MARKS_PUBLISHED' }
      });

      await request(app)
        .post('/api/faculty/marks')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          examType: 'INTERNAL2',
          maxMarks: 100,
          records: [{ studentId, marksObtained: 90 }]
        });

      const counts = await prisma.notification.count({
        where: { userId: studentUserId, type: 'MARKS_PUBLISHED' }
      });
      expect(counts).toEqual(1);
    });

    test('No-op marks update does NOT generate redundant notifications', async () => {
      const countsBefore = await prisma.notification.count({
        where: { userId: studentUserId, type: 'MARKS_PUBLISHED' }
      });

      // Enter identical marks
      await request(app)
        .post('/api/faculty/marks')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          examType: 'INTERNAL2',
          maxMarks: 100,
          records: [{ studentId, marksObtained: 90 }]
        });

      const countsAfter = await prisma.notification.count({
        where: { userId: studentUserId, type: 'MARKS_PUBLISHED' }
      });
      expect(countsAfter).toEqual(countsBefore);
    });
  });

  describe('6. Transaction Rollback Integrity', () => {
    test('Marks controller transaction error rolls back notification', async () => {
      const beforeCount = await prisma.notification.count({
        where: { userId: studentUserId }
      });

      // Submit failing record (marks > maxMarks)
      await request(app)
        .post('/api/faculty/marks')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subjectId: testSubjectId,
          examType: 'SEMESTER',
          maxMarks: 100,
          records: [{ studentId, marksObtained: 150 }] // Exceeds maxMarks
        });

      const afterCount = await prisma.notification.count({
        where: { userId: studentUserId }
      });
      // Verification: Row counts must remain equal
      expect(afterCount).toEqual(beforeCount);
    });
  });
});
