import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, RefreshCw, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function BulkUploadDropzone({ selectedFile, onFileSelect, onFileClear, disabled }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientError, setClientError] = useState('');
  const fileInputRef = useRef(null);

  const validateAndProcessFile = (file) => {
    setClientError('');

    if (!file) return;

    const name = file.name.toLowerCase();
    
    // Explicitly reject .xls
    if (name.endsWith('.xls')) {
      setClientError('Legacy binary Excel files (.xls) are not supported. Please convert your file to .xlsx or .csv.');
      return;
    }

    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      setClientError('Invalid file type. Only .xlsx and .csv files are allowed.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setClientError(`File size exceeds maximum limit of 5 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }

    // Always notify parent of file selection (this invalidates any existing dry-run confirmation state)
    onFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleRemove = () => {
    setClientError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFileClear();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .csv"
        className="hidden"
        id="bulk-file-input"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/80'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-medium text-slate-200">
                Drag and drop your spreadsheet here, or <span className="text-blue-400 font-semibold underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports Excel (.xlsx) and CSV (.csv) up to 5 MB. Legacy .xls is not supported.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-slate-800/80 border border-slate-700 rounded-xl">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">
                {formatSize(selectedFile.size)} • {selectedFile.name.split('.').pop()?.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => !disabled && fileInputRef.current?.click()}
              disabled={disabled}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors text-xs flex items-center space-x-1"
              title="Replace file"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Replace</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-xs flex items-center space-x-1"
              title="Remove file"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Remove</span>
            </button>
          </div>
        </div>
      )}

      {clientError && (
        <div className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{clientError}</span>
        </div>
      )}
    </div>
  );
}
