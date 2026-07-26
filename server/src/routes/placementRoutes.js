import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { configureUploadMiddleware } from '../middleware/upload.js';
import * as ctrl from '../controllers/placementController.js';

const router = express.Router();

router.use(authenticateToken);

// ─── Admin: Companies ────────────────────────────────────────────────────────
router.get('/admin/companies', authorizeRoles('ADMIN'), ctrl.listCompanies);
router.post('/admin/companies', authorizeRoles('ADMIN'), ctrl.createCompany);
router.get('/admin/companies/:id', authorizeRoles('ADMIN'), ctrl.getCompany);
router.put('/admin/companies/:id', authorizeRoles('ADMIN'), ctrl.updateCompany);
router.patch('/admin/companies/:id/active', authorizeRoles('ADMIN'), ctrl.deactivateCompany);

// ─── Admin: Drives ───────────────────────────────────────────────────────────
router.get('/admin/drives', authorizeRoles('ADMIN'), ctrl.listAdminDrives);
router.post('/admin/drives', authorizeRoles('ADMIN'), ctrl.createDrive);
router.get('/admin/drives/:id', authorizeRoles('ADMIN'), ctrl.getAdminDrive);
router.put('/admin/drives/:id', authorizeRoles('ADMIN'), ctrl.updateDrive);
router.post('/admin/drives/:id/publish', authorizeRoles('ADMIN'), ctrl.publishDrive);
router.post('/admin/drives/:id/close', authorizeRoles('ADMIN'), ctrl.closeDrive);
router.post('/admin/drives/:id/cancel', authorizeRoles('ADMIN'), ctrl.cancelDrive);
router.get('/admin/drives/:id/eligible-students', authorizeRoles('ADMIN'), ctrl.listDriveEligibleStudents);
router.get('/admin/drives/:id/applications', authorizeRoles('ADMIN'), ctrl.listDriveApplications);

// ─── Admin: Student eligibility / placement ──────────────────────────────────
router.put('/admin/students/:studentId/academic-eligibility', authorizeRoles('ADMIN'), ctrl.adminUpdateStudentEligibility);
router.get('/admin/students/:studentId/placement', authorizeRoles('ADMIN'), ctrl.adminGetStudentPlacement);
router.get('/admin/students/:studentId/resume', authorizeRoles('ADMIN'), ctrl.adminDownloadResume);

// ─── Admin: Applications / Offers ────────────────────────────────────────────
router.patch('/admin/applications/:id/stage', authorizeRoles('ADMIN'), ctrl.changeApplicationStage);
router.post('/admin/applications/:id/offer', authorizeRoles('ADMIN'), ctrl.createOffer);
router.patch('/admin/offers/:id', authorizeRoles('ADMIN'), ctrl.patchOffer);
router.get('/admin/offers', authorizeRoles('ADMIN'), ctrl.listAdminOffers);

// ─── Admin: Analytics ────────────────────────────────────────────────────────
router.get('/admin/analytics/summary', authorizeRoles('ADMIN'), ctrl.getAdminAnalyticsSummary);
router.get('/admin/analytics/by-company', authorizeRoles('ADMIN'), ctrl.getAnalyticsByCompany);
router.get('/admin/analytics/by-department', authorizeRoles('ADMIN'), ctrl.getAnalyticsByDepartment);
router.get('/admin/analytics/by-batch', authorizeRoles('ADMIN'), ctrl.getAnalyticsByBatch);
router.get('/admin/analytics/packages', authorizeRoles('ADMIN'), ctrl.getAnalyticsPackages);

// ─── Student ─────────────────────────────────────────────────────────────────
router.get('/student/profile', authorizeRoles('STUDENT'), ctrl.getStudentPlacementProfile);
router.put('/student/profile', authorizeRoles('STUDENT'), ctrl.updateStudentPlacementProfile);
router.post(
  '/student/profile/resume',
  authorizeRoles('STUDENT'),
  configureUploadMiddleware('resumes', 'resume', false),
  ctrl.uploadStudentResume
);
router.get('/student/profile/resume', authorizeRoles('STUDENT'), ctrl.downloadOwnResume);
router.get('/student/drives', authorizeRoles('STUDENT'), ctrl.listStudentDrives);
router.get('/student/drives/:id', authorizeRoles('STUDENT'), ctrl.getStudentDrive);
router.post('/student/drives/:id/apply', authorizeRoles('STUDENT'), ctrl.applyToDrive);
router.get('/student/applications', authorizeRoles('STUDENT'), ctrl.listStudentApplications);
router.get('/student/applications/:id', authorizeRoles('STUDENT'), ctrl.getStudentApplication);
router.post('/student/applications/:id/withdraw', authorizeRoles('STUDENT'), ctrl.withdrawApplication);
router.get('/student/offers', authorizeRoles('STUDENT'), ctrl.listStudentOffers);
router.post('/student/offers/:id/accept', authorizeRoles('STUDENT'), ctrl.acceptOffer);
router.post('/student/offers/:id/decline', authorizeRoles('STUDENT'), ctrl.declineOffer);

// ─── Faculty (read-only) ─────────────────────────────────────────────────────
router.get('/faculty/drives', authorizeRoles('FACULTY'), ctrl.listFacultyDrives);
router.get('/faculty/drives/:id/summary', authorizeRoles('FACULTY'), ctrl.getFacultyDriveSummary);
router.get('/faculty/students', authorizeRoles('FACULTY'), ctrl.listFacultyPlacementStudents);

export default router;
