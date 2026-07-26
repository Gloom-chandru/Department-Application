import storageAdapter from '../utils/storageService.js';
import { authorizeFileAccess } from '../utils/fileAuthorization.js';

/**
 * Handles secure file uploads.
 * Expects file in req.file (from multer).
 */
export const uploadFile = async (req, res) => {
  try {
    const { category } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Save file via storage adapter abstraction
    const fileRef = await storageAdapter.saveFile(category, file.originalname, file.buffer);

    res.status(201).json({
      message: 'File uploaded successfully',
      fileRef,
    });
  } catch (error) {
    console.error('File upload controller error:', error);
    res.status(500).json({ message: error.message || 'File upload failed' });
  }
};

/**
 * Handles secure file downloads.
 * Enforces boundary containment and checks authorization.
 */
export const downloadFile = async (req, res) => {
  try {
    const { category, filename } = req.params;
    const user = req.user;

    // 1. Check permission hook
    const isAuthorized = await authorizeFileAccess(user, category, filename);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this file' });
    }

    // 2. Fetch path and enforce boundaries
    const filePath = storageAdapter.getFilePath(category, filename);
    if (!filePath) {
      return res.status(404).json({ message: 'File not found' });
    }

    // 3. Send file safely
    res.sendFile(filePath);
  } catch (error) {
    console.error('File download controller error:', error);
    res.status(500).json({ message: error.message || 'File download failed' });
  }
};
