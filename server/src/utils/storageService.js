import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const ALLOWED_CATEGORIES = ['assignments', 'submissions', 'leave', 'od'];

// Ensure directory layout exists at startup
const ensureDirectoriesExist = () => {
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
  for (const cat of ALLOWED_CATEGORIES) {
    const catPath = path.join(UPLOAD_ROOT, cat);
    if (!fs.existsSync(catPath)) {
      fs.mkdirSync(catPath, { recursive: true });
    }
  }
};

ensureDirectoriesExist();

export const storageAdapter = {
  /**
   * Saves file to local uploads directory in safe, unique server-controlled filename.
   * Returns stored relative file reference: category/safeFilename
   */
  saveFile: async (category, originalName, buffer) => {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new Error(`Invalid storage category: ${category}`);
    }

    const ext = path.extname(originalName).toLowerCase();
    // Unique server-controlled filename using built-in crypto.randomUUID()
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    const destinationPath = path.join(UPLOAD_ROOT, category, safeFilename);

    await fs.promises.writeFile(destinationPath, buffer);
    return `${category}/${safeFilename}`;
  },

  /**
   * Resolves absolute file path and validates boundary containment to prevent traversal.
   */
  getFilePath: (category, filename) => {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new Error(`Invalid storage category: ${category}`);
    }

    // Sanitize filename to prevent folder escape
    const safeFilename = path.basename(filename);
    const resolvedPath = path.resolve(UPLOAD_ROOT, category, safeFilename);

    // Enforce storage boundary check
    const categoryRoot = path.resolve(UPLOAD_ROOT, category);
    if (!resolvedPath.startsWith(categoryRoot)) {
      throw new Error('Access denied: path traversal attempt detected');
    }

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    return resolvedPath;
  },

  /**
   * Safely deletes file if it exists.
   */
  deleteFile: async (category, filename) => {
    try {
      const filePath = storageAdapter.getFilePath(category, filename);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete file ${category}/${filename}:`, err.message);
    }
  }
};

export { ALLOWED_CATEGORIES };
export default storageAdapter;
