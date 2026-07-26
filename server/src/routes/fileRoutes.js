import express from 'express';
import { uploadFile, downloadFile } from '../controllers/fileController.js';
import { authenticateToken } from '../middleware/auth.js';
import { configureUploadMiddleware } from '../middleware/upload.js';

const router = express.Router();

// Require JWT authentication for all file operations
router.use(authenticateToken);

// Upload route: requires category parameter ('assignments', 'submissions', 'leave', 'od')
router.post('/upload/:category', (req, res, next) => {
  const { category } = req.params;
  try {
    const middleware = configureUploadMiddleware(category, 'file');
    middleware(req, res, next);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}, uploadFile);

// Secure download/view route
router.get('/:category/:filename', downloadFile);

export default router;
