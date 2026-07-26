import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

// Mock api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  }
}));

// Mock downloadHelper
vi.mock('../utils/downloadHelper', () => ({
  downloadBlob: vi.fn(),
  downloadCredentialsCsv: vi.fn(),
}));

import api from '../utils/api';
import { downloadBlob, downloadCredentialsCsv } from '../utils/downloadHelper';
import BulkUploadDropzone from '../components/BulkUploadDropzone';
import DryRunSummary from '../components/DryRunSummary';
import ValidationErrorTable from '../components/ValidationErrorTable';
import ImportPreviewTable from '../components/ImportPreviewTable';
import CredentialSummaryModal from '../components/CredentialSummaryModal';
import ExportDataModal from '../components/ExportDataModal';
import AdminBulkImportManager from '../pages/AdminBulkImportManager';
import FacultyBulkMarksModal from '../components/FacultyBulkMarksModal';

const renderWithAuth = (component, userOverride = {}) => {
  const user = {
    id: 'admin-1',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'ADMIN',
    ...userOverride
  };

  return render(
    <AuthContext.Provider value={{ user, loading: false, login: vi.fn(), logout: vi.fn() }}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('Phase 8B: Bulk Import/Export Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for schedule loading
    api.get.mockImplementation((url) => {
      if (url === '/timetable/schedules') return Promise.resolve({ data: [] });
      if (url === '/faculty/subjects') return Promise.resolve({ data: [] });
      if (url === '/admin/departments') return Promise.resolve({ data: [] });
      if (url === '/admin/subjects') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    api.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
  });

  // =====================================================
  // 1. ROUTE ACCESS CONTROL
  // =====================================================
  describe('1. Route Access Control', () => {
    test('Admin can access the Bulk Operations portal', async () => {
      renderWithAuth(<AdminBulkImportManager />);
      expect(screen.getByText('Bulk Operations & Data Management Portal')).toBeInTheDocument();
    });

    test('All four import tabs render', async () => {
      renderWithAuth(<AdminBulkImportManager />);
      expect(screen.getByText('Students Registration')).toBeInTheDocument();
      expect(screen.getByText('Faculty Onboarding')).toBeInTheDocument();
      expect(screen.getByText('Academic Marks')).toBeInTheDocument();
      expect(screen.getByText('Timetable Scheduling')).toBeInTheDocument();
    });

    test('Tabs switch correctly', async () => {
      renderWithAuth(<AdminBulkImportManager />);
      
      // Click Faculty tab
      fireEvent.click(screen.getByText('Faculty Onboarding'));
      expect(screen.getByText(/Download FACULTY Template/i)).toBeInTheDocument();

      // Click Marks tab
      fireEvent.click(screen.getByText('Academic Marks'));
      expect(screen.getByText(/Download MARKS Template/i)).toBeInTheDocument();
    });
  });

  // =====================================================
  // 2. BULK UPLOAD DROPZONE
  // =====================================================
  describe('2. BulkUploadDropzone', () => {
    test('Renders dropzone with instructions', () => {
      const onSelect = vi.fn();
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={null} onFileSelect={onSelect} onFileClear={onClear} />);
      
      expect(screen.getByText(/Drag and drop your spreadsheet here/i)).toBeInTheDocument();
      expect(screen.getByText(/Supports Excel/i)).toBeInTheDocument();
    });

    test('Accepts .xlsx files', () => {
      const onSelect = vi.fn();
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={null} onFileSelect={onSelect} onFileClear={onClear} />);
      
      const input = document.getElementById('bulk-file-input');
      const file = new File(['content'], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      
      fireEvent.change(input, { target: { files: [file] } });
      expect(onSelect).toHaveBeenCalledWith(file);
    });

    test('Accepts .csv files', () => {
      const onSelect = vi.fn();
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={null} onFileSelect={onSelect} onFileClear={onClear} />);
      
      const input = document.getElementById('bulk-file-input');
      const file = new File(['a,b,c'], 'data.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 256 });
      
      fireEvent.change(input, { target: { files: [file] } });
      expect(onSelect).toHaveBeenCalledWith(file);
    });

    test('Rejects .xls legacy files', () => {
      const onSelect = vi.fn();
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={null} onFileSelect={onSelect} onFileClear={onClear} />);
      
      const input = document.getElementById('bulk-file-input');
      const file = new File(['content'], 'data.xls', { type: 'application/vnd.ms-excel' });
      Object.defineProperty(file, 'size', { value: 1024 });
      
      fireEvent.change(input, { target: { files: [file] } });
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.getByText(/Legacy binary Excel files/i)).toBeInTheDocument();
    });

    test('Rejects oversized files (> 5 MB)', () => {
      const onSelect = vi.fn();
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={null} onFileSelect={onSelect} onFileClear={onClear} />);
      
      const input = document.getElementById('bulk-file-input');
      const file = new File(['content'], 'big.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });
      
      fireEvent.change(input, { target: { files: [file] } });
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.getByText(/File size exceeds/i)).toBeInTheDocument();
    });

    test('Shows file details and Remove button when file is selected', () => {
      const file = new File(['content'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 2048 });
      
      const onSelect = vi.fn();
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={file} onFileSelect={onSelect} onFileClear={onClear} />);
      
      expect(screen.getByText('students.xlsx')).toBeInTheDocument();
      expect(screen.getAllByText(/XLSX/i).length).toBeGreaterThan(0);
    });

    test('Remove button calls onFileClear (invalidates dry-run state)', () => {
      const file = new File(['content'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 2048 });
      
      const onClear = vi.fn();
      render(<BulkUploadDropzone selectedFile={file} onFileSelect={vi.fn()} onFileClear={onClear} />);
      
      fireEvent.click(screen.getByTitle('Remove file'));
      expect(onClear).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 3. DRY-RUN SUMMARY
  // =====================================================
  describe('3. DryRunSummary', () => {
    test('Shows validation passed status when valid', () => {
      render(
        <DryRunSummary
          summary={{ totalRows: 5, validRows: 5, invalidRows: 0 }}
          valid={true}
          expiresAt={Date.now() + 15 * 60 * 1000}
          onTokenExpire={vi.fn()}
          importType="STUDENT"
        />
      );
      expect(screen.getByText(/Validation Passed/i)).toBeInTheDocument();
    });

    test('Shows validation failed status when invalid', () => {
      render(
        <DryRunSummary
          summary={{ totalRows: 5, validRows: 3, invalidRows: 2 }}
          valid={false}
          expiresAt={Date.now() + 15 * 60 * 1000}
          onTokenExpire={vi.fn()}
          importType="STUDENT"
        />
      );
      expect(screen.getByText(/Validation Failed/i)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Invalid rows count
    });

    test('Shows token countdown timer', () => {
      render(
        <DryRunSummary
          summary={{ totalRows: 5, validRows: 5, invalidRows: 0 }}
          valid={true}
          expiresAt={Date.now() + 10 * 60 * 1000}
          onTokenExpire={vi.fn()}
          importType="STUDENT"
        />
      );
      expect(screen.getByText(/Validation token expires in/i)).toBeInTheDocument();
    });

    test('Shows expired warning when timer reaches zero', () => {
      render(
        <DryRunSummary
          summary={{ totalRows: 5, validRows: 5, invalidRows: 0 }}
          valid={true}
          expiresAt={Date.now() - 1000}
          onTokenExpire={vi.fn()}
          importType="STUDENT"
        />
      );
      expect(screen.getByText(/Validation token has expired/i)).toBeInTheDocument();
    });
  });

  // =====================================================
  // 4. VALIDATION ERROR TABLE
  // =====================================================
  describe('4. ValidationErrorTable', () => {
    const sampleErrors = [
      { row: 2, column: 'email', code: 'DUPLICATE_IN_FILE', message: 'Duplicate email in file' },
      { row: 3, column: 'rollNo', code: 'VALIDATION_FAILED', message: 'Roll number is required' },
      { row: 5, column: 'departmentCode', code: 'UNKNOWN_DEPARTMENT', message: 'Department "XYZ" not found' },
    ];

    test('Renders error count and table', () => {
      render(<ValidationErrorTable errors={sampleErrors} onToast={vi.fn()} />);
      expect(screen.getByText('Validation Errors (3)')).toBeInTheDocument();
    });

    test('Renders all error rows', () => {
      render(<ValidationErrorTable errors={sampleErrors} onToast={vi.fn()} />);
      expect(screen.getByText('Duplicate email in file')).toBeInTheDocument();
      expect(screen.getByText('Roll number is required')).toBeInTheDocument();
      expect(screen.getByText('Department "XYZ" not found')).toBeInTheDocument();
    });

    test('Search input filters errors', async () => {
      render(<ValidationErrorTable errors={sampleErrors} onToast={vi.fn()} />);
      const searchInput = screen.getByPlaceholderText(/Search error messages/i);
      
      fireEvent.change(searchInput, { target: { value: 'Duplicate' } });
      
      expect(screen.getByText('Duplicate email in file')).toBeInTheDocument();
      expect(screen.queryByText('Roll number is required')).not.toBeInTheDocument();
    });

    test('Error code dropdown filter works', () => {
      render(<ValidationErrorTable errors={sampleErrors} onToast={vi.fn()} />);
      const select = screen.getByDisplayValue(/All Error Types/i);
      
      fireEvent.change(select, { target: { value: 'DUPLICATE_IN_FILE' } });
      
      expect(screen.getByText('Duplicate email in file')).toBeInTheDocument();
      expect(screen.queryByText('Roll number is required')).not.toBeInTheDocument();
    });

    test('Download Error Workbook button calls API', async () => {
      api.post.mockResolvedValue({ data: new Blob(['xlsx']), headers: {} });
      render(<ValidationErrorTable errors={sampleErrors} onToast={vi.fn()} />);
      
      fireEvent.click(screen.getByText(/Download Error Workbook/i));
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/bulk/errors/download',
          { errors: sampleErrors },
          { responseType: 'blob' }
        );
      });
    });

    test('Returns null when no errors', () => {
      const { container } = render(<ValidationErrorTable errors={[]} onToast={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // =====================================================
  // 5. IMPORT PREVIEW TABLE
  // =====================================================
  describe('5. ImportPreviewTable', () => {
    test('Renders student preview rows', () => {
      const data = [
        { rollNo: 'STU001', name: 'Alice', email: 'alice@test.com', batchYear: '2024-28', section: 'A' }
      ];
      render(<ImportPreviewTable previewData={data} importType="STUDENT" />);
      expect(screen.getByText('STU001')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    test('Marks preview distinguishes CREATE action', () => {
      const data = [
        { rollNo: 'STU001', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 40, maxMarks: 50, action: 'CREATE' }
      ];
      render(<ImportPreviewTable previewData={data} importType="MARKS" />);
      expect(screen.getByText('CREATE')).toBeInTheDocument();
    });

    test('Marks preview distinguishes UPDATE action', () => {
      const data = [
        { rollNo: 'STU001', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 45, maxMarks: 50, action: 'UPDATE' }
      ];
      render(<ImportPreviewTable previewData={data} importType="MARKS" />);
      expect(screen.getByText('UPDATE')).toBeInTheDocument();
    });

    test('Marks preview distinguishes NO-OP action', () => {
      const data = [
        { rollNo: 'STU001', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 40, maxMarks: 50, action: 'NO-OP' }
      ];
      render(<ImportPreviewTable previewData={data} importType="MARKS" />);
      expect(screen.getByText('NO-OP')).toBeInTheDocument();
    });

    test('Returns null when no data', () => {
      const { container } = render(<ImportPreviewTable previewData={[]} importType="STUDENT" />);
      expect(container.firstChild).toBeNull();
    });
  });

  // =====================================================
  // 6. CREDENTIAL SUMMARY MODAL
  // =====================================================
  describe('6. CredentialSummaryModal', () => {
    const sampleCredentials = [
      { identifier: 'STU001', name: 'Alice', email: 'alice@test.com', temporaryPassword: 'Abc!1234xYzQ' },
      { identifier: 'STU002', name: 'Bob', email: 'bob@test.com', temporaryPassword: 'Def@5678pQrS' }
    ];

    test('Renders one-time warning banner', () => {
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={vi.fn()} onToast={vi.fn()} />);
      expect(screen.getByText(/One-Time Credential Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/only once/i)).toBeInTheDocument();
    });

    test('Renders all credential entries', () => {
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={vi.fn()} onToast={vi.fn()} />);
      expect(screen.getByText('STU001')).toBeInTheDocument();
      expect(screen.getByText('STU002')).toBeInTheDocument();
      expect(screen.getByText('Abc!1234xYzQ')).toBeInTheDocument();
      expect(screen.getByText('Def@5678pQrS')).toBeInTheDocument();
    });

    test('Copy All button calls clipboard API', async () => {
      const writeText = vi.fn().mockResolvedValue();
      Object.assign(navigator, { clipboard: { writeText } });
      
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={vi.fn()} onToast={vi.fn()} />);
      fireEvent.click(screen.getByText('Copy All Credentials'));
      
      await waitFor(() => {
        expect(writeText).toHaveBeenCalled();
      });
    });

    test('Download CSV button calls downloadCredentialsCsv', () => {
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={vi.fn()} onToast={vi.fn()} />);
      fireEvent.click(screen.getByText('Download Credentials (.csv)'));
      expect(downloadCredentialsCsv).toHaveBeenCalledWith(sampleCredentials, 'imported_credentials.csv');
    });

    test('Close button triggers onClose (clears credential state)', () => {
      const onClose = vi.fn();
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={onClose} onToast={vi.fn()} />);
      fireEvent.click(screen.getByText('Done & Clear Memory'));
      expect(onClose).toHaveBeenCalled();
    });

    test('Credentials are NOT written to localStorage', () => {
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={vi.fn()} onToast={vi.fn()} />);
      expect(localStorage.getItem('credentials')).toBeNull();
      // Check no key contains password-like data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        expect(val).not.toContain('Abc!1234xYzQ');
        expect(val).not.toContain('Def@5678pQrS');
      }
    });

    test('Credentials are NOT written to sessionStorage', () => {
      render(<CredentialSummaryModal credentials={sampleCredentials} onClose={vi.fn()} onToast={vi.fn()} />);
      expect(sessionStorage.getItem('credentials')).toBeNull();
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const val = sessionStorage.getItem(key);
        expect(val).not.toContain('Abc!1234xYzQ');
        expect(val).not.toContain('Def@5678pQrS');
      }
    });

    test('Returns null when no credentials', () => {
      const { container } = render(<CredentialSummaryModal credentials={null} onClose={vi.fn()} onToast={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // =====================================================
  // 7. ADMIN BULK IMPORT MANAGER WORKFLOW
  // =====================================================
  describe('7. Admin Bulk Import Manager Workflow', () => {
    test('Template download button triggers API call', async () => {
      api.get.mockImplementation((url, opts) => {
        if (url === '/bulk/templates/students' && opts?.responseType === 'blob') {
          return Promise.resolve({ data: new Blob(['template']), headers: {} });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithAuth(<AdminBulkImportManager />);
      
      fireEvent.click(screen.getByText(/Download STUDENTS Template/i));

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/bulk/templates/students', { responseType: 'blob' });
      });
    });

    test('Confirm button is NOT visible before dry-run', () => {
      renderWithAuth(<AdminBulkImportManager />);
      expect(screen.queryByText(/Confirm & Commit Import/i)).not.toBeInTheDocument();
    });

    test('Dry-run button appears after file selection', async () => {
      renderWithAuth(<AdminBulkImportManager />);
      
      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(screen.getByText(/Run Dry-Run Validation/i)).toBeInTheDocument();
    });

    test('Dry-run calls correct student endpoint', async () => {
      api.post.mockResolvedValue({
        data: { valid: true, summary: { totalRows: 1, validRows: 1, invalidRows: 0 }, token: 'test-token', errors: [], preview: [] }
      });

      renderWithAuth(<AdminBulkImportManager />);

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/bulk/import/students/dry-run',
          expect.any(FormData),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      });
    });

    test('Successful dry-run shows Confirm button', async () => {
      api.post.mockResolvedValue({
        data: { valid: true, summary: { totalRows: 1, validRows: 1, invalidRows: 0 }, token: 'tok-123', errors: [], preview: [] }
      });

      renderWithAuth(<AdminBulkImportManager />);

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm & Commit Import/i)).toBeInTheDocument();
      });
    });

    test('Invalid dry-run disables Confirm button', async () => {
      api.post.mockResolvedValue({
        data: { valid: false, summary: { totalRows: 1, validRows: 0, invalidRows: 1 }, token: 'tok-123', errors: [{ row: 2, column: 'email', code: 'INVALID', message: 'Bad email' }], preview: [] }
      });

      renderWithAuth(<AdminBulkImportManager />);

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        const confirmBtn = screen.getByText(/Confirm & Commit Import/i);
        expect(confirmBtn.closest('button')).toBeDisabled();
      });
    });

    test('Successful student confirmation opens credential modal', async () => {
      // First dry-run succeeds
      api.post
        .mockResolvedValueOnce({
          data: { valid: true, summary: { totalRows: 1, validRows: 1, invalidRows: 0 }, token: 'tok-abc', errors: [], preview: [] }
        })
        // Then confirmation succeeds with credentials
        .mockResolvedValueOnce({
          data: { message: '1 student imported', credentials: [{ identifier: 'STU001', name: 'Alice', email: 'alice@test.com', temporaryPassword: 'TmpPass123!' }] }
        });

      renderWithAuth(<AdminBulkImportManager />);

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm & Commit Import/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Confirm & Commit Import/i));

      await waitFor(() => {
        expect(screen.getByText(/One-Time Credential Notice/i)).toBeInTheDocument();
        expect(screen.getByText('TmpPass123!')).toBeInTheDocument();
      });
    });

    test('Marks import does NOT open credential modal', async () => {
      api.post
        .mockResolvedValueOnce({
          data: { valid: true, summary: { totalRows: 1, validRows: 1, invalidRows: 0 }, token: 'tok-marks', errors: [], preview: [{ rollNo: 'S1', subjectCode: 'X', examType: 'INTERNAL1', marksObtained: 40, maxMarks: 50, action: 'CREATE' }] }
        })
        .mockResolvedValueOnce({
          data: { message: 'Marks imported', summary: { createdCount: 1, updatedCount: 0, noopCount: 0 } }
        });

      renderWithAuth(<AdminBulkImportManager />);

      // Switch to Marks tab
      fireEvent.click(screen.getByText('Academic Marks'));

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'marks.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm & Commit Import/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Confirm & Commit Import/i));

      await waitFor(() => {
        // Should NOT have credential modal
        expect(screen.queryByText(/One-Time Credential Notice/i)).not.toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // 8. FILE REPLACEMENT INVALIDATION
  // =====================================================
  describe('8. File Replacement Invalidation', () => {
    test('Selecting a new file after dry-run invalidates confirmation state', async () => {
      api.post.mockResolvedValue({
        data: { valid: true, summary: { totalRows: 1, validRows: 1, invalidRows: 0 }, token: 'tok-valid', errors: [], preview: [] }
      });

      renderWithAuth(<AdminBulkImportManager />);

      // First file + dry-run
      const input = document.getElementById('bulk-file-input');
      const file1 = new File(['data1'], 'students1.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file1, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file1] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm & Commit Import/i)).toBeInTheDocument();
      });

      // Replace file -> should reset
      const file2 = new File(['data2'], 'students2.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file2, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file2] } });

      // Confirm should be gone, dry-run button should appear again
      expect(screen.queryByText(/Confirm & Commit Import/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Run Dry-Run Validation/i)).toBeInTheDocument();
    });
  });

  // =====================================================
  // 9. TIMETABLE DRAFT SCHEDULE FILTERING
  // =====================================================
  describe('9. Timetable Draft Schedule Filtering', () => {
    test('No draft schedule shows guidance message', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/timetable/schedules') return Promise.resolve({ data: [] });
        return Promise.resolve({ data: [] });
      });

      renderWithAuth(<AdminBulkImportManager />);
      fireEvent.click(screen.getByText('Timetable Scheduling'));

      await waitFor(() => {
        expect(screen.getByText(/No draft timetable schedule available/i)).toBeInTheDocument();
      });
    });

    test('Only DRAFT schedules are shown in dropdown', async () => {
      api.get.mockImplementation((url, opts) => {
        if (url === '/timetable/schedules') {
          expect(opts?.params?.status).toBe('DRAFT');
          return Promise.resolve({
            data: [
              { id: 's1', name: 'Draft Schedule 1', department: { code: 'CSE' }, batchYear: '2024-28', section: 'A', semester: 4, status: 'DRAFT' }
            ]
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithAuth(<AdminBulkImportManager />);
      fireEvent.click(screen.getByText('Timetable Scheduling'));

      await waitFor(() => {
        expect(screen.getByText(/Draft Schedule 1/i)).toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // 10. EXPORT DATA MODAL
  // =====================================================
  describe('10. ExportDataModal', () => {
    test('Renders report type and format selectors', () => {
      render(
        <BrowserRouter>
          <ExportDataModal isOpen={true} onClose={vi.fn()} userRole="ADMIN" onToast={vi.fn()} />
        </BrowserRouter>
      );
      expect(screen.getByText('Export Academic Data')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Academic Marks')).toBeInTheDocument();
      expect(screen.getByText('Timetable Grid')).toBeInTheDocument();
      expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
      expect(screen.getByText('CSV (.csv)')).toBeInTheDocument();
    });

    test('Export button triggers API call with correct params', async () => {
      api.get.mockImplementation((url, opts) => {
        if (opts?.responseType === 'blob') {
          return Promise.resolve({ data: new Blob(['data']), headers: {} });
        }
        return Promise.resolve({ data: [] });
      });

      const onClose = vi.fn();
      render(
        <BrowserRouter>
          <ExportDataModal isOpen={true} onClose={onClose} userRole="ADMIN" onToast={vi.fn()} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText('Download Export'));

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/bulk/export/attendance',
          expect.objectContaining({ params: expect.objectContaining({ format: 'xlsx' }), responseType: 'blob' })
        );
      });
    });

    test('Does not render when isOpen is false', () => {
      const { container } = render(
        <BrowserRouter>
          <ExportDataModal isOpen={false} onClose={vi.fn()} userRole="ADMIN" onToast={vi.fn()} />
        </BrowserRouter>
      );
      expect(container.firstChild).toBeNull();
    });
  });

  // =====================================================
  // 11. CREDENTIAL MEMORY CLEANUP
  // =====================================================
  describe('11. Credential Memory Cleanup', () => {
    test('Credential state is cleared after modal closes', async () => {
      const creds = [{ identifier: 'X1', name: 'Test', email: 't@t.com', temporaryPassword: 'SecretPwd!' }];
      
      const TestWrapper = () => {
        const [credentials, setCredentials] = React.useState(creds);
        const [isOpen, setIsOpen] = React.useState(true);
        
        const handleClose = () => {
          setCredentials(null);
          setIsOpen(false);
        };

        return (
          <div>
            {isOpen && credentials && (
              <CredentialSummaryModal credentials={credentials} onClose={handleClose} onToast={vi.fn()} />
            )}
            <div data-testid="cred-state">{credentials ? 'HAS_CREDS' : 'CLEARED'}</div>
          </div>
        );
      };

      render(<TestWrapper />);
      expect(screen.getByTestId('cred-state')).toHaveTextContent('HAS_CREDS');
      expect(screen.getByText('SecretPwd!')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByText('Done & Clear Memory'));

      // Credential state should be cleared
      expect(screen.getByTestId('cred-state')).toHaveTextContent('CLEARED');
      expect(screen.queryByText('SecretPwd!')).not.toBeInTheDocument();
    });
  });

  // =====================================================
  // 12. FACULTY BULK MARKS MODAL WORKFLOW
  // =====================================================
  describe('12. Faculty Bulk Marks Modal Workflow', () => {
    test('Renders assigned subjects on open', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/faculty/subjects') {
          return Promise.resolve({
            data: [{ id: 'sub-1', code: 'CS101', name: 'Data Structures' }]
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(<FacultyBulkMarksModal isOpen={true} onClose={vi.fn()} onToast={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Bulk Import Subject Marks')).toBeInTheDocument();
        expect(screen.getByText('CS101 - Data Structures')).toBeInTheDocument();
      });
    });

    test('Downloads marks template when requested', async () => {
      api.get.mockImplementation((url, opts) => {
        if (url === '/bulk/templates/marks' && opts?.responseType === 'blob') {
          return Promise.resolve({ data: new Blob(['template']), headers: {} });
        }
        if (url === '/faculty/subjects') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<FacultyBulkMarksModal isOpen={true} onClose={vi.fn()} onToast={vi.fn()} />);

      fireEvent.click(screen.getByText(/Template \(\.xlsx\)/i));

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/bulk/templates/marks', { responseType: 'blob' });
      });
    });

    test('Runs dry-run and shows CREATE / UPDATE / NO-OP preview', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/faculty/subjects') return Promise.resolve({ data: [{ id: 'sub-1', code: 'CS101', name: 'Data Structures' }] });
        return Promise.resolve({ data: [] });
      });

      api.post.mockResolvedValue({
        data: {
          valid: true,
          summary: { totalRows: 3, validRows: 3, invalidRows: 0 },
          token: 'faculty-marks-token',
          errors: [],
          preview: [
            { rollNo: 'STU001', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 45, maxMarks: 50, action: 'CREATE' },
            { rollNo: 'STU002', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 48, maxMarks: 50, action: 'UPDATE' },
            { rollNo: 'STU003', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 40, maxMarks: 50, action: 'NO-OP' },
          ]
        }
      });

      render(<FacultyBulkMarksModal isOpen={true} onClose={vi.fn()} onToast={vi.fn()} />);

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'faculty_marks.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
        expect(screen.getByText('UPDATE')).toBeInTheDocument();
        expect(screen.getByText('NO-OP')).toBeInTheDocument();
        expect(screen.getByText(/Confirm Marks Import/i)).toBeInTheDocument();
      });
    });

    test('Confirms valid marks import and closes modal', async () => {
      const onClose = vi.fn();
      const onToast = vi.fn();

      api.get.mockImplementation((url) => {
        if (url === '/faculty/subjects') return Promise.resolve({ data: [] });
        return Promise.resolve({ data: [] });
      });

      api.post
        .mockResolvedValueOnce({
          data: {
            valid: true,
            summary: { totalRows: 1, validRows: 1, invalidRows: 0 },
            token: 'valid-marks-token',
            errors: [],
            preview: [{ rollNo: 'STU001', subjectCode: 'CS101', examType: 'INTERNAL1', marksObtained: 45, maxMarks: 50, action: 'CREATE' }]
          }
        })
        .mockResolvedValueOnce({
          data: { message: 'Marks imported successfully!' }
        });

      render(<FacultyBulkMarksModal isOpen={true} onClose={onClose} onToast={onToast} />);

      const input = document.getElementById('bulk-file-input');
      const file = new File(['data'], 'marks.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(file, 'size', { value: 1024 });

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText(/Run Dry-Run Validation/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Marks Import/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Confirm Marks Import/i));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/bulk/import/marks/confirm',
          expect.any(FormData),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        expect(onToast).toHaveBeenCalledWith('Marks imported successfully!', 'success');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
