import React, { useState, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, Users, UserCheck, Award, Calendar, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import { downloadBlob } from '../utils/downloadHelper';
import BulkUploadDropzone from '../components/BulkUploadDropzone';
import DryRunSummary from '../components/DryRunSummary';
import ValidationErrorTable from '../components/ValidationErrorTable';
import ImportPreviewTable from '../components/ImportPreviewTable';
import CredentialSummaryModal from '../components/CredentialSummaryModal';
import ExportDataModal from '../components/ExportDataModal';
import Toast from '../components/Toast';

export default function AdminBulkImportManager() {
  const [activeTab, setActiveTab] = useState('STUDENTS'); // STUDENTS | FACULTY | MARKS | TIMETABLE | EXPORTS

  // Upload & Dry-Run state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [validationToken, setValidationToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);

  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);

  // Timetable specific state
  const [draftSchedules, setDraftSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Toast notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Helper to invalidate dry-run state completely (used on file replace/removal/expiration/tab switch)
  const resetWorkflowState = () => {
    setSelectedFile(null);
    setDryRunResult(null);
    setValidationToken(null);
    setTokenExpiresAt(null);
    setIsDryRunning(false);
    setIsConfirming(false);
  };

  // Reset state when switching tabs
  const handleTabChange = (tabKey) => {
    resetWorkflowState();
    setActiveTab(tabKey);
    if (tabKey === 'EXPORTS') {
      setIsExportModalOpen(true);
    }
  };

  // Fetch DRAFT schedules when Timetable tab is selected
  useEffect(() => {
    if (activeTab === 'TIMETABLE') {
      const fetchDraftSchedules = async () => {
        setLoadingSchedules(true);
        try {
          const res = await api.get('/timetable/schedules', { params: { status: 'DRAFT' } });
          const list = Array.isArray(res.data) ? res.data : [];
          setDraftSchedules(list);
          if (list.length > 0) setSelectedScheduleId(list[0].id);
        } catch (err) {
          console.error('Error loading draft schedules:', err);
          showToast('Failed to load draft schedules.', 'error');
        } finally {
          setLoadingSchedules(false);
        }
      };
      fetchDraftSchedules();
    }
  }, [activeTab]);

  // File select handler (invalidates prior dry-run state)
  const handleFileSelect = (file) => {
    resetWorkflowState();
    setSelectedFile(file);
  };

  const handleFileClear = () => {
    resetWorkflowState();
  };

  // Download official Excel templates from backend
  const handleDownloadTemplate = async () => {
    try {
      let endpoint = '';
      let fallbackName = 'template.xlsx';

      if (activeTab === 'STUDENTS') {
        endpoint = '/bulk/templates/students';
        fallbackName = 'students_import_template.xlsx';
      } else if (activeTab === 'FACULTY') {
        endpoint = '/bulk/templates/faculty';
        fallbackName = 'faculty_import_template.xlsx';
      } else if (activeTab === 'MARKS') {
        endpoint = '/bulk/templates/marks';
        fallbackName = 'marks_import_template.xlsx';
      } else if (activeTab === 'TIMETABLE') {
        endpoint = '/bulk/templates/timetable';
        fallbackName = 'timetable_import_template.xlsx';
      }

      const response = await api.get(endpoint, { responseType: 'blob' });
      downloadBlob(response.data, fallbackName, response.headers);
      showToast('Template downloaded successfully.', 'success');
    } catch (err) {
      console.error('Error downloading template:', err);
      showToast('Failed to download spreadsheet template.', 'error');
    }
  };

  // Trigger Stage 1: Dry-Run Validation
  const handleRunDryRun = async () => {
    if (!selectedFile) {
      showToast('Please select a spreadsheet file first.', 'error');
      return;
    }

    if (activeTab === 'TIMETABLE' && !selectedScheduleId) {
      showToast('Please select a target DRAFT schedule first.', 'error');
      return;
    }

    setIsDryRunning(true);
    setDryRunResult(null);
    setValidationToken(null);
    setTokenExpiresAt(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      let endpoint = '';
      if (activeTab === 'STUDENTS') endpoint = '/bulk/import/students/dry-run';
      else if (activeTab === 'FACULTY') endpoint = '/bulk/import/faculty/dry-run';
      else if (activeTab === 'MARKS') endpoint = '/bulk/import/marks/dry-run';
      else if (activeTab === 'TIMETABLE') endpoint = `/bulk/import/timetable/${selectedScheduleId}/dry-run`;

      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDryRunResult(response.data);
      if (response.data.token) {
        setValidationToken(response.data.token);
        setTokenExpiresAt(Date.now() + 15 * 60 * 1000); // 15 minute token lifetime
      }

      if (response.data.valid) {
        showToast('Dry-run validation passed cleanly! You can now confirm import.', 'success');
      } else {
        showToast(`Dry-run validation found ${response.data.errors?.length || 0} error(s).`, 'error');
      }
    } catch (err) {
      console.error('Dry-run failed:', err);
      const msg = err.response?.data?.message || 'Dry-run validation failed.';
      showToast(msg, 'error');
    } finally {
      setIsDryRunning(false);
    }
  };

  // Trigger Stage 2: Confirm Import
  const handleConfirmImport = async () => {
    if (!validationToken || !selectedFile || !dryRunResult?.valid) return;

    setIsConfirming(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('token', validationToken);

      let endpoint = '';
      if (activeTab === 'STUDENTS') endpoint = '/bulk/import/students/confirm';
      else if (activeTab === 'FACULTY') endpoint = '/bulk/import/faculty/confirm';
      else if (activeTab === 'MARKS') endpoint = '/bulk/import/marks/confirm';
      else if (activeTab === 'TIMETABLE') endpoint = `/bulk/import/timetable/${selectedScheduleId}/confirm`;

      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast(response.data.message || 'Import confirmed successfully!', 'success');

      // If credentials returned (Student/Faculty import), open Credential Modal
      if (response.data.credentials && Array.isArray(response.data.credentials)) {
        setCredentials(response.data.credentials);
        setIsCredentialModalOpen(true);
      }

      // Reset dry-run state after successful commit to prevent duplicate commits
      resetWorkflowState();
    } catch (err) {
      console.error('Confirmation failed:', err);
      const msg = err.response?.data?.message || 'Import confirmation failed.';
      showToast(msg, 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  // Close Credential Modal & wipe credentials from transient state
  const handleCloseCredentialModal = () => {
    setCredentials(null);
    setIsCredentialModalOpen(false);
    showToast('Temporary credential state cleared.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-500" />
            <span>Bulk Operations & Data Management Portal</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Perform multi-entity bulk registrations, marks updates, timetable imports, and custom ledger exports.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>Export Academic Reports</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'STUDENTS', label: 'Students Registration', icon: Users },
          { id: 'FACULTY', label: 'Faculty Onboarding', icon: UserCheck },
          { id: 'MARKS', label: 'Academic Marks', icon: Award },
          { id: 'TIMETABLE', label: 'Timetable Scheduling', icon: Calendar }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg border border-blue-500'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        
        {/* Step 1: Guidance & Template Download */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Step 1: Download Spreadsheet Template</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fill in your data using the standard formatting template. Do not modify header names.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download {activeTab} Template (.xlsx)</span>
          </button>
        </div>

        {/* Timetable Target Schedule Selector */}
        {activeTab === 'TIMETABLE' && (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
              Select Target DRAFT Schedule *
            </label>
            {loadingSchedules ? (
              <p className="text-xs text-slate-400">Loading draft schedules...</p>
            ) : draftSchedules.length > 0 ? (
              <select
                value={selectedScheduleId}
                onChange={(e) => {
                  setSelectedScheduleId(e.target.value);
                  resetWorkflowState();
                }}
                className="w-full bg-slate-800 text-slate-200 text-xs p-3 rounded-xl border border-slate-700 focus:outline-none focus:border-blue-500"
              >
                {draftSchedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.department?.code} (Batch: {s.batchYear}, Sec: {s.section}, Sem: {s.semester})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>No draft timetable schedule available. Create a draft schedule in Timetable Manager first.</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Upload Dropzone */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-200">Step 2: Select or Drop Spreadsheet File</h3>
          <BulkUploadDropzone
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onFileClear={handleFileClear}
            disabled={isDryRunning || isConfirming}
          />
        </div>

        {/* Step 3: Run Dry-Run Validation Action */}
        {selectedFile && !dryRunResult && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleRunDryRun}
              disabled={isDryRunning}
              className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
            >
              <Upload className="w-4 h-4" />
              <span>{isDryRunning ? 'Validating Spreadsheet...' : 'Run Dry-Run Validation'}</span>
            </button>
          </div>
        )}

        {/* Step 4: Dry-Run Results Display */}
        {dryRunResult && (
          <div className="space-y-6 pt-2 border-t border-slate-800">
            <DryRunSummary
              summary={dryRunResult.summary}
              valid={dryRunResult.valid}
              expiresAt={tokenExpiresAt}
              onTokenExpire={() => setValidationToken(null)}
              importType={activeTab}
            />

            {/* Error Table if validation failed */}
            {!dryRunResult.valid && (
              <ValidationErrorTable
                errors={dryRunResult.errors}
                onToast={showToast}
              />
            )}

            {/* Sample Preview Table */}
            {dryRunResult.preview && dryRunResult.preview.length > 0 && (
              <ImportPreviewTable
                previewData={dryRunResult.preview}
                importType={activeTab}
              />
            )}

            {/* Step 5: Confirm Import Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={resetWorkflowState}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Reset & Re-upload
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!dryRunResult.valid || !validationToken || isConfirming}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isConfirming ? 'Confirming Import...' : 'Confirm & Commit Import'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Credential Delivery Modal */}
      {isCredentialModalOpen && credentials && (
        <CredentialSummaryModal
          credentials={credentials}
          onClose={handleCloseCredentialModal}
          onToast={showToast}
        />
      )}

      {/* Export Data Modal */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        userRole="ADMIN"
        onToast={showToast}
      />
    </div>
  );
}
