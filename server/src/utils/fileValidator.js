import path from 'path';

/**
 * Parses zip local file headers in buffer to list file names without decompressing the content.
 * Immune to zip-bomb decompression attacks as no decompression is performed.
 */
export const getZipFileNames = (buffer) => {
  const fileNames = [];
  let offset = 0;

  // ZIP local header signature is 0x04034b50 (PK\x03\x04)
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const fileNameStart = offset + 30;
      const fileNameEnd = fileNameStart + fileNameLength;

      if (fileNameEnd <= buffer.length) {
        const fileName = buffer.toString('utf8', fileNameStart, fileNameEnd);
        fileNames.push(fileName);
      }

      // Move offset forward past header, filename, extra field and compressed payload
      // To guard against malformed archives with invalid compressedSize leading to infinite loops
      const nextOffset = fileNameStart + fileNameLength + extraFieldLength + compressedSize;
      if (nextOffset <= offset) {
        offset++;
      } else {
        offset = nextOffset;
      }
    } else {
      offset++;
    }
  }
  return fileNames;
};

/**
 * Validates the file signature (magic bytes) against the allowed extension.
 * For DOCX, verifies container structures without decompressing data.
 */
export const validateFileSignature = (buffer, extension) => {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const ext = extension.toLowerCase();
  const hex = buffer.toString('hex', 0, 8);

  // 1. PDF Validation (Begins with %PDF -> 25 50 44 46)
  if (hex.startsWith('25504446')) {
    return ext === '.pdf';
  }

  // 2. PNG Validation (Begins with 89 50 4E 47 0D 0A 1A 0A)
  if (hex.startsWith('89504e47')) {
    return ext === '.png';
  }

  // 3. JPEG/JPG Validation (Begins with FF D8 FF)
  if (hex.startsWith('ffd8ff')) {
    return ext === '.jpg' || ext === '.jpeg';
  }

  // 4. ZIP/Office Container Validation (Begins with PK -> 50 4B 03 04, 50 4B 05 06, 50 4B 07 08)
  if (hex.startsWith('504b0304') || hex.startsWith('504b0506') || hex.startsWith('504b0708')) {
    if (ext === '.docx' || ext === '.xlsx') {
      try {
        const fileNames = getZipFileNames(buffer);
        if (ext === '.docx') {
          return fileNames.includes('[Content_Types].xml') && fileNames.includes('word/document.xml');
        }
        if (ext === '.xlsx') {
          return fileNames.includes('[Content_Types].xml') && (fileNames.includes('xl/workbook.xml') || fileNames.includes('xl/sharedStrings.xml'));
        }
      } catch (err) {
        return false;
      }
    }
    // Generic ZIP is not an approved upload type
    return false;
  }

  // 5. CSV validation (plain text, must not match zip/PDF/image magic bytes)
  if (ext === '.csv') {
    // Simply check it doesn't match common binary file signatures
    const isBinary = hex.startsWith('504b0304') || hex.startsWith('25504446') || hex.startsWith('89504e47') || hex.startsWith('ffd8ff');
    return !isBinary;
  }

  return false;
};

/**
 * Overall helper to validate extension, reported MIME-type, and magic bytes.
 */
export const validateUpload = (file, allowedExtensions, maxSizeBytes) => {
  if (!file) return { valid: false, reason: 'No file provided' };

  // Size check
  if (file.size > maxSizeBytes) {
    return { valid: false, reason: `File size exceeds limit (${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB)` };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  
  // Extension check
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, reason: `Extension ${ext} is not allowed` };
  }

  // Basic MIME verification
  const mimeMapping = {
    '.pdf': ['application/pdf'],
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream']
  };

  const expectedMimes = mimeMapping[ext];
  if (!expectedMimes || !expectedMimes.includes(file.mimetype)) {
    return { valid: false, reason: `MIME type mismatch for extension ${ext}` };
  }

  // Magic bytes / signature check
  const hasValidSignature = validateFileSignature(file.buffer, ext);
  if (!hasValidSignature) {
    return { valid: false, reason: `File content signature check failed for ${ext}` };
  }

  return { valid: true };
};
