import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../src/index.js';
import prisma from '../src/utils/db.js';
import { escapeFormula } from '../src/utils/excelService.js';
import bcrypt from 'bcryptjs';

/**
 * Helper: creates a plain XLSX buffer suitable for parseXlsx (headers on row 1, data from row 2).
 * Unlike generateWorkbook, this does NOT add title/subtitle rows.
 */
async function createImportXlsx(columns, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Import');

  // Row 1: headers
  ws.addRow(columns.map(c => c.header));

  // Row 2+: data
  for (const row of rows) {
    ws.addRow(columns.map(c => row[c.key] ?? ''));
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

const XLSX_CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const STUDENT_COLUMNS = [
  { header: 'Roll No', key: 'rollNo' },
  { header: 'Name', key: 'name' },
  { header: 'Email', key: 'email' },
  { header: 'Department Code', key: 'departmentCode' },
  { header: 'Batch Year', key: 'batchYear' },
  { header: 'Section', key: 'section' }
];

const MARKS_COLUMNS = [
  { header: 'Roll No', key: 'rollNo' },
  { header: 'Subject Code', key: 'subjectCode' },
  { header: 'Exam Type', key: 'examType' },
  { header: 'Marks Obtained', key: 'marksObtained' },
  { header: 'Max Marks', key: 'maxMarks' }
];

const TIMETABLE_COLUMNS = [
  { header: 'Subject Code', key: 'subjectCode' },
  { header: 'Day Of Week', key: 'dayOfWeek' },
  { header: 'Start Period', key: 'startPeriod' },
  { header: 'End Period', key: 'endPeriod' }
];

describe('Phase 8: Excel & CSV Import/Export Comprehensive Tests', () => {
  let adminToken;
  let adminUserId;
  let facultyToken;
  let facultyUserId;
  let facultyProfileId;
  let studentToken;
  let studentUserId;

  let testDeptId;
  let testSubjectId;
  let testOtherSubjectId;
  let testDraftScheduleId;
  let testPublishedScheduleId;

  beforeAll(async () => {
    // 1. Authenticate users
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@velammal.edu.in', password: 'password123' });
    adminToken = adminRes.body.accessToken;
    adminUserId = adminRes.body.user.id;

    const facultyRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh.kumar@velammal.edu.in', password: 'password123' });
    facultyToken = facultyRes.body.accessToken;
    facultyUserId = facultyRes.body.user.id;

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'abishek.r@student.velammal.edu.in', password: 'password123' });
    studentToken = studentRes.body.accessToken;
    studentUserId = studentRes.body.user.id;

    const facProfile = await prisma.faculty.findUnique({ where: { userId: facultyUserId } });
    facultyProfileId = facProfile.id;

    // 2. Cleanup previous test data
    await prisma.timetableSlot.deleteMany({ where: { schedule: { name: { startsWith: 'Phase8_Test' } } } });
    await prisma.timetableSchedule.deleteMany({ where: { name: { startsWith: 'Phase8_Test' } } });
    await prisma.mark.deleteMany({ where: { subject: { code: { in: ['P8SUB1', 'P8SUB2'] } } } });
    await prisma.subject.deleteMany({ where: { code: { in: ['P8SUB1', 'P8SUB2'] } } });
    await prisma.student.deleteMany({ where: { rollNo: { startsWith: 'P8STU' } } });
    await prisma.faculty.deleteMany({ where: { user: { email: { startsWith: 'p8fac' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'p8' } } });
    await prisma.department.deleteMany({ where: { code: 'P8D' } });

    // 3. Create test department
    const dept = await prisma.department.create({
      data: { name: 'Phase8 Test Dept', code: 'P8D' }
    });
    testDeptId = dept.id;

    // Subject assigned to ramesh.kumar
    const sub1 = await prisma.subject.create({
      data: {
        name: 'Phase8 Subject 1',
        code: 'P8SUB1',
        semester: 4,
        departmentId: testDeptId,
        facultyId: facultyProfileId
      }
    });
    testSubjectId = sub1.id;

    // Subject NOT assigned to ramesh.kumar
    const priyaFac = await prisma.faculty.findFirst({ where: { user: { email: 'priya.lakshmi@velammal.edu.in' } } });
    const sub2 = await prisma.subject.create({
      data: {
        name: 'Phase8 Subject 2',
        code: 'P8SUB2',
        semester: 4,
        departmentId: testDeptId,
        facultyId: priyaFac.id
      }
    });
    testOtherSubjectId = sub2.id;

    // DRAFT schedule
    const draftSched = await prisma.timetableSchedule.create({
      data: {
        name: 'Phase8_Test_Draft',
        departmentId: testDeptId,
        batchYear: '2024-28',
        section: 'A',
        semester: 4,
        status: 'DRAFT',
        effectiveFrom: new Date('2026-08-01'),
        createdByUserId: adminUserId
      }
    });
    testDraftScheduleId = draftSched.id;

    // PUBLISHED schedule
    const pubSched = await prisma.timetableSchedule.create({
      data: {
        name: 'Phase8_Test_Published',
        departmentId: testDeptId,
        batchYear: '2024-28',
        section: 'B',
        semester: 4,
        status: 'PUBLISHED',
        effectiveFrom: new Date('2026-08-01'),
        createdByUserId: adminUserId
      }
    });
    testPublishedScheduleId = pubSched.id;
  });

  afterAll(async () => {
    await prisma.timetableSlot.deleteMany({ where: { schedule: { name: { startsWith: 'Phase8_Test' } } } });
    await prisma.timetableSchedule.deleteMany({ where: { name: { startsWith: 'Phase8_Test' } } });
    await prisma.mark.deleteMany({ where: { subject: { code: { in: ['P8SUB1', 'P8SUB2'] } } } });
    await prisma.subject.deleteMany({ where: { code: { in: ['P8SUB1', 'P8SUB2'] } } });
    await prisma.student.deleteMany({ where: { rollNo: { startsWith: 'P8STU' } } });
    await prisma.faculty.deleteMany({ where: { user: { email: { startsWith: 'p8fac' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'p8' } } });
    await prisma.department.deleteMany({ where: { code: 'P8D' } });
    await prisma.$disconnect();
  });

  // =====================================================
  // 1. ROLE-BASED ACCESS CONTROL
  // =====================================================
  describe('1. Role-Based Access Control', () => {
    it('Should block unauthenticated user from template downloads', async () => {
      const res = await request(app).get('/api/bulk/templates/students');
      expect(res.status).toBe(401);
    });

    it('Should block student from student import dry-run (ADMIN-only)', async () => {
      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('Should allow admin to access student template', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/students')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('Should allow faculty to access marks template', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/marks')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });

  // =====================================================
  // 2. TEMPLATE GENERATION
  // =====================================================
  describe('2. Template Generation', () => {
    it('Should download faculty template with correct filename', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/faculty')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/faculty_import_template\.xlsx/i);
    });

    it('Should download timetable template with correct filename', async () => {
      const res = await request(app)
        .get('/api/bulk/templates/timetable')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/timetable_import_template\.xlsx/i);
    });
  });

  // =====================================================
  // 3. DRY-RUN: ZERO MUTATION + HASH BINDING + TOKEN
  // =====================================================
  describe('3. Dry-Run Zero Mutation & Cryptographic Hash Binding', () => {
    it('Should reject dry-run if no file is provided', async () => {
      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No file uploaded/i);
    });

    it('Should reject unsupported file types (e.g. .txt)', async () => {
      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('hello world'), 'test.txt');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not allowed/i);
    });

    it('Should perform ZERO database mutations during dry-run', async () => {
      const usersBefore = await prisma.user.count();
      const studentsBefore = await prisma.student.count();

      const buf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STU01', name: 'Phase8 Student 1', email: 'p8stu1@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'students.xlsx', contentType: XLSX_CT });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.token).toBeDefined();

      const usersAfter = await prisma.user.count();
      const studentsAfter = await prisma.student.count();
      expect(usersAfter).toEqual(usersBefore);
      expect(studentsAfter).toEqual(studentsBefore);
    });

    it('Should reject confirm when file content differs from dry-run (hash mismatch)', async () => {
      const dryRunBuf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STU01', name: 'Phase8 Student 1', email: 'p8stu1@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      const dryRunRes = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', dryRunBuf, { filename: 'students.xlsx', contentType: XLSX_CT });

      expect(dryRunRes.status).toBe(200);
      const token = dryRunRes.body.token;

      // Tampered file with different content
      const tamperedBuf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STU99', name: 'Hacker', email: 'hacked@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      const confirmRes = await request(app)
        .post('/api/bulk/import/students/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', tamperedBuf, { filename: 'students.xlsx', contentType: XLSX_CT })
        .field('token', token);

      expect(confirmRes.status).toBe(400);
      expect(confirmRes.body.message).toMatch(/confirmed file content does not match/i);
    });

    it('Should reject confirm with invalid/expired token', async () => {
      const buf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STU01', name: 'Test', email: 'test@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      const res = await request(app)
        .post('/api/bulk/import/students/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'students.xlsx', contentType: XLSX_CT })
        .field('token', 'invalid-uuid-token');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Validation token not found/i);
    });
  });

  // =====================================================
  // 4. DUPLICATE DETECTION (IN-FILE + DATABASE)
  // =====================================================
  describe('4. Duplicate Detection', () => {
    it('Should detect duplicate roll numbers within the spreadsheet', async () => {
      const buf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STU01', name: 'Student One', email: 'unique1@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' },
        { rollNo: 'P8STU01', name: 'Student Two', email: 'unique2@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'students.xlsx', contentType: XLSX_CT });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.errors.some(e => e.code === 'DUPLICATE_IN_FILE')).toBe(true);
    });

    it('Should detect duplicate emails against existing database records', async () => {
      // Use an existing seeded student email
      const existingStudent = await prisma.student.findFirst({ include: { user: true } });

      const buf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STUNEW99', name: 'New Student', email: existingStudent.user.email, departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      const res = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'students.xlsx', contentType: XLSX_CT });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.errors.some(e => e.code === 'DUPLICATE_IN_DATABASE')).toBe(true);
    });
  });

  // =====================================================
  // 5. ATOMICITY + BCRYPT PASSWORDS + AUDIT PRIVACY
  // =====================================================
  describe('5. Atomic Import, Bcrypt Passwords, Audit Log Privacy', () => {
    it('Should import students atomically with bcrypt-hashed passwords; audit logs exclude plaintext', async () => {
      const buf = await createImportXlsx(STUDENT_COLUMNS, [
        { rollNo: 'P8STU10', name: 'Phase8 Stu10', email: 'p8stu10@test.com', departmentCode: 'P8D', batchYear: '2024-28', section: 'A' }
      ]);

      // Dry-run
      const dryRun = await request(app)
        .post('/api/bulk/import/students/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'students.xlsx', contentType: XLSX_CT });

      expect(dryRun.status).toBe(200);
      expect(dryRun.body.valid).toBe(true);

      // Confirm with same file + token
      const confirmRes = await request(app)
        .post('/api/bulk/import/students/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'students.xlsx', contentType: XLSX_CT })
        .field('token', dryRun.body.token);

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.credentials).toBeDefined();
      expect(confirmRes.body.credentials.length).toBe(1);

      const tempPass = confirmRes.body.credentials[0].temporaryPassword;
      expect(tempPass).toHaveLength(12);

      // Verify bcrypt hash in DB
      const dbUser = await prisma.user.findUnique({ where: { email: 'p8stu10@test.com' } });
      expect(dbUser).toBeDefined();
      const passMatch = await bcrypt.compare(tempPass, dbUser.passwordHash);
      expect(passMatch).toBe(true);

      // Verify audit log does NOT leak plaintext password
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'BULK_STUDENT_IMPORT', actorUserId: adminUserId },
        orderBy: { timestamp: 'desc' }
      });
      expect(auditLog).toBeDefined();
      expect(JSON.stringify(auditLog)).not.toContain(tempPass);
    });
  });

  // =====================================================
  // 6. MARKS: SUBJECT OWNERSHIP + CREATE/UPDATE/NO-OP
  // =====================================================
  describe('6. Marks Import: Subject Ownership & CREATE/UPDATE/NO-OP', () => {
    it('Should reject faculty marks import for subjects not assigned to them', async () => {
      const buf = await createImportXlsx(MARKS_COLUMNS, [
        { rollNo: '2024AIDS001', subjectCode: 'P8SUB2', examType: 'INTERNAL1', marksObtained: 40, maxMarks: 50 }
      ]);

      const res = await request(app)
        .post('/api/bulk/import/marks/dry-run')
        .set('Authorization', `Bearer ${facultyToken}`)
        .attach('file', buf, { filename: 'marks.xlsx', contentType: XLSX_CT });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.errors.some(e => e.code === 'UNAUTHORIZED_SUBJECT')).toBe(true);
    });

    it('Should detect CREATE, then NO-OP on re-import with identical values', async () => {
      // Use P8STU10 created in test 5 — same department (P8D) as P8SUB1
      const student = await prisma.student.findFirst({ where: { rollNo: 'P8STU10' } });
      expect(student).toBeDefined();

      const buf = await createImportXlsx(MARKS_COLUMNS, [
        { rollNo: student.rollNo, subjectCode: 'P8SUB1', examType: 'INTERNAL1', marksObtained: 45, maxMarks: 50 }
      ]);

      // 1. Dry-run -> CREATE
      const dryRun = await request(app)
        .post('/api/bulk/import/marks/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'marks.xlsx', contentType: XLSX_CT });

      expect(dryRun.status).toBe(200);
      expect(dryRun.body.preview[0].action).toBe('CREATE');

      // 2. Confirm CREATE
      const confirmCreate = await request(app)
        .post('/api/bulk/import/marks/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'marks.xlsx', contentType: XLSX_CT })
        .field('token', dryRun.body.token);

      expect(confirmCreate.status).toBe(200);

      // 3. Dry-run again identical -> NO-OP
      const dryRunNoop = await request(app)
        .post('/api/bulk/import/marks/dry-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'marks.xlsx', contentType: XLSX_CT });

      expect(dryRunNoop.status).toBe(200);
      expect(dryRunNoop.body.preview[0].action).toBe('NO-OP');

      // Record audit count before NO-OP confirm
      const auditCountBefore = await prisma.auditLog.count({ where: { action: 'MARK_CREATED' } });

      const confirmNoop = await request(app)
        .post('/api/bulk/import/marks/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'marks.xlsx', contentType: XLSX_CT })
        .field('token', dryRunNoop.body.token);

      expect(confirmNoop.status).toBe(200);
      expect(confirmNoop.body.summary.noopCount).toBe(1);

      // NO-OP should NOT create new MARK_CREATED audit entries
      const auditCountAfter = await prisma.auditLog.count({ where: { action: 'MARK_CREATED' } });
      expect(auditCountAfter).toEqual(auditCountBefore);
    });
  });

  // =====================================================
  // 7. TIMETABLE: DRAFT vs PUBLISHED
  // =====================================================
  describe('7. Timetable Schedule State Scoping', () => {
    it('Should reject timetable import into PUBLISHED schedule', async () => {
      const buf = await createImportXlsx(TIMETABLE_COLUMNS, [
        { subjectCode: 'P8SUB1', dayOfWeek: 1, startPeriod: 1, endPeriod: 1 }
      ]);

      const res = await request(app)
        .post(`/api/bulk/import/timetable/${testPublishedScheduleId}/dry-run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'timetable.xlsx', contentType: XLSX_CT });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only be imported into a DRAFT schedule/i);
    });

    it('Should allow timetable import into DRAFT schedule', async () => {
      const buf = await createImportXlsx(TIMETABLE_COLUMNS, [
        { subjectCode: 'P8SUB1', dayOfWeek: 1, startPeriod: 1, endPeriod: 1 }
      ]);

      const res = await request(app)
        .post(`/api/bulk/import/timetable/${testDraftScheduleId}/dry-run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buf, { filename: 'timetable.xlsx', contentType: XLSX_CT });

      expect(res.status).toBe(200);
    });
  });

  // =====================================================
  // 8. EXPORT SCOPING & FORMAT TESTS
  // =====================================================
  describe('8. Export Endpoints Security & Formatting', () => {
    it('Should export attendance as CSV for admin', async () => {
      const res = await request(app)
        .get('/api/bulk/export/attendance?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('Should export attendance as XLSX for admin', async () => {
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

    it('Should block faculty from exporting attendance for unowned subject', async () => {
      const res = await request(app)
        .get(`/api/bulk/export/attendance?subjectId=${testOtherSubjectId}`)
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(403);
    });

    it('Should block student from exporting timetable of another class', async () => {
      const res = await request(app)
        .get(`/api/bulk/export/timetable/${testDraftScheduleId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });
  });

  // =====================================================
  // 9. FORMULA INJECTION & ERROR WORKBOOK
  // =====================================================
  describe('9. Formula Injection Prevention & Error Workbook', () => {
    it('Should escape formula injection characters =, +, -, @', () => {
      expect(escapeFormula('=1+2')).toBe("'=1+2");
      expect(escapeFormula('+CMD')).toBe("'+CMD");
      expect(escapeFormula('-10')).toBe("'-10");
      expect(escapeFormula('@SUM')).toBe("'@SUM");
      expect(escapeFormula('Normal text')).toBe('Normal text');
      expect(escapeFormula(null)).toBe('');
      expect(escapeFormula(undefined)).toBe('');
    });

    it('Should allow downloading error workbook via POST /api/bulk/errors/download', async () => {
      const errorList = [
        { row: 2, column: 'email', code: 'INVALID_FORMAT', message: 'Invalid email address.' }
      ];

      const res = await request(app)
        .post('/api/bulk/errors/download')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ errors: errorList });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });
});
