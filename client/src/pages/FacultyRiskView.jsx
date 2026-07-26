import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, AlertTriangle, Info, Filter, Search, Eye, X, Loader2 } from 'lucide-react';
import api from '../utils/api';
import Toast from '../components/Toast';
import AcademicHealthCard from '../components/AcademicHealthCard';

export default function FacultyRiskView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [detailStudentId, setDetailStudentId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedSubject) params.subjectId = selectedSubject;
      if (selectedBatch) params.batchYear = selectedBatch;
      if (selectedSection) params.section = selectedSection;
      if (selectedRiskLevel) params.riskLevel = selectedRiskLevel;

      const res = await api.get('/risk/faculty/students', { params });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching faculty risk view:', err);
      setToastType('error');
      setToastMessage('Failed to load student risk profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSubject, selectedBatch, selectedSection, selectedRiskLevel]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
        <span className="ml-3 text-slate-400">Loading student risk metrics...</span>
      </div>
    );
  }

  const { summary = { total: 0, high: 0, medium: 0, low: 0 }, subjects = [], students = [] } = data || {};

  const filteredStudents = students.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.rollNo.toLowerCase().includes(term);
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Faculty Academic Attention Portal</h1>
            <p className="text-slate-400 text-sm">Monitor student academic risk levels and explainable primary factors for assigned subjects.</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-semibold">
              Authorized Subject View
            </div>
          </div>
        </div>

        {/* Summary Counter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
            <p className="text-xs font-medium text-slate-400">Total Enrolled</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          </div>

          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>High Risk</span>
            </div>
            <p className="text-2xl font-bold text-rose-300 mt-1">{summary.high}</p>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
              <Info className="w-4 h-4" />
              <span>Medium Risk</span>
            </div>
            <p className="text-2xl font-bold text-amber-300 mt-1">{summary.medium}</p>
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Good Standing</span>
            </div>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{summary.low}</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Assigned Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Batch Year</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Batches</option>
              <option value="2024-28">2024-28</option>
              <option value="2025-29">2025-29</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk Level</label>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search & Student List */}
      <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Student Risk Roster ({filteredStudents.length})</h2>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or roll no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white w-full focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
            <thead className="bg-slate-900/60 font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Student Details</th>
                <th className="px-4 py-4 text-center">Attendance Risk</th>
                <th className="px-4 py-4 text-center">Marks Risk</th>
                <th className="px-4 py-4 text-center">Data Quality</th>
                <th className="px-4 py-4 text-center">Risk Level</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {filteredStudents.map((s) => (
                <tr key={s.studentId} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100">{s.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Roll: {s.rollNo} • {s.batchYear} ({s.section})
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center font-mono font-medium">
                    {s.attendanceScore.toFixed(0)} / 100
                  </td>
                  <td className="px-4 py-4 text-center font-mono font-medium">
                    {s.marksScore.toFixed(0)} / 100
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded font-semibold text-[10px]">
                      {s.confidenceLevel} ({s.dataCompleteness}%)
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                        s.riskLevel === 'HIGH'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : s.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {s.riskLevel} ({s.riskScore.toFixed(0)})
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setDetailStudentId(s.studentId)}
                      className="flex items-center space-x-1 ml-auto px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Breakdown</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    No student risk records match current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Student Risk Analysis Breakdown</h3>
              <button
                type="button"
                onClick={() => setDetailStudentId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <AcademicHealthCard studentId={detailStudentId} />
          </div>
        </div>
      )}

      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
}
