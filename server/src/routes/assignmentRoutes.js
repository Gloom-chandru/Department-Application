import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { configureUploadMiddleware } from '../middleware/upload.js';
import {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getStudentAssignments,
  getFacultyAssignments,
  getAssignmentDetails,
  submitAssignment,
  getMySubmission,
  getAssignmentSubmissions,
  gradeSubmission,
  downloadAssignmentAttachment,
  downloadSubmissionVersion,
  getAdminAssignmentsOverview
} from '../controllers/assignmentController.js';

const router = express.Router();

// Faculty Assignment routes
router.post(
  '/',
  authenticateToken,
  authorizeRoles('FACULTY'),
  configureUploadMiddleware('assignments', 'attachment', true),
  createAssignment
);

router.patch(
  '/:id',
  authenticateToken,
  authorizeRoles('FACULTY'),
  configureUploadMiddleware('assignments', 'attachment', true),
  updateAssignment
);

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('FACULTY'),
  deleteAssignment
);

router.get(
  '/subject/:subjectId',
  authenticateToken,
  authorizeRoles('FACULTY'),
  getFacultyAssignments
);

router.get(
  '/:id/submissions',
  authenticateToken,
  authorizeRoles('FACULTY'),
  getAssignmentSubmissions
);

router.patch(
  '/:assignmentId/submissions/:submissionId/grade',
  authenticateToken,
  authorizeRoles('FACULTY'),
  gradeSubmission
);

// Student Assignment routes
router.get(
  '/',
  authenticateToken,
  authorizeRoles('STUDENT'),
  getStudentAssignments
);

router.post(
  '/:id/submit',
  authenticateToken,
  authorizeRoles('STUDENT'),
  configureUploadMiddleware('submissions', 'submission'),
  submitAssignment
);

router.get(
  '/:id/my-submission',
  authenticateToken,
  authorizeRoles('STUDENT'),
  getMySubmission
);

// Shared View Details Route
router.get(
  '/:id',
  authenticateToken,
  getAssignmentDetails
);

// Download Attachment / Submission File routes (all authenticated, role validations done inside controller)
router.get(
  '/:id/download',
  authenticateToken,
  downloadAssignmentAttachment
);

router.get(
  '/:id/submissions/:studentId/versions/:versionNumber/download',
  authenticateToken,
  downloadSubmissionVersion
);

// Admin routes
router.get(
  '/admin/overview',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getAdminAssignmentsOverview
);

export default router;
