import express from 'express';
import multer from 'multer';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  getStudentTemplate,
  getFacultyTemplate,
  getMarksTemplate,
  getTimetableTemplate,
  studentDryRun,
  studentConfirm,
  facultyDryRun,
  facultyConfirm,
  marksDryRun,
  marksConfirm,
  timetableDryRun,
  timetableConfirm,
  exportAttendance,
  exportMarks,
  exportTimetable,
  downloadErrorWorkbook,
  getPlacementProfileTemplate,
  getCompanyImportTemplate,
  getOfferImportTemplate,
  placementProfileDryRun,
  placementProfileConfirm,
  companyImportDryRun,
  companyImportConfirm,
  offerImportDryRun,
  offerImportConfirm,
  exportPlacementApplicationsHandler,
  exportPlacementOffersHandler,
  exportPlacementRosterHandler
} from '../controllers/importExportController.js';

const router = express.Router();

// Multer memory-only configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

// All routes require authentication
router.use(authenticateToken);

// ---- Download templates ----
router.get('/templates/students', authorizeRoles('ADMIN', 'FACULTY'), getStudentTemplate);
router.get('/templates/faculty', authorizeRoles('ADMIN', 'FACULTY'), getFacultyTemplate);
router.get('/templates/marks', authorizeRoles('ADMIN', 'FACULTY'), getMarksTemplate);
router.get('/templates/timetable', authorizeRoles('ADMIN', 'FACULTY'), getTimetableTemplate);
router.get('/templates/placement-eligibility', authorizeRoles('ADMIN'), getPlacementProfileTemplate);
router.get('/templates/companies', authorizeRoles('ADMIN'), getCompanyImportTemplate);
router.get('/templates/offers', authorizeRoles('ADMIN'), getOfferImportTemplate);

// ---- Bulk Imports ----
// Students (Admin only)
router.post('/import/students/dry-run', authorizeRoles('ADMIN'), upload.single('file'), studentDryRun);
router.post('/import/students/confirm', authorizeRoles('ADMIN'), upload.single('file'), studentConfirm);

// Faculty (Admin only)
router.post('/import/faculty/dry-run', authorizeRoles('ADMIN'), upload.single('file'), facultyDryRun);
router.post('/import/faculty/confirm', authorizeRoles('ADMIN'), upload.single('file'), facultyConfirm);

// Marks (Admin & Faculty)
router.post('/import/marks/dry-run', authorizeRoles('ADMIN', 'FACULTY'), upload.single('file'), marksDryRun);
router.post('/import/marks/confirm', authorizeRoles('ADMIN', 'FACULTY'), upload.single('file'), marksConfirm);

// Timetable (Admin only, into specific scheduleId)
router.post('/import/timetable/:scheduleId/dry-run', authorizeRoles('ADMIN'), upload.single('file'), timetableDryRun);
router.post('/import/timetable/:scheduleId/confirm', authorizeRoles('ADMIN'), upload.single('file'), timetableConfirm);

// Placement (Admin only)
router.post('/import/placement-eligibility/dry-run', authorizeRoles('ADMIN'), upload.single('file'), placementProfileDryRun);
router.post('/import/placement-eligibility/confirm', authorizeRoles('ADMIN'), upload.single('file'), placementProfileConfirm);
router.post('/import/companies/dry-run', authorizeRoles('ADMIN'), upload.single('file'), companyImportDryRun);
router.post('/import/companies/confirm', authorizeRoles('ADMIN'), upload.single('file'), companyImportConfirm);
router.post('/import/offers/dry-run', authorizeRoles('ADMIN'), upload.single('file'), offerImportDryRun);
router.post('/import/offers/confirm', authorizeRoles('ADMIN'), upload.single('file'), offerImportConfirm);

// ---- Bulk Exports ----
router.get('/export/attendance', authorizeRoles('ADMIN', 'FACULTY'), exportAttendance);
router.get('/export/marks', authorizeRoles('ADMIN', 'FACULTY'), exportMarks);
router.get('/export/timetable/:scheduleId', authorizeRoles('ADMIN', 'FACULTY', 'STUDENT'), exportTimetable);
router.get('/export/placement-applications', authorizeRoles('ADMIN'), exportPlacementApplicationsHandler);
router.get('/export/placement-offers', authorizeRoles('ADMIN'), exportPlacementOffersHandler);
router.get('/export/placement-roster', authorizeRoles('ADMIN'), exportPlacementRosterHandler);

// ---- Error report workbook ----
router.post('/errors/download', authorizeRoles('ADMIN', 'FACULTY'), downloadErrorWorkbook);

export default router;
