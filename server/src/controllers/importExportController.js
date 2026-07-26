import path from 'path';
import prisma from '../utils/db.js';
import { validateUpload } from '../utils/fileValidator.js';
import { logAudit } from '../utils/audit.js';
import {
  parseXlsx,
  parseCsv,
  generateWorkbook,
  generateCsv,
  generateErrorWorkbook
} from '../utils/excelService.js';
import {
  computeFileHash,
  registerValidation,
  getAndVerifyValidation
} from '../utils/validationStore.js';
import {
  validateStudentsData,
  importStudentsConfirmed
} from '../services/studentImportService.js';
import {
  validateFacultyData,
  importFacultyConfirmed
} from '../services/facultyImportService.js';
import {
  validateMarksData,
  importMarksConfirmed
} from '../services/marksImportService.js';
import {
  validateTimetableData,
  importTimetableConfirmed
} from '../services/timetableImportService.js';
import {
  exportAttendanceData,
  exportMarksData,
  exportTimetableGrid
} from '../services/exportService.js';
import {
  validatePlacementProfileData,
  importPlacementProfilesConfirmed,
  validateCompanyData,
  importCompaniesConfirmed,
  validateOfferImportData,
  importOffersConfirmed
} from '../services/placementImportService.js';
import {
  exportPlacementApplications,
  exportPlacementOffers,
  exportPlacementRoster
} from '../services/placementExportService.js';

// Multer memory storage limit
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

// Helper to run common parsing, magic signature verification, and limits checks
async function parseUploadedFile(file) {
  if (!file) {
    throw new Error('No file uploaded.');
  }

  const allowedExtensions = ['.xlsx', '.csv'];
  const uploadValidation = validateUpload(file, allowedExtensions, MAX_UPLOAD_SIZE);
  if (!uploadValidation.valid) {
    throw new Error(uploadValidation.reason);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === '.xlsx') {
    return await parseXlsx(file.buffer);
  } else if (ext === '.csv') {
    return await parseCsv(file.buffer);
  } else {
    throw new Error('Unsupported file extension.');
  }
}

// ==================== TEMPLATES ====================

export const getStudentTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Roll No', key: 'rollNo', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department Code', key: 'departmentCode', width: 18 },
      { header: 'Batch Year', key: 'batchYear', width: 15 },
      { header: 'Section', key: 'section', width: 12 },
      { header: 'Phone', key: 'phone', width: 15 }
    ];

    const rows = [
      {
        rollNo: '23AI001',
        name: 'John Doe',
        email: 'john.doe@test.com',
        departmentCode: 'AIDS',
        batchYear: '2024-28',
        section: 'A',
        phone: '9876543210'
      }
    ];

    const buffer = await generateWorkbook({
      title: 'Student Import Template',
      subtitle: 'Fill in student details. Password column is excluded (auto-generated). Phone must be 10 digits.',
      columns,
      rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating student template:', error);
    res.status(500).json({ message: 'Server error generating student template.' });
  }
};

export const getFacultyTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department Code', key: 'departmentCode', width: 18 },
      { header: 'Designation', key: 'designation', width: 20 }
    ];

    const rows = [
      {
        name: 'Dr. Jane Smith',
        email: 'jane.smith@test.com',
        departmentCode: 'CSE',
        designation: 'Associate Professor'
      }
    ];

    const buffer = await generateWorkbook({
      title: 'Faculty Import Template',
      subtitle: 'Register faculty. Designation is required. Passwords are auto-generated.',
      columns,
      rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=faculty_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating faculty template:', error);
    res.status(500).json({ message: 'Server error generating faculty template.' });
  }
};

export const getMarksTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Roll No', key: 'rollNo', width: 15 },
      { header: 'Subject Code', key: 'subjectCode', width: 15 },
      { header: 'Exam Type', key: 'examType', width: 15 },
      { header: 'Marks Obtained', key: 'marksObtained', width: 18 },
      { header: 'Max Marks', key: 'maxMarks', width: 15 }
    ];

    const rows = [
      {
        rollNo: '23AI001',
        subjectCode: 'AD401',
        examType: 'INTERNAL1',
        marksObtained: 42,
        maxMarks: 50
      }
    ];

    const buffer = await generateWorkbook({
      title: 'Marks Import Template',
      subtitle: 'Supported examType: INTERNAL1, INTERNAL2, SEMESTER. marksObtained must be >= 0 and <= maxMarks.',
      columns,
      rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=marks_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating marks template:', error);
    res.status(500).json({ message: 'Server error generating marks template.' });
  }
};

