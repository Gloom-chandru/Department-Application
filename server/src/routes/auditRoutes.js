import express from 'express';
import { getAuditLogs, getAuditLogDetails } from '../controllers/auditController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Enforce JWT authentication and restrict access to ADMIN role only
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

// Query endpoints
router.get('/', getAuditLogs);
router.get('/:id', getAuditLogDetails);

export default router;
