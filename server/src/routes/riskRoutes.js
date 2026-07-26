import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  getStudentMeRisk,
  getFacultyStudentsRisk,
  getFacultyStudentDetailRisk,
  getAdminSummaryRisk,
  getAdminStudentsRisk,
  getAdminStudentDetailRisk,
  recalculateAdminRisk,
} from '../controllers/riskController.js';

const router = express.Router();

// Apply global JWT authentication
router.use(authenticateToken);

// 1. Student endpoint
router.get('/student/me', authorizeRoles('STUDENT'), getStudentMeRisk);

// 2. Faculty endpoints
router.get('/faculty/students', authorizeRoles('FACULTY'), getFacultyStudentsRisk);
router.get('/faculty/student/:studentId', authorizeRoles('FACULTY'), getFacultyStudentDetailRisk);

// 3. Admin endpoints
router.get('/admin/summary', authorizeRoles('ADMIN'), getAdminSummaryRisk);
router.get('/admin/students', authorizeRoles('ADMIN'), getAdminStudentsRisk);
router.get('/admin/student/:studentId', authorizeRoles('ADMIN'), getAdminStudentDetailRisk);
router.post('/admin/recalculate', authorizeRoles('ADMIN'), recalculateAdminRisk);

export default router;
