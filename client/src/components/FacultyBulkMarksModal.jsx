import React, { useState, useEffect } from 'react';
import { Award, Download, Upload, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import { downloadBlob } from '../utils/downloadHelper';
import BulkUploadDropzone from './BulkUploadDropzone';
import DryRunSummary from './DryRunSummary';
import ValidationErrorTable from './ValidationErrorTable';
import ImportPreviewTable from './ImportPreviewTable';

export default function FacultyBulkMarksModal({ isOpen, onClose, onToast }) {
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [validationToken, setValidationToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const res = await api.get('/faculty/subjects');
        setSubjects(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching faculty subjects:', err);
        if (onToast) onToast('Failed to load assigned subjects.', 'error');
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [isOpen, onToast]);

  if (!isOpen) return null;

  const resetWorkflowState = () => {
    setSelectedFile(null);
    setDryRunResult(null);
    setValidationToken(null);
    setTokenExpiresAt(null);
    setIsDryRunning(false);
    setIsConfirming(false);
  };

  const handleFileSelect = (file) => {
    resetWorkflowState();
    setSelectedFile(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/bulk/templates/marks', { responseType: 'blob' });
      downloadBlob(response.data, 'marks_import_template.xlsx', response.headers);
      if (onToast) onToast('Marks template downloaded successfully.', 'success');
    } catch (err) {
      console.error('Error downloading template:', err);
      if (onToast) onToast('Failed to download marks template.', 'error');
    }
  };

  const handleRunDryRun = async () => {
    if (!selectedFile) return;

    setIsDryRunning(true);
    setDryRunResult(null);
    setValidationToken(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/bulk/import/marks/dry-run', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDryRunResult(response.data);
      if (response.data.token) {
        setValidationToken(response.data.token);
        setTokenExpiresAt(Date.now() + 15 * 60 * 1000);
      }

      if (response.data.valid) {
        if (onToast) onToast('Marks dry-run validation passed! Ready to confirm.', 'success');
      } else {
        if (onToast) onToast(`Dry-run validation found ${response.data.errors?.length || 0} error(s).`, 'error');
      }
    } catch (err) {
      console.error('Marks dry-run error:', err);
      const msg = err.response?.data?.message || 'Dry-run validation failed.';
      if (onToast) onToast(msg, 'error');
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationToken || !selectedFile || !dryRunResult?.valid) return;

    setIsConfirming(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('token', validationToken);

      const response = await api.post('/bulk/import/marks/confirm', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (onToast) onToast(response.data.message || 'Marks imported successfully!', 'success');
      resetWorkflowState();
      onClose();
    } catch (err) {
      console.error('Marks confirm error:', err);
      const msg = err.response?.data?.message || 'Failed to confirm marks import.';
      if (onToast) onToast(msg, 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-sidebar/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-card border border-border-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-app pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Bulk Import Subject Marks</h2>
              <p className="text-xs text-text-muted">Import student exam marks for subjects assigned to you.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main hover:bg-bg-sidebar rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Assigned Subjects Summary */}
          <div className="p-3 bg-bg-app/50 border border-border-app rounded-xl text-xs space-y-1">
            <span className="font-semibold text-text-main">Your Authorized Subjects:</span>
            {loadingSubjects ? (
              <p className="text-text-muted">Loading assigned subjects...</p>
            ) : subjects.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {subjects.map(s => (
                  <span key={s.id} className="px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md font-mono">
                    {s.code} - {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-amber-400">No subjects currently assigned to your account.</p>
            )}
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between p-3.5 bg-bg-app/60 border border-border-app rounded-xl text-xs">
            <div>
              <p className="font-bold text-text-main">Download Marks Template</p>
              <p className="text-text-muted">Use Internal 1, Internal 2, or Semester exam types.</p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-bg-sidebar hover:bg-bg-input text-blue-400 border border-border-card rounded-lg font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Template (.xlsx)</span>
            </button>
          </div>

          {/* File Dropzone */}
          <BulkUploadDropzone
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onFileClear={resetWorkflowState}
            disabled={isDryRunning || isConfirming}
          />

          {/* Run Dry-Run button */}
          {selectedFile && !dryRunResult && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunDryRun}
                disabled={isDryRunning}
                className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
              >
                <Upload className="w-4 h-4" />
                <span>{isDryRunning ? 'Validating Marks...' : 'Run Dry-Run Validation'}</span>
              </button>
            </div>
          )}

          {/* Results display */}
          {dryRunResult && (
            <div className="space-y-4 pt-2 border-t border-border-app">
              <DryRunSummary
                summary={dryRunResult.summary}
                valid={dryRunResult.valid}
                expiresAt={tokenExpiresAt}
                onTokenExpire={() => setValidationToken(null)}
                importType="MARKS"
              />

              {!dryRunResult.valid && (
                <ValidationErrorTable
                  errors={dryRunResult.errors}
                  onToast={onToast}
                />
              )}

              {dryRunResult.preview && dryRunResult.preview.length > 0 && (
                <ImportPreviewTable
                  previewData={dryRunResult.preview}
                  importType="MARKS"
                />
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border-app">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-bg-sidebar hover:bg-bg-input text-text-main rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>

          {dryRunResult && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!dryRunResult.valid || !validationToken || isConfirming}
              className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isConfirming ? 'Confirming Import...' : 'Confirm Marks Import'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
