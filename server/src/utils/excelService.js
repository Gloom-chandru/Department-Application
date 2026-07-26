import ExcelJS from 'exceljs';
import { Readable } from 'stream';

const MAX_WORKSHEETS = 10;
const MAX_ROWS = 5000;
const MAX_CELL_LENGTH = 1000;

/**
 * Escapes formula characters to prevent formula injection in spreadsheet exports.
 * If value starts with =, +, -, or @, prepend a single quote '.
 */
export function escapeFormula(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitizes cell input, checking for formula objects and length limits.
 */
export function sanitizeCellInput(value) {
  if (value === null || value === undefined) return null;

  // If it's a formula object, reject or extract result
  if (value && typeof value === 'object') {
    if ('formula' in value) {
      throw new Error('Spreadsheet formulas are not allowed in imports.');
    }
    if ('result' in value) {
      value = value.result;
    } else if ('text' in value) {
      value = value.text;
    } else {
      value = JSON.stringify(value);
    }
  }

  const str = String(value).trim();
  if (str.length > MAX_CELL_LENGTH) {
    throw new Error(`Cell value exceeds maximum allowed length of ${MAX_CELL_LENGTH} characters.`);
  }

  return str;
}

/**
 * Parses an XLSX buffer into an array of row objects for the first sheet.
 */
export async function parseXlsx(buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    if (workbook.worksheets.length > MAX_WORKSHEETS) {
      throw new Error(`Workbook contains too many worksheets (${workbook.worksheets.length}). Max allowed is ${MAX_WORKSHEETS}.`);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Workbook contains no worksheets.');
    }

    return parseWorksheet(worksheet);
  } catch (err) {
    if (err.message.includes('formulas') || err.message.includes('length')) {
      throw err;
    }
    throw new Error(`Malformed or corrupted Excel file: ${err.message}`);
  }
}

/**
 * Parses a CSV buffer into an array of row objects.
 */
export async function parseCsv(buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    await workbook.csv.read(stream);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('CSV has no worksheets.');
    }

    return parseWorksheet(worksheet);
  } catch (err) {
    if (err.message.includes('formulas') || err.message.includes('length')) {
      throw err;
    }
    throw new Error(`Malformed or corrupted CSV file: ${err.message}`);
  }
}

/**
 * Helper to extract data rows from an ExcelJS worksheet.
 */
function parseWorksheet(worksheet) {
  const rows = [];
  const headerRow = worksheet.getRow(1);
  const headers = [];

  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    headers.push(cell.value ? String(cell.value).trim() : '');
  });

  // Verify we have headers
  const nonAmbigHeaders = headers.filter(h => h !== '');
  if (nonAmbigHeaders.length === 0) {
    throw new Error('Spreadsheet has no headers or is empty.');
  }

  // Check for duplicate headers
  const uniqueHeaders = new Set();
  for (const h of nonAmbigHeaders) {
    const norm = normalizeHeader(h);
    if (uniqueHeaders.has(norm)) {
      throw new Error(`Duplicate header detected: "${h}".`);
    }
    uniqueHeaders.add(norm);
  }

  let rowCount = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    rowCount++;
    if (rowCount > MAX_ROWS) {
      throw new Error(`File exceeds maximum row limit of ${MAX_ROWS} rows.`);
    }

    const rowData = {};
    let hasValue = false;

    // Use headers array to map values
    for (let colIndex = 1; colIndex <= headers.length; colIndex++) {
      const header = headers[colIndex - 1];
      if (!header) continue;

      const cell = row.getCell(colIndex);
      const val = cell.value;

      try {
        const sanitizedVal = sanitizeCellInput(val);
        if (sanitizedVal !== null && sanitizedVal !== '') {
          hasValue = true;
          rowData[normalizeHeader(header)] = sanitizedVal;
        } else {
          rowData[normalizeHeader(header)] = null;
        }
      } catch (err) {
        // Add row context to formula errors
        throw new Error(`Row ${rowNumber}, Column "${header}": ${err.message}`);
      }
    }

    // Ignore completely empty rows
    if (hasValue) {
      // Store 1-based row number for user error reporting
      rowData._rowNumber = rowNumber;
      rows.push(rowData);
    }
  });

  return { headers, rows };
}

/**
 * Header normalizer (removes spaces, symbols, cases).
 * Maps e.g. "Roll No", "roll no", "ROLL_NO", "rollNo" to "rollNo".
 */