export const getTimetableTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Subject Code', key: 'subjectCode', width: 15 },
      { header: 'Day Of Week', key: 'dayOfWeek', width: 15 },
      { header: 'Start Period', key: 'startPeriod', width: 15 },
      { header: 'End Period', key: 'endPeriod', width: 15 },
      { header: 'Room No', key: 'roomNo', width: 15 }
    ];

    const rows = [
      {
        subjectCode: 'AD401',
        dayOfWeek: 1, // Monday
        startPeriod: 1,
        endPeriod: 1,
        roomNo: 'LH-101'
      }
    ];

    const buffer = await generateWorkbook({
      title: 'Timetable Import Template',
      subtitle: 'Import slots into a DRAFT schedule. dayOfWeek: 1=Mon...6=Sat. startPeriod/endPeriod must be valid templates.',
      columns,
      rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=timetable_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating timetable template:', error);
    res.status(500).json({ message: 'Server error generating timetable template.' });
  }
};

// ==================== DRY RUNS ====================

export const studentDryRun = async (req, res) => {
  try {
    const parsed = await parseUploadedFile(req.file);
    const result = await validateStudentsData(parsed.rows);

    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'STUDENT',
      hash,
      data: result.data,
      userId: req.user.id
    });

    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const facultyDryRun = async (req, res) => {
  try {
    const parsed = await parseUploadedFile(req.file);
    const result = await validateFacultyData(parsed.rows);

    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'FACULTY',
      hash,
      data: result.data,
      userId: req.user.id
    });

    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const marksDryRun = async (req, res) => {
  try {
    const parsed = await parseUploadedFile(req.file);
    const result = await validateMarksData(parsed.rows, req.user);

    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'MARKS',
      hash,
      data: result.data,
      userId: req.user.id
    });

    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10).map(m => ({
        rollNo: m.rollNo,
        subjectCode: m.subjectCode,
        examType: m.examType,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        action: m.action
      }))
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const timetableDryRun = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const parsed = await parseUploadedFile(req.file);
    const result = await validateTimetableData(parsed.rows, scheduleId);

    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'TIMETABLE',
      hash,
      data: result.data,
      targetId: scheduleId,
      userId: req.user.id
    });

    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==================== CONFIRMATIONS ====================

export const studentConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });

    const hash = computeFileHash(req.file.buffer);
    // Verifies token, file contents hash matching, and owner
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'STUDENT',
      hash
    });

    const credentials = await importStudentsConfirmed(verifiedData, req.user, req);

    res.json({
      message: `${verifiedData.length} students imported successfully.`,
      credentials
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const facultyConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });

    const hash = computeFileHash(req.file.buffer);
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'FACULTY',
      hash
    });

    const credentials = await importFacultyConfirmed(verifiedData, req.user, req);

    res.json({
      message: `${verifiedData.length} faculty members imported successfully.`,
      credentials
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const marksConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });

    const hash = computeFileHash(req.file.buffer);
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'MARKS',
      hash
    });

    const summary = await importMarksConfirmed(verifiedData, req.user, req);

    res.json({
      message: `Marks imported: ${summary.createdCount} created, ${summary.updatedCount} updated, ${summary.noopCount} no-op.`,
      summary
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const timetableConfirm = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });

    const hash = computeFileHash(req.file.buffer);
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'TIMETABLE',
      hash,
      targetId: scheduleId
    });

    const slots = await importTimetableConfirmed(scheduleId, verifiedData, req.user, req);

    res.json({
      message: `${slots.length} timetable slots imported successfully.`
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==================== EXPORTS ====================

export const exportAttendance = async (req, res) => {
  try {
    const { departmentId, batchYear, section, subjectId, format } = req.query;

    // Faculty scope check
    if (req.user.role === 'FACULTY') {
      if (!subjectId) {
        return res.status(400).json({ message: 'subjectId is required for faculty exports.' });
      }
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { faculty: true }
      });
      if (!subject || subject.faculty.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied: You can only export attendance for subjects you teach.' });
      }
    }

    const reportFormat = format === 'csv' ? 'csv' : 'xlsx';
    const buffer = await exportAttendanceData({ departmentId, batchYear, section, subjectId, format: reportFormat });

    // Audit the export action
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'ATTENDANCE_EXPORTED',
      entityType: 'Attendance',
      entityId: subjectId || departmentId || req.user.id,
      newValue: { format: reportFormat, subjectId, departmentId, batchYear, section },
      req
    });

    const filename = `attendance_${departmentId || 'global'}_${batchYear || 'all'}_${section || 'all'}.${reportFormat}`;
    res.setHeader('Content-Type', reportFormat === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting attendance:', error);
    res.status(500).json({ message: 'Server error generating attendance export.' });
  }
};

