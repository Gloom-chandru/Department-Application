import express from 'express';
import { 
  getFacultySubjects, 
  getStudentsList, 
  markAttendance, 
  updateAttendanceRecord, 
  enterMarks, 
  getExistingAttendance, 
  getExistingMarks 
} from '../controllers/facultyController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('FACULTY'));

router.get('/subjects', getFacultySubjects);
router.get('/students', getStudentsList);
router.post('/attendance', markAttendance);
router.put('/attendance/:id', updateAttendanceRecord);
router.post('/marks', enterMarks);
router.get('/attendance/existing', getExistingAttendance);
router.get('/marks/existing', getExistingMarks);

export default router;
