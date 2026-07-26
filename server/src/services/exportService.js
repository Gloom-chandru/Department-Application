import prisma from '../utils/db.js';
import {
  calculateAttendancePercentage,
  calculateClassesNeededForTarget,
  calculateClassesCanMiss,
  normalizeMarkPercentage
} from '../utils/analyticsMath.js';
import { generateWorkbook, generateCsv } from '../utils/excelService.js';

/**
 * Returns low attendance threshold from Settings.
 */
async function getAttendanceThreshold() {
  const setting = await prisma.setting.findUnique({ where: { key: 'low_attendance_threshold' } });
  return setting ? parseFloat(setting.value) : 75.0;
}

/**
 * Generates Attendance Ledger export (XLSX or CSV).
 */
export async function exportAttendanceData({ departmentId, batchYear, section, subjectId, format = 'xlsx' }) {
  const threshold = await getAttendanceThreshold();

  const where = {};
  if (departmentId) where.student = { departmentId };
  if (batchYear) where.student = { ...where.student, batchYear };
  if (section) where.student = { ...where.student, section: section.toUpperCase() };
  if (subjectId) where.subjectId = subjectId;

  // Fetch student-wise attendance grouped by subject
  const attendanceRecords = await prisma.attendance.findMany({
    where,
    include: {
      student: { include: { user: { select: { name: true } } } },
      subject: true
    }
  });

  // Aggregate data in memory to avoid N+1
  const map = new Map(); // key: studentId-subjectId
  for (const rec of attendanceRecords) {
    const key = `${rec.studentId}-${rec.subjectId}`;
    if (!map.has(key)) {
      map.set(key, {
        rollNo: rec.student.rollNo,
        studentName: rec.student.user.name,
        subjectCode: rec.subject.code,
        subjectName: rec.subject.name,
        present: 0,
        total: 0
      });
    }
    const group = map.get(key);
    group.total++;
    if (rec.status === 'PRESENT') {
      group.present++;
    }
  }

  const rows = [];
  for (const group of map.values()) {
    const pct = calculateAttendancePercentage(group.present, group.total);
    const pctDisplay = pct !== null ? `${pct}%` : 'No classes recorded';
    
    let status = 'Good';
    let needed = 0;
    let missable = 0;

    if (group.total > 0 && pct !== null) {
      status = pct >= threshold ? 'Good' : 'Low';
      needed = calculateClassesNeededForTarget(group.present, group.total, threshold);
      missable = calculateClassesCanMiss(group.present, group.total, threshold);
    }

    rows.push({
      rollNo: group.rollNo,
      studentName: group.studentName,
      subjectCode: group.subjectCode,
      subjectName: group.subjectName,
      present: group.present,
      total: group.total,
      percentage: pctDisplay,
      threshold: `${threshold}%`,
      status,
      needed: needed === Infinity ? 'N/A' : needed,
      missable: missable === Infinity ? 'N/A' : missable
    });
  }

  const columns = [
    { header: 'Roll No', key: 'rollNo', width: 14 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Subject Code', key: 'subjectCode', width: 14, align: 'center' },
    { header: 'Subject Name', key: 'subjectName', width: 22 },
    { header: 'Present Classes', key: 'present', width: 15, align: 'center' },
    { header: 'Total Classes', key: 'total', width: 14, align: 'center' },
    { header: 'Attendance %', key: 'percentage', width: 18, align: 'right' },
    { header: 'Threshold', key: 'threshold', width: 12, align: 'right' },
    { header: 'Status', key: 'status', width: 12, align: 'center' },
    { header: 'Classes Needed', key: 'needed', width: 15, align: 'center' },
    { header: 'Classes Can Miss', key: 'missable', width: 16, align: 'center' }
  ];

  if (format === 'csv') {
    return await generateCsv({ columns, rows });
  }

  return await generateWorkbook({
    title: 'Attendance Ledger Report',
    subtitle: `Generated on ${new Date().toLocaleDateString()} | low attendance threshold: ${threshold}%`,
    columns,
    rows
  });
}

/**
 * Generates Marks Ledger export (XLSX or CSV).
 */
export async function exportMarksData({ departmentId, batchYear, section, subjectId, format = 'xlsx' }) {
  const whereStudent = {};
  if (departmentId) whereStudent.departmentId = departmentId;
  if (batchYear) whereStudent.batchYear = batchYear;
  if (section) whereStudent.section = section.toUpperCase();

  const students = await prisma.student.findMany({
    where: whereStudent,
    include: { user: { select: { name: true } } }
  });

  const whereMarks = {};
  if (subjectId) whereMarks.subjectId = subjectId;
  if (departmentId) whereMarks.student = { departmentId };

  const marksList = await prisma.mark.findMany({
    where: whereMarks,
    include: { subject: true }
  });

  // Group marks by studentId and subjectId
  // key: studentId-subjectId -> { INTERNAL1, INTERNAL2, SEMESTER }
  const marksMap = new Map();
  for (const m of marksList) {
    const key = `${m.studentId}-${m.subjectId}`;
    if (!marksMap.has(key)) {
      marksMap.set(key, {
        subjectCode: m.subject.code,
        subjectName: m.subject.name,
        INTERNAL1: null,
        INTERNAL2: null,
        SEMESTER: null
      });
    }
    const studentSubjectMark = marksMap.get(key);
    try {
      studentSubjectMark[m.examType] = normalizeMarkPercentage(m.marksObtained, m.maxMarks);
    } catch (err) {
      studentSubjectMark[m.examType] = 0;
    }
  }

  const rows = [];
  for (const student of students) {
    const studentSubjects = [...marksMap.entries()].filter(([key]) => key.startsWith(`${student.id}-`));

    if (studentSubjects.length === 0) {
      // If student has no marks registered
      rows.push({
        rollNo: student.rollNo,
        studentName: student.user.name,
        subjectCode: '-',
        subjectName: 'No marks entered',
        internal1: 'N/A',
        internal2: 'N/A',
        semester: 'N/A',
        average: 'N/A'
      });
      continue;
    }

    for (const [key, markRecord] of studentSubjects) {
      const percentages = [];
      if (markRecord.INTERNAL1 !== null) percentages.push(markRecord.INTERNAL1);
      if (markRecord.INTERNAL2 !== null) percentages.push(markRecord.INTERNAL2);
      if (markRecord.SEMESTER !== null) percentages.push(markRecord.SEMESTER);

      const avg = percentages.length > 0
        ? parseFloat((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2))
        : null;

      rows.push({
        rollNo: student.rollNo,
        studentName: student.user.name,
        subjectCode: markRecord.subjectCode,
        subjectName: markRecord.subjectName,
        internal1: markRecord.INTERNAL1 !== null ? `${markRecord.INTERNAL1}%` : 'N/A',
        internal2: markRecord.INTERNAL2 !== null ? `${markRecord.INTERNAL2}%` : 'N/A',
        semester: markRecord.SEMESTER !== null ? `${markRecord.SEMESTER}%` : 'N/A',
        average: avg !== null ? `${avg}%` : 'N/A'
      });
    }
  }

  const columns = [
    { header: 'Roll No', key: 'rollNo', width: 14 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Subject Code', key: 'subjectCode', width: 14, align: 'center' },
    { header: 'Subject Name', key: 'subjectName', width: 22 },
    { header: 'Internal 1', key: 'internal1', width: 14, align: 'right' },
    { header: 'Internal 2', key: 'internal2', width: 14, align: 'right' },
    { header: 'Semester', key: 'semester', width: 14, align: 'right' },
    { header: 'Average %', key: 'average', width: 14, align: 'right' }
  ];

  if (format === 'csv') {
    return await generateCsv({ columns, rows });
  }

  return await generateWorkbook({
    title: 'Academic Marks Ledger',
    subtitle: `Generated on ${new Date().toLocaleDateString()}`,
    columns,
    rows
  });
}

/**
 * Generates formatted Timetable Schedule export.
 * Renders weekly timetable as a grid.
 */
export async function exportTimetableGrid(scheduleId, format = 'xlsx') {
  const schedule = await prisma.timetableSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      department: true,
      slots: {
        include: {
          subject: { include: { faculty: { include: { user: true } } } },
          startPeriod: true,
          endPeriod: true,
          room: true
        }
      }
    }
  });

  if (!schedule) {
    throw new Error('Schedule not found.');
  }

  const periods = await prisma.periodTemplate.findMany({ orderBy: { periodNumber: 'asc' } });
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // For CSV, write row-by-row simple data
  if (format === 'csv') {
    const csvColumns = [
      { header: 'Period', key: 'periodName' },
      { header: 'Time', key: 'timeRange' },
      { header: 'Monday', key: 'Mon' },
      { header: 'Tuesday', key: 'Tue' },
      { header: 'Wednesday', key: 'Wed' },
      { header: 'Thursday', key: 'Thu' },
      { header: 'Friday', key: 'Fri' },
      { header: 'Saturday', key: 'Sat' }
    ];

    const csvRows = periods.map(p => {
      const rowObj = {
        periodName: p.name,
        timeRange: `${p.startTime}-${p.endTime}`
      };

      DAYS_OF_WEEK.forEach((day, index) => {
        const dayNum = index + 1;
        if (p.isBreak) {
          rowObj[day.slice(0, 3)] = 'BREAK';
          return;
        }

        const slot = schedule.slots.find(s => {
          return s.dayOfWeek === dayNum && p.periodNumber >= s.startPeriod.periodNumber && p.periodNumber <= s.endPeriod.periodNumber;
        });

        rowObj[day.slice(0, 3)] = slot
          ? `${slot.subject.code} (${slot.room?.roomNo || 'No Room'})`
          : 'Free';
      });

      return rowObj;
    });

    return await generateCsv({ columns: csvColumns, rows: csvRows });
  }

  // Rich formatted XLSX workbook using ExcelJS direct manipulations
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  const worksheet = workbook.addWorksheet('Timetable Grid');
  worksheet.views = [{ showGridLines: true }];

  // Titles
  worksheet.addRow([`Weekly Class Timetable - ${schedule.name}`]);
  worksheet.mergeCells('A1:H1');
  const tCell = worksheet.getCell('A1');
  tCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 40;

  worksheet.addRow([
    `Department: ${schedule.department.name} | Batch: ${schedule.batchYear} | Section: ${schedule.section} | Semester: ${schedule.semester}`
  ]);
  worksheet.mergeCells('A2:H2');
  const subCell = worksheet.getCell('A2');
  subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 24;

  // Header Row
  const headerRow = worksheet.addRow(['Period', 'Time Range', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  worksheet.getRow(3).height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF3B82F6' } },
      left: { style: 'thin', color: { argb: 'FF3B82F6' } },
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      right: { style: 'thin', color: { argb: 'FF3B82F6' } }
    };
  });

  // Track merged cells to avoid overwriting them
  const mergedMap = new Set();

  // Populate grid row by row (starting at Row 4 in sheet)
  periods.forEach((p, pIndex) => {
    const sheetRowNumber = 4 + pIndex;
    const rowValues = [p.name, `${p.startTime} - ${p.endTime}`, '', '', '', '', '', ''];
    const newRow = worksheet.addRow(rowValues);
    worksheet.getRow(sheetRowNumber).height = 45;

    // Style period column
    const pCell = newRow.getCell(1);
    pCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F2937' } };
    pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    pCell.alignment = { horizontal: 'center', vertical: 'middle' };
    pCell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Style time range column
    const tRangeCell = newRow.getCell(2);
    tRangeCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF4B5563' } };
    tRangeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    tRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    tRangeCell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    DAYS_OF_WEEK.forEach((dayName, dayIndex) => {
      const colNum = 3 + dayIndex; // Monday = Col 3
      const dayNum = dayIndex + 1;

      // Skip if this cell is already part of a vertical merge
      if (mergedMap.has(`${sheetRowNumber}-${colNum}`)) {
        return;
      }

      const cell = newRow.getCell(colNum);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (p.isBreak) {
        cell.value = p.name;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }; // Soft amber
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        return;
      }

      const slot = schedule.slots.find(s => {
        return s.dayOfWeek === dayNum && p.periodNumber >= s.startPeriod.periodNumber && p.periodNumber <= s.endPeriod.periodNumber;
      });

      if (!slot) {
        cell.value = 'Free';
        cell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        return;
      }

      // If it's a multi-period slot, perform vertical cell merging in column
      const span = slot.endPeriod.periodNumber - slot.startPeriod.periodNumber + 1;
      const startRowInSheet = 4 + periods.findIndex(per => per.id === slot.startPeriodId);

      if (span > 1 && sheetRowNumber === startRowInSheet) {
        const endRowInSheet = startRowInSheet + span - 1;
        worksheet.mergeCells(startRowInSheet, colNum, endRowInSheet, colNum);

        // Mark merged cells so we skip them when drawing the next rows
        for (let r = startRowInSheet + 1; r <= endRowInSheet; r++) {
          mergedMap.add(`${r}-${colNum}`);
        }
      }

      // Set cell values & styled layout (always draw values/styles at the merged origin cell)
      cell.value = `${slot.subject.code}\n${slot.subject.name}\n${slot.subject.faculty.user.name}\nRoom: ${slot.room?.roomNo || 'N/A'}`;
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Soft Sky Blue
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
  });

  // Adjust column widths
  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 16;
  for (let c = 3; c <= 8; c++) {
    worksheet.getColumn(c).width = 24;
  }

  return await workbook.xlsx.writeBuffer();
}
