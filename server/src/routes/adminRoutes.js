import express from 'express';
import {
  getAnalytics,
  updateSetting,
  getSettings,
  getExportData,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getFaculty,
  updateFaculty,
  deleteFaculty,
  getStudents,
  updateStudent,
  deleteStudent,
} from '../controllers/adminController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

// Analytics & settings
router.get('/analytics', getAnalytics);
router.get('/settings', getSettings);
router.put('/settings', updateSetting);
router.get('/export', getExportData);

// CRUD: Departments
router.get('/departments', getDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.delete('/departments/:id', deleteDepartment);

// CRUD: Subjects
router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

// CRUD: Faculty
router.get('/faculty', getFaculty);
router.put('/faculty/:id', updateFaculty);
router.delete('/faculty/:id', deleteFaculty);

// CRUD: Students
router.get('/students', getStudents);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

export default router;
