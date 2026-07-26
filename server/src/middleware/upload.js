import multer from 'multer';
import { validateUpload } from '../utils/fileValidator.js';
import { config } from '../config/env.js';

// Use memory storage to allow magic-byte scanning before writing to disk
const storage = multer.memoryStorage();

const uploadInstance = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSize,
  }
});

// Define allowed extensions by category
const CATEGORY_POLICIES = {
  assignments: {
    allowedExtensions: ['.pdf', '.docx', '.png', '.jpg', '.jpeg'],
  },
  submissions: {
    allowedExtensions: ['.pdf', '.docx', '.png', '.jpg', '.jpeg'],
  },
  leave: {
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  },
  od: {
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  }
};

/**
 * Express middleware factory to handle single file upload and run security validations.
 * Category must be one of: 'assignments', 'submissions', 'leave', 'od'
 */
export const configureUploadMiddleware = (category, fieldName, isOptional = false) => {
  const policy = CATEGORY_POLICIES[category];
  if (!policy) {
    throw new Error(`Invalid category for upload middleware: ${category}`);
  }

  const multerMiddleware = uploadInstance.single(fieldName);

  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      console.log('configureUploadMiddleware file details:', { 
        category, 
        fieldName, 
        isOptional, 
        hasFile: !!req.file, 
        body: req.body 
      });
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: `File size exceeds the limit of ${(config.maxUploadSize / 1024 / 1024).toFixed(0)}MB`
          });
        }
        return res.status(400).json({ message: err.message || 'File upload error' });
      }

      const file = req.file;
      if (!file) {
        if (isOptional) {
          return next();
        }
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Run multiple-signal checks (extension, mime-type, magic bytes, size)
      const validation = validateUpload(file, policy.allowedExtensions, config.maxUploadSize);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.reason });
      }

      next();
    });
  };
};
