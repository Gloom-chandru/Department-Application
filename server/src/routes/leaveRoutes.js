import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { configureUploadMiddleware } from '../middleware/upload.js';
import {
  submitRequest,
  getStudentRequests,
  getStudentRequestById,
  cancelRequest,
  getReviewers,
  getFacultyReviewInbox,
  getFacultyRequestById,
  approveRequest,
  rejectRequest,
  getAdminRequests,
  getAdminRequestById,
  downloadDocument
} from '../controllers/leaveController.js';

const router = express.Router();

// Static student/faculty/admin routes first to prevent dynamic param collisions
router.get(
  '/reviewers',
  authenticateToken,
  authorizeRoles('STUDENT'),
  getReviewers
);

router.get(
  '/review',
  authenticateToken,
  authorizeRoles('FACULTY'),
  getFacultyReviewInbox
);

router.get(
  '/admin',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getAdminRequests
);

router.get(
  '/admin/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  getAdminRequestById
);

// Dynamic routes afterwards
router.post(
  '/',
  authenticateToken,
  authorizeRoles('STUDENT'),
  configureUploadMiddleware('leave', 'document', true),
  submitRequest
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles('STUDENT'),
  getStudentRequests
);

router.get(
  '/:id',
  authenticateToken,
  getStudentRequestById
);

// Dynamic status transitions
router.patch(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles('STUDENT'),
  cancelRequest
);

router.patch(
  '/:id/approve',
  authenticateToken,
  authorizeRoles('FACULTY'),
  approveRequest
);

router.patch(
  '/:id/reject',
  authenticateToken,
  authorizeRoles('FACULTY'),
  rejectRequest
);

router.get(
  '/:id/document',
  authenticateToken,
  downloadDocument
);

export default router;
