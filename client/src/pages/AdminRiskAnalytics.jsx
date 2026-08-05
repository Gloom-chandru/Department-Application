import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, ShieldCheck, Info, RefreshCw, Eye, X, Loader2, Layers, Download } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Toast from '../components/Toast';
import AcademicHealthCard from '../components/AcademicHealthCard';

const COLORS = {
  HIGH: '#f43f5e',   // rose-500
  MEDIUM: '#f59e0b', // amber-500
  LOW: '#10b981',    // emerald-500
};

export default function AdminRiskAnalytics() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('');

  const [summaryData, setSummaryData] = useState(null);
  const [studentsData, setStudentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const [detailStudentId, setDetailStudentId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/admin/departments');
        setDepartments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepartments();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDept) params.departmentId = selectedDept;
      if (selectedBatch) params.batchYear = selectedBatch;
      if (selectedSection) params.section = selectedSection;
      if (selectedRiskLevel) params.riskLevel = selectedRiskLevel;

      const [sumRes, stuRes] = await Promise.all([
        api.get('/risk/admin/summary', { params }),
        api.get('/risk/admin/students', { params: { ...params, limit: 50 } }),
      ]);

      setSummaryData(sumRes.data);
      setStudentsData(stuRes.data.students || []);
    } catch (err) {
      console.error('Error fetching admin risk analytics:', err);
      setToastType('error');
      setToastMessage('Failed to load risk analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedDept, selectedBatch, selectedSection, selectedRiskLevel]);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const payload = {};
      if (selectedDept) payload.departmentId = selectedDept;
      if (selectedBatch) payload.batchYear = selectedBatch;
      if (selectedSection) payload.section = selectedSection;

      const res = await api.post('/risk/admin/recalculate', payload);
      setToastType('success');
      setToastMessage(res.data.message || 'Recalculation complete.');
      await fetchAnalytics();
    } catch (err) {
      console.error('Error recalculating risk:', err);
      setToastType('error');
      setToastMessage('Failed to recalculate cohort risk.');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
        <span className="ml-3 text-text-muted">Loading system academic risk analytics...</span>
      </div>
    );
  }

  const { counters = {}, distribution = { HIGH: 0, MEDIUM: 0, LOW: 0 }, departmentBenchmarks = [], topFactorCategories = [] } = summaryData || {};

  const pieChartData = [
    { name: 'High Risk', value: distribution.HIGH, color: COLORS.HIGH },
    { name: 'Medium Risk', value: distribution.MEDIUM, color: COLORS.MEDIUM },
    { name: 'Good Standing', value: distribution.LOW, color: COLORS.LOW },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="backdrop-blur-md bg-bg-card/40 border border-border-app p-6 rounded-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-main mb-2">Academic Risk & Early-Warning Control Hub</h1>
            <p className="text-text-muted text-sm">System-wide monitoring of student academic risk distributions, cohort benchmarks, and recalculation engine.</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-text-main text-xs font-semibold rounded-xl transition-all shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              <span>{recalculating ? 'Recalculating Cohort...' : 'Recalculate Cohort Risk'}</span>
            </button>
          </div>
        </div>

        {/* Counter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-bg-app/60 border border-border-app rounded-xl">
            <p className="text-xs font-medium text-text-muted">Total Assessed Students</p>
            <p className="text-2xl font-bold text-text-main mt-1">{counters.assessedStudents || 0}</p>
          </div>

          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>High Attention Needed</span>
            </div>
            <p className="text-2xl font-bold text-rose-300 mt-1">{distribution.HIGH}</p>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
              <Info className="w-4 h-4" />
              <span>Moderate Attention</span>
            </div>
            <p className="text-2xl font-bold text-amber-300 mt-1">{distribution.MEDIUM}</p>
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Average Risk Score</span>
            </div>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{counters.averageRiskScore || 0} / 100</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-border-app">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Batch Year</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main focus:outline-none"
            >
              <option value="">All Batches</option>
              <option value="2024-28">2024-28</option>
              <option value="2025-29">2025-29</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main focus:outline-none"
            >
              <option value="">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Risk Level</label>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main focus:outline-none"
            >
              <option value="">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart: Distribution */}
        <div className="backdrop-blur-md bg-bg-card/40 border border-border-app p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <h2 className="text-base font-bold text-text-main">Risk Level Distribution</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="text-text-main">High ({distribution.HIGH})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="text-text-main">Medium ({distribution.MEDIUM})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-text-main">Low ({distribution.LOW})</span>
            </div>
          </div>
        </div>

        {/* Bar Chart: Department Benchmarks */}
        <div className="backdrop-blur-md bg-bg-card/40 border border-border-app p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <h2 className="text-base font-bold text-text-main">Department Average Risk Score Benchmark</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentBenchmarks}>
                <XAxis dataKey="code" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="averageRiskScore" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-text-muted text-center">Benchmark score scale 0-100 (Higher score indicates greater academic attention required).</p>
        </div>
      </div>

      {/* Roster & Top Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Risk List */}
        <div className="lg:col-span-2 backdrop-blur-md bg-bg-card/40 border border-border-app p-6 rounded-2xl space-y-4">
          <h2 className="text-base font-bold text-text-main">Student Attention Roster ({studentsData.length})</h2>

          <div className="overflow-x-auto rounded-xl border border-border-app bg-bg-app/40">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-bg-card/60 font-semibold uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3">Student Details</th>
                  <th className="px-3 py-3 text-center">Dept</th>
                  <th className="px-3 py-3 text-center">Confidence</th>
                  <th className="px-3 py-3 text-center">Risk Level</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-text-main">
                {studentsData.map((s) => (
                  <tr key={s.studentId} className="hover:bg-bg-card/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{s.name}</div>
                      <div className="text-[11px] text-text-muted font-mono">
                        {s.rollNo} • {s.batchYear} ({s.section})
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-text-main">{s.department}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 bg-bg-sidebar text-text-main rounded font-mono text-[10px]">
                        {s.confidenceLevel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailStudentId(s.studentId)}
                        className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded text-[11px] font-semibold transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {studentsData.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-text-muted">
                      No student records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Risk Factor Categories */}
        <div className="backdrop-blur-md bg-bg-card/40 border border-border-app p-6 rounded-2xl space-y-4">
          <h2 className="text-base font-bold text-text-main">Top System Factor Categories</h2>
          <div className="space-y-3">
            {topFactorCategories.map((cat, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-bg-app/60 border border-border-app rounded-xl text-xs">
                <span className="font-semibold text-text-main">{cat.category}</span>
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-mono font-bold">
                  {cat.count} occurrences
                </span>
              </div>
            ))}
            {topFactorCategories.length === 0 && (
              <p className="text-xs text-text-muted py-4 text-center">No primary risk factors detected.</p>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detailStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-sidebar/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-bg-card border border-border-card rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-app pb-3">
              <h3 className="text-base font-bold text-text-main">Admin Student Risk Deep-Dive</h3>
              <button
                type="button"
                onClick={() => setDetailStudentId(null)}
                className="p-1.5 text-text-muted hover:text-text-main rounded-lg"
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