export function normalizeHeader(header) {
  if (!header) return '';
  const clean = header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const mappings = {
    rollno: 'rollNo',
    rollnumber: 'rollNo',
    name: 'name',
    studentname: 'name',
    facultyname: 'name',
    email: 'email',
    emailaddress: 'email',
    department: 'departmentCode',
    dept: 'departmentCode',
    departmentcode: 'departmentCode',
    batch: 'batchYear',
    batchyear: 'batchYear',
    section: 'section',
    phone: 'phone',
    mobile: 'phone',
    mobileno: 'phone',
    phonenumber: 'phone',
    designation: 'designation',
    subject: 'subjectCode',
    subjectcode: 'subjectCode',
    exam: 'examType',
    examtype: 'examType',
    marks: 'marksObtained',
    marksobtained: 'marksObtained',
    maxmarks: 'maxMarks',
    maxmark: 'maxMarks',
    dayofweek: 'dayOfWeek',
    day: 'dayOfWeek',
    startperiod: 'startPeriod',
    startperiodnumber: 'startPeriod',
    endperiod: 'endPeriod',
    endperiodnumber: 'endPeriod',
    room: 'roomNo',
    roomno: 'roomNo',
    cgpa: 'cgpa',
    gpa: 'cgpa',
    currentbacklogs: 'currentBacklogs',
    backlogs: 'currentBacklogs',
    backlog: 'currentBacklogs',
    companycode: 'companyCode',
    drivetitle: 'driveTitle',
    ctc: 'ctc',
    package: 'ctc',
    status: 'status',
    industry: 'industry',
    website: 'website',
    hrcontactemail: 'hrContactEmail',
    hremail: 'hrContactEmail',
    code: 'code'
  };

  return mappings[clean] || clean;
}

/**
 * Professional XLSX workbook generation with styles.
 */
export async function generateWorkbook({ title, subtitle, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title || 'Report');

  // Set grid lines visible
  worksheet.views = [{ showGridLines: true }];

  let currentLine = 1;

  // Add optional titles
  if (title) {
    const titleRow = worksheet.addRow([title]);
    worksheet.mergeCells(`A${currentLine}:${String.fromCharCode(65 + columns.length - 1)}${currentLine}`);
    titleRow.getCell(1).font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.getRow(currentLine).height = 35;
    currentLine++;
  }

  if (subtitle) {
    const subtitleRow = worksheet.addRow([subtitle]);
    worksheet.mergeCells(`A${currentLine}:${String.fromCharCode(65 + columns.length - 1)}${currentLine}`);
    subtitleRow.getCell(1).font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF94A3B8' } };
    subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    subtitleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.getRow(currentLine).height = 20;
    currentLine++;
  }

  // Header Row
  const headerRowValues = columns.map(col => col.header);
  const headerRow = worksheet.addRow(headerRowValues);
  worksheet.getRow(currentLine).height = 26;

  // Freeze rows above data
  worksheet.properties.mostRecentSheetView = {
    state: 'frozen',
    ySplit: currentLine,
    activeCell: `A${currentLine + 1}`
  };

  headerRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Royal Blue
    cell.alignment = { vertical: 'middle', horizontal: columns[colIndex - 1].align || 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF3B82F6' } },
      left: { style: 'thin', color: { argb: 'FF3B82F6' } },
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      right: { style: 'thin', color: { argb: 'FF3B82F6' } }
    };
  });

  currentLine++;

  // Data Rows
  rows.forEach(row => {
    const rowValues = columns.map(col => {
      const rawVal = row[col.key];
      // Escape for formula safety
      return col.escape !== false ? escapeFormula(rawVal) : rawVal;
    });

    const dataRow = worksheet.addRow(rowValues);
    worksheet.getRow(currentLine).height = 20;

    dataRow.eachCell((cell, colIndex) => {
      const colDef = columns[colIndex - 1];
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: colDef.align || 'left' };
      
      // Formatting
      if (colDef.numFormat) {
        cell.numFormat = colDef.numFormat;
      }

      // Thin borders around all cells
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Zebra striping
      if (currentLine % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });

    currentLine++;
  });

  // Calculate & Set Column Widths
  columns.forEach((col, colIndex) => {
    let maxLength = col.header.length + 4;
    rows.forEach(row => {
      const val = row[col.key];
      if (val !== null && val !== undefined) {
        const len = String(val).length;
        if (len > maxLength) maxLength = len;
      }
    });
    // Set max width bounds
    worksheet.getColumn(colIndex + 1).width = Math.min(Math.max(maxLength, col.width || 12), 40);
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * CSV writer mapping.
 */
export async function generateCsv({ columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Add header values
  worksheet.addRow(columns.map(col => col.header));

  // Add rows with escaped formulas
  rows.forEach(row => {
    worksheet.addRow(columns.map(col => {
      const rawVal = row[col.key];
      return col.escape !== false ? escapeFormula(rawVal) : (rawVal === null || rawVal === undefined ? '' : String(rawVal));
    }));
  });

  return await workbook.csv.writeBuffer();
}

/**
 * Builds validation error workbook.
 */
export async function generateErrorWorkbook(errors) {
  return await generateWorkbook({
    title: 'Import Validation Errors',
    subtitle: 'Please correct these errors and re-upload the file.',
    columns: [
      { header: 'Row Number', key: 'row', width: 12, align: 'center' },
      { header: 'Column / Field', key: 'column', width: 18 },
      { header: 'Error Code', key: 'code', width: 22 },
      { header: 'Error Message', key: 'message', width: 45 }
    ],
    rows: errors.map(e => ({
      row: e.row,
      column: e.column || 'All',
      code: e.code,
      message: e.message
    }))
  });
}
