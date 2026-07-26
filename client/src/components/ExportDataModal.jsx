import React, { useState, useEffect } from 'react';
import { Download, X, FileSpreadsheet, Filter, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';
import { downloadBlob } from '../utils/downloadHelper';

export default function ExportDataModal({ isOpen, onClose, userRole, onToast }) {
  const [reportType, setReportType] = useState('ATTENDANCE'); // ATTENDANCE | MARKS | TIMETABLE
  const [format, setFormat] = useState('xlsx'); // xlsx | csv
  const [departmentId, setDepartmentId] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [section, setSection] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [scheduleId, setScheduleId] = useState('');

  // Dropdown lists
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDropdownOptions = async () => {
      setLoadingOptions(true);
      try {
        if (userRole === 'FACULTY') {
          // Faculty: load assigned subjects from /api/faculty/subjects
          const subRes = await api.get('/faculty/subjects');
          setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
        } else if (userRole === 'ADMIN') {
          // Admin: load departments, subjects, and schedules
          const [deptRes, subRes, schedRes] = await Promise.all([
            api.get('/admin/departments').catch(() => ({ data: [] })),
            api.get('/admin/subjects').catch(() => ({ data: [] })),
            api.get('/timetable/schedules').catch(() => ({ data: [] }))
          ]);
          setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
          setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
          setSchedules(Array.isArray(schedRes.data) ? schedRes.data : []);
        }
      } catch (err) {
        console.error('Error loading export filter dropdown options:', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchDropdownOptions();
  }, [isOpen, userRole]);

  if (!isOpen) return null;

  const handleExport = async (e) => {
    e.preventDefault();
    setIsExporting(true);

    try {
      let endpoint = '';
      let queryParams = { format };
      let fallbackFilename = `export_${reportType.toLowerCase()}_${Date.now()}.${format}`;

      if (reportType === 'ATTENDANCE') {
        endpoint = '/bulk/export/attendance';
        if (departmentId) queryParams.departmentId = departmentId;
        if (batchYear) queryParams.batchYear = batchYear;
        if (section) queryParams.section = section;
        if (subjectId) queryParams.subjectId = subjectId;
      } else if (reportType === 'MARKS') {
        endpoint = '/bulk/export/marks';
        if (departmentId) queryParams.departmentId = departmentId;
        if (batchYear) queryParams.batchYear = batchYear;
        if (section) queryParams.section = section;
        if (subjectId) queryParams.subjectId = subjectId;
      } else if (reportType === 'TIMETABLE') {
        if (!scheduleId) {
          if (onToast) onToast('Please select a timetable schedule to export.', 'error');
          setIsExporting(false);
          return;
        }
        endpoint = `/bulk/export/timetable/${scheduleId}`;
      }

      const response = await api.get(endpoint, {
        params: queryParams,
        responseType: 'blob'
      });

      downloadBlob(response.data, fallbackFilename, response.headers);
      if (onToast) onToast('Export downloaded successfully.', 'success');
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      const msg = err.response?.data?.message || 'Failed to generate export report.';
      if (onToast) onToast(msg, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Export Academic Data</h2>
              <p className="text-xs text-slate-400">Download formatted Excel or CSV report ledgers.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleExport} className="space-y-4 text-xs">
          
          {/* Report Type Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Report Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ATTENDANCE', label: 'Attendance' },
                { id: 'MARKS', label: 'Academic Marks' },
                { id: 'TIMETABLE', label: 'Timetable Grid' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReportType(item.id)}
                  className={`py-2 px-3 rounded-xl border font-semibold transition-all text-center ${
                    reportType === item.id
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">File Format</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'xlsx', label: 'Excel (.xlsx)' },
                { id: 'csv', label: 'CSV (.csv)' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`py-2 px-3 rounded-xl border font-semibold transition-all text-center ${
                    format === f.id
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Options */}
          <div className="bg-slate-950/50 p-4 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-slate-400 font-semibold border-b border-slate-800 pb-2">
              <Filter className="w-4 h-4 text-blue-400" />
              <span>Report Filters (Optional)</span>
            </div>

            {reportType === 'TIMETABLE' ? (
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Select Timetable Schedule *</label>
                <select
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                  required
                  className="w-full bg-slate-800 text-slate-200 p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Schedule --</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.department?.code || 'Dept'} - {s.batchYear} - Sec {s.section}) [{s.status}]
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                {userRole === 'ADMIN' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">All Departments</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Batch Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024-28"
                      value={batchYear}
                      onChange={(e) => setBatchYear(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Section</label>
                    <input
                      type="text"
                      placeholder="e.g. A"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-slate-800 text-slate-200 p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">
                      {userRole === 'FACULTY' ? '-- Select Taught Subject --' : 'All Subjects'}
                    </option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isExporting}
              className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating Export...' : 'Download Export'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
