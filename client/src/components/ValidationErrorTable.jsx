import React, { useState, useMemo } from 'react';
import { Download, Search, Filter, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { downloadBlob } from '../utils/downloadHelper';

export default function ValidationErrorTable({ errors, onToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCode, setSelectedCode] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const pageSize = 10;

  // Extract unique error codes for filter dropdown
  const uniqueCodes = useMemo(() => {
    if (!Array.isArray(errors)) return [];
    const set = new Set(errors.map(e => e.code).filter(Boolean));
    return Array.from(set);
  }, [errors]);

  // Filter errors
  const filteredErrors = useMemo(() => {
    if (!Array.isArray(errors)) return [];
    return errors.filter(err => {
      const matchCode = selectedCode === 'ALL' || err.code === selectedCode;
      const matchSearch =
        !searchTerm ||
        String(err.row).includes(searchTerm) ||
        String(err.column || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(err.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(err.message || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchCode && matchSearch;
    });
  }, [errors, selectedCode, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredErrors.length / pageSize));
  const paginatedErrors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredErrors.slice(start, start + pageSize);
  }, [filteredErrors, currentPage, pageSize]);

  // Download official backend XLSX error workbook
  const handleDownloadErrorWorkbook = async () => {
    if (!errors || errors.length === 0) return;
    setIsDownloading(true);
    try {
      const response = await api.post(
        '/bulk/errors/download',
        { errors },
        { responseType: 'blob' }
      );
      downloadBlob(response.data, 'validation_errors.xlsx', response.headers);
      if (onToast) onToast('Error workbook downloaded successfully.', 'success');
    } catch (err) {
      console.error('Error downloading validation error workbook:', err);
      if (onToast) onToast('Failed to download error workbook.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!errors || errors.length === 0) return null;

  return (
    <div className="bg-bg-sidebar/80 border border-border-card rounded-xl overflow-hidden space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Validation Errors ({errors.length})</h3>
            <p className="text-xs text-text-muted">Please correct the spreadsheet rows below and re-upload.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadErrorWorkbook}
          disabled={isDownloading}
          className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'Downloading...' : 'Download Error Workbook (.xlsx)'}</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-card/40 p-3 rounded-lg border border-border-card/60">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search error messages or row numbers..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-bg-sidebar text-text-main text-xs pl-9 pr-3 py-2 rounded-lg border border-border-card focus:outline-none focus:border-blue-500"
          />
        </div>

        {uniqueCodes.length > 0 && (
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <select
              value={selectedCode}
              onChange={(e) => { setSelectedCode(e.target.value); setCurrentPage(1); }}
              className="bg-bg-sidebar text-text-main text-xs px-3 py-2 rounded-lg border border-border-card focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Error Types ({uniqueCodes.length})</option>
              {uniqueCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Table */}
      <div className="overflow-x-auto border border-border-card/80 rounded-lg">
        <table className="w-full text-left text-xs text-text-main">
          <thead className="bg-bg-card/80 text-text-muted font-semibold border-b border-border-card">
            <tr>
              <th className="py-2.5 px-3 text-center w-16">Row</th>
              <th className="py-2.5 px-3 w-32">Field / Column</th>
              <th className="py-2.5 px-3 w-44">Error Code</th>
              <th className="py-2.5 px-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60 bg-bg-sidebar/40">
            {paginatedErrors.length > 0 ? (
              paginatedErrors.map((err, idx) => (
                <tr key={idx} className="hover:bg-bg-input/40 transition-colors">
                  <td className="py-2.5 px-3 text-center font-mono font-semibold text-rose-400 bg-rose-500/5">
                    {err.row || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-medium text-text-main">
                    {err.column || 'All'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded text-[11px] font-mono">
                      {err.code}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-main leading-normal">
                    {err.message}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-text-muted">
                  No errors match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span>
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredErrors.length)} of {filteredErrors.length} errors
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 bg-bg-sidebar hover:bg-bg-input border border-border-card rounded disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-text-main">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 bg-bg-sidebar hover:bg-bg-input border border-border-card rounded disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
