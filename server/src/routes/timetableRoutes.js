import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  // Period Template
  getPeriods, createPeriod, updatePeriod, deletePeriod,
  // Room
  getRooms, createRoom, updateRoom, deleteRoom,
  // Schedule
  createSchedule, getSchedules, getScheduleDetails, updateSchedule,
  publishSchedule, archiveSchedule,
  // Slots
  createSlot, bulkCreateSlots, updateSlot, deleteSlot,
  // Views
  getStudentTimetable, getFacultyTimetable
} from '../controllers/timetableController.js';

const router = express.Router();

// ---- Period Template routes (Admin) ----
router.get('/periods', authenticateToken, authorizeRoles('ADMIN'), getPeriods);
router.post('/periods', authenticateToken, authorizeRoles('ADMIN'), createPeriod);
router.patch('/periods/:id', authenticateToken, authorizeRoles('ADMIN'), updatePeriod);
router.delete('/periods/:id', authenticateToken, authorizeRoles('ADMIN'), deletePeriod);

// ---- Room routes (Admin) ----
router.get('/rooms', authenticateToken, authorizeRoles('ADMIN'), getRooms);
router.post('/rooms', authenticateToken, authorizeRoles('ADMIN'), createRoom);
router.patch('/rooms/:id', authenticateToken, authorizeRoles('ADMIN'), updateRoom);
router.delete('/rooms/:id', authenticateToken, authorizeRoles('ADMIN'), deleteRoom);

// ---- Schedule routes (Admin) ----
router.post('/schedules', authenticateToken, authorizeRoles('ADMIN'), createSchedule);
router.get('/schedules', authenticateToken, authorizeRoles('ADMIN'), getSchedules);
router.get('/schedules/:id', authenticateToken, authorizeRoles('ADMIN'), getScheduleDetails);
router.patch('/schedules/:id', authenticateToken, authorizeRoles('ADMIN'), updateSchedule);

// ---- Slot routes (Admin) ----
router.post('/schedules/:id/slots', authenticateToken, authorizeRoles('ADMIN'), createSlot);
router.post('/schedules/:id/slots/bulk', authenticateToken, authorizeRoles('ADMIN'), bulkCreateSlots);
router.patch('/slots/:id', authenticateToken, authorizeRoles('ADMIN'), updateSlot);
router.delete('/slots/:id', authenticateToken, authorizeRoles('ADMIN'), deleteSlot);

// ---- Schedule lifecycle (Admin) ----
router.post('/schedules/:id/publish', authenticateToken, authorizeRoles('ADMIN'), publishSchedule);
router.post('/schedules/:id/archive', authenticateToken, authorizeRoles('ADMIN'), archiveSchedule);

// ---- Student view ----
router.get('/student', authenticateToken, authorizeRoles('STUDENT'), getStudentTimetable);

// ---- Faculty view ----
router.get('/faculty', authenticateToken, authorizeRoles('FACULTY'), getFacultyTimetable);

export default router;