export const exportMarks = async (req, res) => {
  try {
    const { departmentId, batchYear, section, subjectId, format } = req.query;

    // Faculty scope check
    if (req.user.role === 'FACULTY') {
      if (!subjectId) {
        return res.status(400).json({ message: 'subjectId is required for faculty exports.' });
      }
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { faculty: true }
      });
      if (!subject || subject.faculty.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied: You can only export marks for subjects you teach.' });
      }
    }

    const reportFormat = format === 'csv' ? 'csv' : 'xlsx';
    const buffer = await exportMarksData({ departmentId, batchYear, section, subjectId, format: reportFormat });

    // Audit the export action
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'MARKS_EXPORTED',
      entityType: 'Mark',
      entityId: subjectId || departmentId || req.user.id,
      newValue: { format: reportFormat, subjectId, departmentId, batchYear, section },
      req
    });

    const filename = `marks_${departmentId || 'global'}_${batchYear || 'all'}_${section || 'all'}.${reportFormat}`;
    res.setHeader('Content-Type', reportFormat === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting marks:', error);
    res.status(500).json({ message: 'Server error generating marks export.' });
  }
};

export const exportTimetable = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { format } = req.query;

    const schedule = await prisma.timetableSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });

    // Role scope checks
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (!student ||
          student.departmentId !== schedule.departmentId ||
          student.batchYear !== schedule.batchYear ||
          student.section !== schedule.section) {
        return res.status(403).json({ message: 'Access denied: You can only export your own class timetable.' });
      }
    } else if (req.user.role === 'FACULTY') {
      // Allow if teaching any subject in this schedule
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user.id } });
      if (!faculty) return res.status(403).json({ message: 'Faculty profile not found.' });
      
      const slotsCount = await prisma.timetableSlot.count({
        where: {
          scheduleId,
          subject: { facultyId: faculty.id }
        }
      });
      if (slotsCount === 0) {
        return res.status(403).json({ message: 'Access denied: You do not teach in this schedule.' });
      }
    }

    const reportFormat = format === 'csv' ? 'csv' : 'xlsx';
    const buffer = await exportTimetableGrid(scheduleId, reportFormat);

    // Audit the export action
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMETABLE_EXPORTED',
      entityType: 'TimetableSchedule',
      entityId: scheduleId,
      newValue: { format: reportFormat },
      req
    });

    const filename = `timetable_${schedule.name.replace(/\s+/g, '_')}.${reportFormat}`;
    res.setHeader('Content-Type', reportFormat === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting timetable:', error);
    res.status(500).json({ message: 'Server error generating timetable export.' });
  }
};

// ==================== ERROR WORKBOOKS ====================

export const downloadErrorWorkbook = async (req, res) => {
  try {
    const { errors } = req.body;
    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ message: 'A non-empty errors array is required.' });
    }

    const buffer = await generateErrorWorkbook(errors);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=validation_errors.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting error workbook:', error);
    res.status(500).json({ message: 'Server error generating error workbook.' });
  }
};

// ==================== PHASE 10 PLACEMENT IMPORT/EXPORT ====================

export const getPlacementProfileTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Roll No', key: 'rollNo', width: 15 },
      { header: 'CGPA', key: 'cgpa', width: 10 },
      { header: 'Current Backlogs', key: 'currentBacklogs', width: 16 }
    ];
    const rows = [{ rollNo: '23AI001', cgpa: 8.5, currentBacklogs: 0 }];
    const buffer = await generateWorkbook({
      title: 'Placement Eligibility Import',
      subtitle: 'Update student CGPA and backlog counts. Never derived from marks.',
      columns,
      rows
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=placement_eligibility_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error generating template.' });
  }
};

