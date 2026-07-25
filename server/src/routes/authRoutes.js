import express from 'express';
import { login, register, refreshToken } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/register', authenticateToken, register); // Protected: admin registration

export default router;
