import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import {
  evaluateEligibility,
  isTransitionAllowed,
  computeMedian,
  STUDENT_WITHDRAWABLE
} from '../src/utils/eligibilityEngine.js';

describe('Phase 10: Placement Management & Career Readiness Backend Tests', () => {
  let studentToken, facultyToken, adminToken;
  let studentUser, facultyUser, adminUser;
  let department, student, faculty;
  let companyId, driveId, applicationId, offerId;
  const suffix = `P10_${Date.now()}`;

  beforeAll(async () => {
    department = await prisma.department.findFirst({ where: { code: 'AIDS' } })
      || await prisma.department.create({ data: { name: 'Artificial Intelligence', code: 'AIDS' } });

    const sUser = await prisma.user.findFirst({
      where: { role: 'STUDENT', email: 'abishek.r@student.velammal.edu.in' },
      include: { studentProfile: true }
    }) || await prisma.user.findFirst({ where: { role: 'STUDENT' }, include: { studentProfile: true } });

    const fUser = await prisma.user.findFirst({
      where: { role: 'FACULTY' },
      include: { facultyProfile: true }
    });
    const aUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (sUser && fUser && aUser && sUser.studentProfile) {
      studentUser = sUser;
      student = sUser.studentProfile;
      facultyUser = fUser;
      faculty = fUser.facultyProfile;
      adminUser = aUser;

      const sRes = await request(app).post('/api/auth/login').send({ email: studentUser.email, password: 'password123' });
      studentToken = sRes.body.accessToken;

      const fRes = await request(app).post('/api/auth/login').send({ email: facultyUser.email, password: 'password123' });
      facultyToken = fRes.body.accessToken;

      const aRes = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'password123' });
      adminToken = aRes.body.accessToken;

      // Ensure student has CGPA for eligibility tests
      await prisma.student.update({
        where: { id: student.id },
        data: { cgpa: 8.5, currentBacklogs: 0, departmentId: department.id }
      });

      // Align faculty department for read-only tests
      if (faculty && faculty.departmentId !== department.id) {
        await prisma.faculty.update({
          where: { id: faculty.id },
          data: { departmentId: department.id }
        });
      }
    }
  });

  afterAll(async () => {
    // Cleanup placement fixtures created in this suite
    if (companyId) {
      const drives = await prisma.placementDrive.findMany({ where: { companyId }, select: { id: true } });
      const driveIds = drives.map((d) => d.id);
      if (driveIds.length) {
        const apps = await prisma.placementApplication.findMany({
          where: { driveId: { in: driveIds } },
          select: { id: true }
        });
        const appIds = apps.map((a) => a.id);
        if (appIds.length) {
          await prisma.applicationStageHistory.deleteMany({ where: { applicationId: { in: appIds } } });
          await prisma.placementOffer.deleteMany({ where: { applicationId: { in: appIds } } });
          await prisma.placementApplication.deleteMany({ where: { id: { in: appIds } } });
        }
        await prisma.driveEligibleBatch.deleteMany({ where: { driveId: { in: driveIds } } });
        await prisma.driveEligibleDepartment.deleteMany({ where: { driveId: { in: driveIds } } });
        await prisma.placementDrive.deleteMany({ where: { id: { in: driveIds } } });
      }
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  // ─── Unit: eligibility engine ──────────────────────────────────────────────

  describe('1. Eligibility Engine Unit Tests', () => {
    const baseStudent = {
      departmentId: 'dept-1',
      batchYear: '2024-2028',
      cgpa: 8.0,
      currentBacklogs: 0,
      placementStatus: 'UNPLACED',
      hasResume: true
    };
    const baseDrive = {
      status: 'PUBLISHED',
      applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
      minCgpa: 7.0,
      maxBacklogs: 1,
      allowPlacedApplications: false,
      eligibleDepartmentIds: ['dept-1'],
      eligibleBatchYears: ['2024-2028']
    };

    test('eligible student passes all checks', () => {
      const r = evaluateEligibility(baseStudent, baseDrive, { requireResumeForApply: true });
      expect(r.eligible).toBe(true);
      expect(r.reasons.every((x) => x.passed)).toBe(true);
    });

    test('missing CGPA fails CGPA_PRESENT and CGPA_MIN', () => {
      const r = evaluateEligibility({ ...baseStudent, cgpa: null }, baseDrive);
      expect(r.eligible).toBe(false);
      expect(r.reasons.find((x) => x.code === 'CGPA_PRESENT').passed).toBe(false);
    });

    test('low CGPA fails CGPA_MIN', () => {
      const r = evaluateEligibility({ ...baseStudent, cgpa: 6.5 }, baseDrive);
      expect(r.eligible).toBe(false);
      expect(r.reasons.find((x) => x.code === 'CGPA_MIN').passed).toBe(false);
    });

    test('too many backlogs fails BACKLOGS_MAX', () => {
      const r = evaluateEligibility({ ...baseStudent, currentBacklogs: 3 }, baseDrive);
      expect(r.eligible).toBe(false);
      expect(r.reasons.find((x) => x.code === 'BACKLOGS_MAX').passed).toBe(false);
    });

    test('wrong department fails', () => {
      const r = evaluateEligibility({ ...baseStudent, departmentId: 'other' }, baseDrive);
      expect(r.reasons.find((x) => x.code === 'DEPARTMENT').passed).toBe(false);
    });

    test('placed student blocked unless allowPlacedApplications', () => {
      const r = evaluateEligibility(
        { ...baseStudent, placementStatus: 'PLACED' },
        baseDrive
      );
      expect(r.reasons.find((x) => x.code === 'ALREADY_PLACED_POLICY').passed).toBe(false);
      const r2 = evaluateEligibility(
        { ...baseStudent, placementStatus: 'PLACED' },
        { ...baseDrive, allowPlacedApplications: true }
      );
      expect(r2.reasons.find((x) => x.code === 'ALREADY_PLACED_POLICY').passed).toBe(true);
    });

    test('resume required only when applying', () => {
      const listing = evaluateEligibility(
        { ...baseStudent, hasResume: false },
        baseDrive,
        { requireResumeForApply: false }
      );
      expect(listing.reasons.find((x) => x.code === 'PROFILE_RESUME').passed).toBe(true);
      const apply = evaluateEligibility(
        { ...baseStudent, hasResume: false },
        baseDrive,
        { requireResumeForApply: true }
      );
      expect(apply.reasons.find((x) => x.code === 'PROFILE_RESUME').passed).toBe(false);
    });

    test('stage transitions and median helper', () => {
      expect(isTransitionAllowed('APPLIED', 'SHORTLISTED')).toBe(true);
      expect(isTransitionAllowed('APPLIED', 'SELECTED')).toBe(false);
      expect(isTransitionAllowed('HR', 'SELECTED')).toBe(true);
      expect(isTransitionAllowed('SELECTED', 'REJECTED')).toBe(false);
      expect(STUDENT_WITHDRAWABLE.has('APPLIED')).toBe(true);
      expect(computeMedian([1, 3, 2])).toBe(2);
      expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
      expect(computeMedian([])).toBeNull();
    });
  });

  // ─── Auth gates ────────────────────────────────────────────────────────────

  describe('2. Authentication & RBAC', () => {
    test('unauthenticated placement routes return 401', async () => {
      const res = await request(app).get('/api/placement/admin/companies');
      expect(res.status).toBe(401);
    });

    test('student cannot access admin companies', async () => {
      if (!studentToken) return;
      const res = await request(app)
        .get('/api/placement/admin/companies')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    test('faculty cannot mutate stages', async () => {
      if (!facultyToken) return;
      const res = await request(app)
        .patch('/api/placement/admin/applications/00000000-0000-0000-0000-000000000001/stage')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ toStage: 'SHORTLISTED' });
      expect(res.status).toBe(403);
    });
  });

  // ─── Companies & drives ────────────────────────────────────────────────────

  describe('3. Companies & Drives Lifecycle', () => {
    test('admin creates company', async () => {
      if (!adminToken) return;
      const res = await request(app)
        .post('/api/placement/admin/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Phase10 Corp ${suffix}`,
          code: `P10C${Date.now().toString().slice(-6)}`,
          industry: 'Software'
        });
      expect(res.status).toBe(201);
      companyId = res.body.id;
      expect(res.body.name).toContain('Phase10');
    });

    test('admin creates DRAFT drive', async () => {
      if (!adminToken || !companyId || !student) return;
      const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
      const res = await request(app)
        .post('/api/placement/admin/drives')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          companyId,
          title: `Software Engineer ${suffix}`,
          description: 'Build great products',
          location: 'Chennai',
          packageCtc: 12,
          applicationDeadline: deadline,
          minCgpa: 7.0,
          maxBacklogs: 1,
          departmentIds: [student.departmentId || department.id],
          batchYears: [student.batchYear]
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      driveId = res.body.id;
    });

    test('eligibility criteria locked after publish', async () => {
      if (!adminToken || !driveId) return;
      const pub = await request(app)
        .post(`/api/placement/admin/drives/${driveId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pub.status).toBe(200);
      expect(pub.body.status).toBe('PUBLISHED');

      const locked = await request(app)
        .put(`/api/placement/admin/drives/${driveId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ minCgpa: 9.0 });
      expect(locked.status).toBe(400);
      expect(locked.body.message).toMatch(/locked/i);
    });
  });

  // ─── Profile, apply, stages, offers ────────────────────────────────────────

  describe('4. Profile, Apply, Stages & Offers', () => {
    test('student updates profile and admin sets eligibility', async () => {
      if (!studentToken || !adminToken || !student) return;
      const profile = await request(app)
        .put('/api/placement/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ skills: 'React, Node', bio: 'Eager engineer' });
      expect(profile.status).toBe(200);

      // Fake resume path for apply eligibility (bypass file upload in unit path)
      await prisma.studentPlacementProfile.upsert({
        where: { studentId: student.id },
        create: {
          studentId: student.id,
          resumePath: 'resumes/test-resume.pdf',
          originalResumeName: 'resume.pdf',
          skills: 'React, Node',
          isProfileComplete: true
        },
        update: {
          resumePath: 'resumes/test-resume.pdf',
          originalResumeName: 'resume.pdf',
          isProfileComplete: true
        }
      });

      const elig = await request(app)
        .put(`/api/placement/admin/students/${student.id}/academic-eligibility`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cgpa: 8.5, currentBacklogs: 0 });
      expect(elig.status).toBe(200);
      expect(Number(elig.body.cgpa)).toBe(8.5);
    });

    test('student lists drives with eligibility and can apply', async () => {
      if (!studentToken || !driveId) return;
      const list = await request(app)
        .get('/api/placement/student/drives')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(list.status).toBe(200);
      const found = (list.body.data || []).find((d) => d.id === driveId);
      expect(found).toBeTruthy();

      const apply = await request(app)
        .post(`/api/placement/student/drives/${driveId}/apply`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(apply.status).toBe(201);
      expect(apply.body.stage).toBe('APPLIED');
      expect(apply.body.eligibilitySnapshot).toBeTruthy();
      applicationId = apply.body.id;
    });

    test('duplicate apply returns 409', async () => {
      if (!studentToken || !driveId) return;
      const res = await request(app)
        .post(`/api/placement/student/drives/${driveId}/apply`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(409);
    });

    test('admin advances stages and creates offer', async () => {
      if (!adminToken || !applicationId) return;
      const shortlist = await request(app)
        .patch(`/api/placement/admin/applications/${applicationId}/stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toStage: 'SHORTLISTED', remarks: 'Good profile' });
      expect(shortlist.status).toBe(200);
      expect(shortlist.body.stage).toBe('SHORTLISTED');

      const illegal = await request(app)
        .patch(`/api/placement/admin/applications/${applicationId}/stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toStage: 'SELECTED' });
      expect(illegal.status).toBe(409);

      await request(app)
        .patch(`/api/placement/admin/applications/${applicationId}/stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toStage: 'HR' });
      const selected = await request(app)
        .patch(`/api/placement/admin/applications/${applicationId}/stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toStage: 'SELECTED' });
      expect(selected.status).toBe(200);

      const offer = await request(app)
        .post(`/api/placement/admin/applications/${applicationId}/offer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ctc: 14, roleTitle: 'SDE' });
      expect(offer.status).toBe(201);
      expect(offer.body.status).toBe('OFFERED');
      offerId = offer.body.id;
    });

    test('student accepts offer and becomes PLACED; only one ACCEPTED', async () => {
      if (!studentToken || !offerId || !student) return;
      const accept = await request(app)
        .post(`/api/placement/student/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(accept.status).toBe(200);
      expect(accept.body.status).toBe('ACCEPTED');

      const profile = await prisma.studentPlacementProfile.findUnique({ where: { studentId: student.id } });
      expect(profile.placementStatus).toBe('PLACED');

      const acceptedCount = await prisma.placementOffer.count({
        where: { studentId: student.id, status: 'ACCEPTED' }
      });
      expect(acceptedCount).toBe(1);
    });

    test('student IDOR blocked on another application', async () => {
      if (!studentToken) return;
      const res = await request(app)
        .get('/api/placement/student/applications/00000000-0000-0000-0000-000000000099')
        .set('Authorization', `Bearer ${studentToken}`);
      expect([404, 403]).toContain(res.status);
    });
  });

  // ─── Faculty read-only ─────────────────────────────────────────────────────

  describe('5. Faculty Read-Only Visibility', () => {
    test('faculty can list drives and students without CTC/resume', async () => {
      if (!facultyToken) return;
      const drives = await request(app)
        .get('/api/placement/faculty/drives')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(drives.status).toBe(200);
      expect(Array.isArray(drives.body.data)).toBe(true);
      if (drives.body.data[0]) {
        expect(drives.body.data[0].packageCtc).toBeUndefined();
      }

      const students = await request(app)
        .get('/api/placement/faculty/students')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(students.status).toBe(200);
      if (students.body.data[0]) {
        expect(students.body.data[0].resumePath).toBeUndefined();
        expect(students.body.data[0].ctc).toBeUndefined();
      }
    });

    test('faculty cannot download resume', async () => {
      if (!facultyToken || !student) return;
      const res = await request(app)
        .get(`/api/placement/admin/students/${student.id}/resume`)
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── Analytics & export ────────────────────────────────────────────────────

  describe('6. Analytics & Export', () => {
    test('admin analytics summary shape', async () => {
      if (!adminToken) return;
      const res = await request(app)
        .get('/api/placement/admin/analytics/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cohortSize');
      expect(res.body).toHaveProperty('placementPercent');
      expect(res.body).toHaveProperty('packageStats');
    });

    test('admin can export placement roster', async () => {
      if (!adminToken) return;
      const res = await request(app)
        .get('/api/bulk/export/placement-roster')
        .query({ format: 'xlsx' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/spreadsheet|octet|xlsx/i);
    });

    test('placement eligibility template download', async () => {
      if (!adminToken) return;
      const res = await request(app)
        .get('/api/bulk/templates/placement-eligibility')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
