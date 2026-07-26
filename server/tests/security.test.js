import request from 'supertest';
import app from '../src/index.js';
import storageAdapter from '../src/utils/storageService.js';

describe('Phase 1: Foundation & Security Tests', () => {
  let adminToken = '';
  let studentToken = '';
  let facultyToken = '';

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@velammal.edu.in', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    // 2. Authenticate Student
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
    studentToken = studentLogin.body.accessToken;

    // 3. Authenticate Faculty
    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh.kumar@velammal.edu.in', password: 'password123' });
    facultyToken = facultyLogin.body.accessToken;
  });

  describe('JWT Authentication Security', () => {
    test('Blocked upload if JWT is missing', async () => {
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .attach('file', Buffer.from('%PDF-1.5 test content'), 'test.pdf');
      expect(res.statusCode).toBe(401);
    });

    test('Blocked upload if JWT is invalid', async () => {
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', 'Bearer invalid_token_value')
        .attach('file', Buffer.from('%PDF-1.5 test content'), 'test.pdf');
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Upload File-Type & Content Validations', () => {
    test('Accept valid PDF upload by Admin', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%EOF');
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdfBuffer, 'document.pdf');

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('fileRef');
      expect(res.body.fileRef.startsWith('assignments/')).toBe(true);

      // Cleanup
      const parts = res.body.fileRef.split('/');
      await storageAdapter.deleteFile(parts[0], parts[1]);
    });

    test('Reject file signature spoofing (renamed EXE to PDF)', async () => {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', exeBuffer, 'malicious.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('signature check failed');
    });

    test('Reject fake PDF (text content renamed to PDF)', async () => {
      const textBuffer = Buffer.from('Just normal text files content');
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', textBuffer, 'fake.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('signature check failed');
    });

    test('Reject generic ZIP renamed to DOCX (missing Office XML parts)', async () => {
      // Create a dummy PK zip header without required word/document.xml
      const dummyZipBuffer = Buffer.alloc(100);
      dummyZipBuffer.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
      
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', dummyZipBuffer, 'fake_docx.docx');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('signature check failed');
    });

    test('Reject unsupported executable extensions (.exe)', async () => {
      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('MZ ...'), 'payload.exe');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('not allowed');
    });

    test('Reject unknown category parameter', async () => {
      const res = await request(app)
        .post('/api/files/upload/unknown_category')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4\n%EOF'), 'doc.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Invalid category');
    });

    test('Reject oversized upload (> 5MB)', async () => {
      // Create buffer exceeding 5MB
      const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 100);
      bigBuffer.write('%PDF-1.4');

      const res = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', bigBuffer, 'huge.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('exceeds the limit');
    });
  });

  describe('Authorization and Path Security', () => {
    test('Default to DENY download for Student role in Phase 1', async () => {
      // First admin uploads a valid PDF
      const pdfBuffer = Buffer.from('%PDF-1.4\n%EOF');
      const uploadRes = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdfBuffer, 'student_test.pdf');
      
      const fileRef = uploadRes.body.fileRef;
      const filename = fileRef.split('/')[1];

      // Student tries to download the file
      const downloadRes = await request(app)
        .get(`/api/files/assignments/${filename}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(downloadRes.statusCode).toBe(403);
      expect(downloadRes.body.message).toContain('permission');

      // Cleanup
      await storageAdapter.deleteFile('assignments', filename);
    });

    test('Default to DENY download for Faculty role in Phase 1', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%EOF');
      const uploadRes = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdfBuffer, 'faculty_test.pdf');
      
      const fileRef = uploadRes.body.fileRef;
      const filename = fileRef.split('/')[1];

      // Faculty tries to download
      const downloadRes = await request(app)
        .get(`/api/files/assignments/${filename}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(downloadRes.statusCode).toBe(403);

      // Cleanup
      await storageAdapter.deleteFile('assignments', filename);
    });

    test('Allow download for Admin role', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%EOF');
      const uploadRes = await request(app)
        .post('/api/files/upload/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdfBuffer, 'admin_ok.pdf');
      
      const fileRef = uploadRes.body.fileRef;
      const filename = fileRef.split('/')[1];

      // Admin downloads
      const downloadRes = await request(app)
        .get(`/api/files/assignments/${filename}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(downloadRes.statusCode).toBe(200);

      // Cleanup
      await storageAdapter.deleteFile('assignments', filename);
    });

    test('Reject path traversal attempts (../)', async () => {
      const downloadRes = await request(app)
        .get('/api/files/assignments/../../src/index.js')
        .set('Authorization', `Bearer ${adminToken}`);

      // Path resolves to category root check or fails due to not having file in category folder
      expect(downloadRes.statusCode).not.toBe(200);
    });
  });

  describe('Existing Regression Verification', () => {
    test('Verify standard login functionality continues working', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });
});