export const getCompanyImportTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Code', key: 'code', width: 12 },
      { header: 'Industry', key: 'industry', width: 18 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'HR Contact Email', key: 'hrContactEmail', width: 28 }
    ];
    const rows = [{
      name: 'Acme Corp',
      code: 'ACME',
      industry: 'Software',
      website: 'https://acme.example.com',
      hrContactEmail: 'hr@acme.example.com'
    }];
    const buffer = await generateWorkbook({
      title: 'Company Import Template',
      subtitle: 'Bulk create placement companies',
      columns,
      rows
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=companies_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error generating template.' });
  }
};

export const getOfferImportTemplate = async (req, res) => {
  try {
    const columns = [
      { header: 'Roll No', key: 'rollNo', width: 14 },
      { header: 'Company Code', key: 'companyCode', width: 14 },
      { header: 'Drive Title', key: 'driveTitle', width: 24 },
      { header: 'CTC', key: 'ctc', width: 12 },
      { header: 'Status', key: 'status', width: 12 }
    ];
    const rows = [{
      rollNo: '23AI001',
      companyCode: 'ACME',
      driveTitle: 'Software Engineer',
      ctc: 12,
      status: 'OFFERED'
    }];
    const buffer = await generateWorkbook({
      title: 'Offer Import Template',
      subtitle: 'Student must already have applied to the drive. Status: OFFERED|ACCEPTED|DECLINED|EXPIRED|REVOKED',
      columns,
      rows
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=offers_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error generating template.' });
  }
};

export const placementProfileDryRun = async (req, res) => {
  try {
    const parsed = await parseUploadedFile(req.file);
    const result = await validatePlacementProfileData(parsed.rows);
    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'PLACEMENT_PROFILE',
      hash,
      data: result.data,
      userId: req.user.id
    });
    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const placementProfileConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });
    const hash = computeFileHash(req.file.buffer);
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'PLACEMENT_PROFILE',
      hash
    });
    const summary = await importPlacementProfilesConfirmed(verifiedData, req.user, req);
    res.json({ message: `${summary.updatedCount} student eligibility records updated.`, summary });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const companyImportDryRun = async (req, res) => {
  try {
    const parsed = await parseUploadedFile(req.file);
    const result = await validateCompanyData(parsed.rows);
    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'COMPANY',
      hash,
      data: result.data,
      userId: req.user.id
    });
    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const companyImportConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });
    const hash = computeFileHash(req.file.buffer);
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'COMPANY',
      hash
    });
    const summary = await importCompaniesConfirmed(verifiedData, req.user, req);
    res.json({ message: `${summary.createdCount} companies imported.`, summary });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const offerImportDryRun = async (req, res) => {
  try {
    const parsed = await parseUploadedFile(req.file);
    const result = await validateOfferImportData(parsed.rows);
    const hash = computeFileHash(req.file.buffer);
    const token = registerValidation({
      type: 'OFFER',
      hash,
      data: result.data,
      userId: req.user.id
    });
    res.json({
      valid: result.valid,
      summary: result.summary,
      errors: result.errors,
      token,
      preview: result.data.slice(0, 10)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const offerImportConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded for confirmation.' });
    const hash = computeFileHash(req.file.buffer);
    const verifiedData = getAndVerifyValidation(token, {
      userId: req.user.id,
      type: 'OFFER',
      hash
    });
    const summary = await importOffersConfirmed(verifiedData, req.user, req);
    res.json({ message: `${summary.createdCount} offers imported.`, summary });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const exportPlacementApplicationsHandler = async (req, res) => {
  try {
    const { departmentId, batchYear, stage, format } = req.query;
    const result = await exportPlacementApplications(
      { departmentId, batchYear, stage, format: format === 'csv' ? 'csv' : 'xlsx' },
      req.user,
      req
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error exporting applications.' });
  }
};

export const exportPlacementOffersHandler = async (req, res) => {
  try {
    const { departmentId, batchYear, status, format } = req.query;
    const result = await exportPlacementOffers(
      { departmentId, batchYear, status, format: format === 'csv' ? 'csv' : 'xlsx' },
      req.user,
      req
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error exporting offers.' });
  }
};

export const exportPlacementRosterHandler = async (req, res) => {
  try {
    const { departmentId, batchYear, format } = req.query;
    const result = await exportPlacementRoster(
      { departmentId, batchYear, format: format === 'csv' ? 'csv' : 'xlsx' },
      req.user,
      req
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error exporting roster.' });
  }
};
