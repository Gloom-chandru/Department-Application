import express from 'express';
import { 
  getStudentSummary, 
  getFacultySubjectAnalytics, 
  getAdminSummary 
} from '../controllers/analyticsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Student summary analytics (natively scoped to session studentId)
router.get('/student/summary', authorizeRoles('STUDENT'), getStudentSummary);

// Faculty analytics for specific assigned subject
router.get('/faculty/subject/:subjectId', authorizeRoles('FACULTY'), getFacultySubjectAnalytics);

// Admin global aggregate summary
router.get('/admin/summary', authorizeRoles('ADMIN'), getAdminSummary);

export default router;
