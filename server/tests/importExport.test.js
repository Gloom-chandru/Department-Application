import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';

describe('Phase 8: Excel & CSV Import/Export Integration Tests', () => {
  let adminToken;
  let facultyToken;
  let studentToken;

  beforeAll(async () => {
    // Obtain tokens for tests
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@velammal.edu.in', password: 'password123' });
    adminToken = adminRes.body.accessToken;

    const facultyRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh.kumar@velammal.edu.in', password: 'password123' });
    facultyToken = facultyRes.body.accessToken;

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
    studentToken = studentRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Role-Based Access Control for Bulk Import/Export', () => {
    it('Should block unauthenticated user from template downloads', async () => {
      const res = await request(app).get('/api/bulk/templates/students');
      expect(res.status).toBe(401);
    });

    it('Should block student from importing students (dry-run)', async () => {
      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('Should allow admin to access template downloads', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/students')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('Should allow faculty to access marks template download', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/marks')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });

  describe('2. Template Generation Verification', () => {
    it('Should download faculty template with proper spreadsheet headers', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/faculty')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/faculty_import_template\.xlsx/i);
    });

    it('Should download timetable template with proper headers', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/timetable')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/timetable_import_template\.xlsx/i);
    });
  });

  describe('3. File Dry-Run Validation Controls', () => {
    it('Should reject dry-run upload if no file is provided', async () => {
      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No file uploaded/i);
    });

    it('Should reject unsupported file types (e.g. .txt file)', async () => {
      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('hello world'), 'test.txt');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not allowed/i);
    });
  });

  describe('4. Export Endpoints Verification', () => {
    it('Should export attendance as CSV for authorized admin', async () => {
      const res = await request(app)
        .get('/api/bulk/export/attendance?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('Should export attendance as XLSX for authorized admin', async () => {
      const res = await request(app)
        .get('/api/bulk/export/attendance?format=xlsx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('Should export marks as XLSX for admin', async () => {
      const res = await request(app)
        .get('/api/bulk/export/marks?format=xlsx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });
});
