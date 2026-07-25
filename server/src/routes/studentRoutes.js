import express from 'express';
import { getProfile, getAttendance, getMarks, getNotifications, markNotificationAsRead } from '../controllers/studentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('STUDENT'));

router.get('/profile', getProfile);
router.get('/attendance', getAttendance);
router.get('/marks', getMarks);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);

export default router;
