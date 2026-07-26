import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { 
  Users, BookOpen, GraduationCap, Building, AlertTriangle, FileSpreadsheet, Settings, 
  Plus, Edit2, Trash2, Check, Loader2, X, ShieldAlert
} from 'lucide-react';
import { DashboardSkeleton, TableSkeleton } from '../components/SkeletonLoader';
import Toast from '../components/Toast';

const AdminDashboard = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('analytics');

  // Counters and Analytics
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Settings
  const [threshold, setThreshold] = useState('75');
  const [savingSettings, setSavingSettings] = useState(false);

  // CRUD states
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingCrud, setLoadingCrud] = useState(false);

  // Audit Logs states
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    page: 1,
    limit: 25,
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);

  // Modal control
  const [modalType, setModalType] = useState(null); // 'dept', 'subject', 'faculty', 'student'
  const [modalAction, setModalAction] = useState('create'); // 'create', 'edit'
  const [editId, setEditId] = useState(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', semester: '', departmentId: '', facultyId: '' });
  const [facultyForm, setFacultyForm] = useState({ name: '', email: '', password: '', designation: '', departmentId: '' });
  const [studentForm, setStudentForm] = useState({ 
    name: '', email: '', password: '', rollNo: '', batchYear: '2024-28', section: 'A', 
    mobileNo: '', guardianContact: '', departmentId: '' 
  });

  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [exporting, setExporting] = useState(false);

  const showMsg = (type, text) => {
    setToastType(type);
    setToastMessage(text);
  };

  // Load analytics & settings
  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const res = await api.get('/admin/analytics');
      setAnalytics(res.data);
      
      const settingsRes = await api.get('/admin/settings');
      const threshVal = settingsRes.data.find(s => s.key === 'low_attendance_threshold');
      if (threshVal) setThreshold(threshVal.value);
    } catch (err) {
      console.error(err);
      showMsg('error', 'Error loading administrative analytics.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchAuditLogs = async (filtersOverride = {}) => {
    try {
      setLoadingAudit(true);
      const activeFilters = { ...auditFilters, ...filtersOverride };
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });

      const res = await api.get(`/audit?${params.toString()}`);
      setAuditLogs(res.data.logs);
      setAuditPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
      showMsg('error', 'Failed to load audit logs.');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Load CRUD data based on active tab
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      return;
    }
    
    const fetchCrudData = async () => {
      try {
        setLoadingCrud(true);
        if (activeTab === 'departments') {
          const res = await api.get('/admin/departments');
          setDepartments(res.data);
        } else if (activeTab === 'subjects') {
          const res = await api.get('/admin/subjects');
          setSubjects(res.data);
          const depts = await api.get('/admin/departments');
          setDepartments(depts.data);
          const facs = await api.get('/admin/faculty');
          setFaculty(facs.data);
        } else if (activeTab === 'faculty') {
          const res = await api.get('/admin/faculty');
          setFaculty(res.data);
          const depts = await api.get('/admin/departments');
          setDepartments(depts.data);
        } else if (activeTab === 'students') {
          const res = await api.get('/admin/students');
          setStudents(res.data);
          const depts = await api.get('/admin/departments');
          setDepartments(depts.data);
        } else if (activeTab === 'audit') {
          fetchAuditLogs();
        }
      } catch (err) {
        console.error(err);
        showMsg('error', 'Failed to load records.');
      } finally {
        setLoadingCrud(false);
      }
    };
    fetchCrudData();
  }, [activeTab]);

  // Handle setting updates
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await api.put('/admin/settings', {
        key: 'low_attendance_threshold',
        value: threshold,
      });
      showMsg('success', 'Threshold settings updated successfully!');
    } catch (err) {
      showMsg('error', 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // CSV Export utility
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await api.get('/admin/export');
      const data = res.data;

      if (data.length === 0) {
        showMsg('error', 'No student records to export.');
        return;
      }

      // Compile CSV
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => 
          headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(',')
        )
      ];

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `VIT_Student_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showMsg('success', 'Excel-compatible CSV exported successfully!');
    } catch (err) {
      console.error(err);
      showMsg('error', 'Failed to generate report export.');
    } finally {
      setExporting(false);
    }
  };

  // --- CRUD ACTIONS ---
  const openModal = (type, action, item = null) => {
    setModalType(type);
    setModalAction(action);
    setEditId(item ? item.id : null);

    if (type === 'dept') {
      setDeptForm(item ? { name: item.name, code: item.code } : { name: '', code: '' });
    } else if (type === 'subject') {
      setSubjectForm(item ? {
        name: item.name,
        code: item.code,
        semester: item.semester.toString(),
        departmentId: item.departmentId,
        facultyId: item.facultyId
      } : { name: '', code: '', semester: '', departmentId: departments[0]?.id || '', facultyId: faculty[0]?.id || '' });
    } else if (type === 'faculty') {
      setFacultyForm(item ? {
        name: item.user.name,
        email: item.user.email,
        password: '',
        designation: item.designation,
        departmentId: item.departmentId
      } : { name: '', email: '', password: '', designation: '', departmentId: departments[0]?.id || '' });
    } else if (type === 'student') {
      setStudentForm(item ? {
        name: item.user.name,
        email: item.user.email,
        password: '',
        rollNo: item.rollNo,
        batchYear: item.batchYear,
        section: item.section,
        mobileNo: item.mobileNo,
        guardianContact: item.guardianContact,
        departmentId: item.departmentId
      } : {
        name: '', email: '', password: '', rollNo: '', batchYear: '2024-28', section: 'A',
        mobileNo: '', guardianContact: '', departmentId: departments[0]?.id || ''
      });
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalType === 'dept') {
        if (modalAction === 'create') {
          const res = await api.post('/admin/departments', deptForm);
          setDepartments([...departments, res.data]);
          showMsg('success', 'Department created successfully!');
        } else {
          const res = await api.put(`/admin/departments/${editId}`, deptForm);
          setDepartments(departments.map(d => d.id === editId ? res.data : d));
          showMsg('success', 'Department updated!');
        }
      } 
      else if (modalType === 'subject') {
        if (modalAction === 'create') {
          await api.post('/admin/subjects', subjectForm);
          const refetch = await api.get('/admin/subjects');
          setSubjects(refetch.data);
          showMsg('success', 'Subject registered!');
        } else {
          await api.put(`/admin/subjects/${editId}`, subjectForm);
          const refetch = await api.get('/admin/subjects');
          setSubjects(refetch.data);
          showMsg('success', 'Subject updated!');
        }
      }
      else if (modalType === 'faculty') {
        if (modalAction === 'create') {
          await api.post('/auth/register', { ...facultyForm, role: 'FACULTY' });
          const refetch = await api.get('/admin/faculty');
          setFaculty(refetch.data);
          showMsg('success', 'Faculty account registered successfully!');
        } else {
          await api.put(`/admin/faculty/${editId}`, facultyForm);
          const refetch = await api.get('/admin/faculty');
          setFaculty(refetch.data);
          showMsg('success', 'Faculty profile updated!');
        }
      }
      else if (modalType === 'student') {
        if (modalAction === 'create') {
          await api.post('/auth/register', { ...studentForm, role: 'STUDENT' });
          const refetch = await api.get('/admin/students');
          setStudents(refetch.data);
          showMsg('success', 'Student account registered!');
        } else {
          await api.put(`/admin/students/${editId}`, studentForm);
          const refetch = await api.get('/admin/students');
          setStudents(refetch.data);
          showMsg('success', 'Student profile updated!');
        }
      }
      setModalType(null); // Close modal
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.message || 'Transaction failed. Check inputs.');
    }
  };

  const handleDeleteItem = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) return;
    try {
      if (type === 'dept') {
        await api.delete(`/admin/departments/${id}`);
        setDepartments(departments.filter(d => d.id !== id));
      } else if (type === 'subject') {
        await api.delete(`/admin/subjects/${id}`);
        setSubjects(subjects.filter(s => s.id !== id));
      } else if (type === 'faculty') {
        await api.delete(`/admin/faculty/${id}`);
        setFaculty(faculty.filter(f => f.id !== id));
      } else if (type === 'student') {
        await api.delete(`/admin/students/${id}`);
        setStudents(students.filter(s => s.id !== id));
      }
      showMsg('success', 'Record deleted successfully!');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Delete operation blocked by constraints.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Administrative Console</h1>
          <p className="text-slate-400 text-sm">VIT Academic Portal Administration & Management</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          type="button"
          aria-label="Export all student attendance and marks reports to Excel compatible CSV"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-lg shadow-emerald-700/10"
        >
          {exporting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <FileSpreadsheet className="h-4.5 w-4.5" />}
          <span>Export Institution Report</span>
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap border-b border-slate-800 gap-1 sm:gap-2">
        {[
          { id: 'analytics', label: 'Overview Analytics', icon: Users },
          { id: 'departments', label: 'Departments', icon: Building },
          { id: 'subjects', label: 'Subjects', icon: BookOpen },
          { id: 'faculty', label: 'Faculty', icon: ShieldAlert },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'audit', label: 'Audit Logs', icon: FileSpreadsheet },
          { id: 'settings', label: 'System Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              aria-label={`Open ${tab.label} section`}
              className={`flex items-center gap-2 border-b-2 px-4 sm:px-6 py-3 font-semibold text-xs sm:text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW: OVERVIEW ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {loadingAnalytics ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Core Counters Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Departments', count: analytics?.counters.departments, icon: Building, color: 'text-blue-500' },
                  { label: 'Faculty Profiles', count: analytics?.counters.faculty, icon: ShieldAlert, color: 'text-amber-500' },
                  { label: 'Enrolled Students', count: analytics?.counters.students, icon: GraduationCap, color: 'text-emerald-500' },
                  { label: 'Course Subjects', count: analytics?.counters.subjects, icon: BookOpen, color: 'text-purple-500' },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
                      <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 ${c.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{c.count}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{c.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Analytics Graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Batch Attendance */}
                <div className="backdrop-blur-md bg-slate-900/20 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-slate-200 mb-6">Class Attendance Performance (%)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.attendanceByBatch}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="batch" stroke="#94a3b8" />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Legend />
                        <Bar dataKey="percentage" name="Avg Attendance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Batch Marks */}
                <div className="backdrop-blur-md bg-slate-900/20 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-slate-200 mb-6">Academic Grade Average (%)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.marksByBatch}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="batch" stroke="#94a3b8" />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Legend />
                        <Line type="monotone" dataKey="averagePercentage" name="Avg Marks Pct" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 max-w-xl p-8 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-500" />
            Portal Settings
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="settings-threshold" className="text-sm font-semibold text-slate-350">Minimum Required Attendance (%)</label>
              <div className="flex gap-4 items-center">
                <input
                  id="settings-threshold"
                  type="number"
                  required
                  min="50"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-slate-500">
                  Students below this percentage will receive low-attendance warnings and banners.
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 bg-blue-650 hover:bg-blue-600 rounded-lg text-white font-semibold text-sm transition-colors flex items-center gap-2"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Save System Settings</span>
            </button>
          </form>
        </div>
      )}

      {/* VIEW: CRUD LISTS */}
      {activeTab !== 'analytics' && activeTab !== 'settings' && activeTab !== 'audit' && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200 capitalize">{activeTab} Registry</h3>
            <button
              onClick={() => openModal(activeTab === 'departments' ? 'dept' : activeTab.slice(0, -1), 'create')}
              type="button"
              aria-label={`Create new ${activeTab.slice(0, -1)} entry`}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add New</span>
            </button>
          </div>

          {loadingCrud ? (
            <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-6">
              <TableSkeleton rows={4} />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
              {/* DEPARTMENTS TABLE */}
              {activeTab === 'departments' && (
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-900/50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Department Name</th>
                      <th className="px-6 py-4 text-center">Code</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {departments.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-900/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{d.name}</td>
                        <td className="px-6 py-4 text-center"><span className="bg-slate-900 px-2.5 py-1 border border-slate-800 rounded-md text-xs font-semibold">{d.code}</span></td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openModal('dept', 'edit', d)} aria-label={`Edit department ${d.code}`} className="p-1 text-slate-450 hover:text-blue-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteItem('dept', d.id)} aria-label={`Delete department ${d.code}`} className="p-1 text-slate-450 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* SUBJECTS TABLE */}
              {activeTab === 'subjects' && (
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-900/50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4 text-center">Code</th>
                      <th className="px-6 py-4 text-center">Sem</th>
                      <th className="px-6 py-4">Faculty Advisor</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {subjects.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          <div>{s.name}</div>
                          <div className="text-xs text-slate-500">{s.department.name}</div>
                        </td>
                        <td className="px-6 py-4 text-center"><span className="bg-slate-900 px-2 py-1 rounded text-xs font-semibold">{s.code}</span></td>
                        <td className="px-6 py-4 text-center font-bold text-slate-300">{s.semester}</td>
                        <td className="px-6 py-4 text-slate-300 font-medium">{s.faculty.user.name}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openModal('subject', 'edit', s)} aria-label={`Edit subject ${s.code}`} className="p-1 text-slate-450 hover:text-blue-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteItem('subject', s.id)} aria-label={`Delete subject ${s.code}`} className="p-1 text-slate-450 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* FACULTY TABLE */}
              {activeTab === 'faculty' && (
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-900/50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Faculty Member</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Designation</th>
                      <th className="px-6 py-4 text-center">Dept</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {faculty.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-900/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{f.user.name}</td>
                        <td className="px-6 py-4 text-slate-455">{f.user.email}</td>
                        <td className="px-6 py-4 text-slate-300">{f.designation}</td>
                        <td className="px-6 py-4 text-center"><span className="bg-slate-900 px-2 py-0.5 rounded text-xs font-semibold">{f.department.code}</span></td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openModal('faculty', 'edit', f)} aria-label={`Edit faculty member ${f.user.name}`} className="p-1 text-slate-450 hover:text-blue-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteItem('faculty', f.id)} aria-label={`Delete faculty member ${f.user.name}`} className="p-1 text-slate-450 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* STUDENTS TABLE */}
              {activeTab === 'students' && (
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-900/50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Student Details</th>
                      <th className="px-6 py-4 text-center">Roll No</th>
                      <th className="px-6 py-4 text-center">Batch</th>
                      <th className="px-6 py-4 text-center">Sec</th>
                      <th className="px-6 py-4">Contacts</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-350">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          <div>{s.user.name}</div>
                          <div className="text-xs text-slate-500">{s.department.name}</div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-xs">{s.rollNo}</td>
                        <td className="px-6 py-4 text-center text-slate-300 font-medium">{s.batchYear}</td>
                        <td className="px-6 py-4 text-center text-slate-300 font-bold">{s.section}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          <div>Mob: {s.mobileNo || 'N/A'}</div>
                          <div>Guard: {s.guardianContact || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openModal('student', 'edit', s)} aria-label={`Edit student ${s.user.name}`} className="p-1 text-slate-450 hover:text-blue-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteItem('student', s.id)} aria-label={`Delete student ${s.user.name}`} className="p-1 text-slate-450 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- INTERACTIVE MODAL COMPONENT --- */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white capitalize">
                {modalAction} {modalType === 'dept' ? 'Department' : modalType}
              </h3>
              <button onClick={() => setModalType(null)} aria-label="Close modal form" className="p-1 text-slate-450 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleModalSubmit} className="space-y-4">
              
              {/* Form 1: Department */}
              {modalType === 'dept' && (
                <>
                  <div className="space-y-1">
                    <label htmlFor="dept-name" className="text-xs font-semibold text-slate-400 uppercase">Department Name</label>
                    <input
                      id="dept-name"
                      type="text"
                      required
                      value={deptForm.name}
                      onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                      placeholder="e.g. Artificial Intelligence and Data Science"
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="dept-code" className="text-xs font-semibold text-slate-400 uppercase">Department Code</label>
                    <input
                      id="dept-code"
                      type="text"
                      required
                      value={deptForm.code}
                      onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                      placeholder="e.g. AIDS"
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Form 2: Subject */}
              {modalType === 'subject' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="sub-name" className="text-xs font-semibold text-slate-400 uppercase">Subject Name</label>
                      <input
                        id="sub-name"
                        type="text"
                        required
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                        placeholder="e.g. Machine Learning"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="sub-code" className="text-xs font-semibold text-slate-400 uppercase">Subject Code</label>
                      <input
                        id="sub-code"
                        type="text"
                        required
                        value={subjectForm.code}
                        onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                        placeholder="e.g. AD401"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="sub-semester" className="text-xs font-semibold text-slate-400 uppercase">Semester</label>
                    <input
                      id="sub-semester"
                      type="number"
                      required
                      min="1"
                      max="8"
                      value={subjectForm.semester}
                      onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                      placeholder="e.g. 4"
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="sub-dept" className="text-xs font-semibold text-slate-400 uppercase">Department</label>
                    <select
                      id="sub-dept"
                      value={subjectForm.departmentId}
                      onChange={(e) => setSubjectForm({ ...subjectForm, departmentId: e.target.value })}
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="sub-fac" className="text-xs font-semibold text-slate-400 uppercase">Assigned Faculty</label>
                    <select
                      id="sub-fac"
                      value={subjectForm.facultyId}
                      onChange={(e) => setSubjectForm({ ...subjectForm, facultyId: e.target.value })}
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      {faculty.map(f => <option key={f.id} value={f.id}>{f.user.name} ({f.designation})</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Form 3: Faculty */}
              {modalType === 'faculty' && (
                <>
                  <div className="space-y-1">
                    <label htmlFor="fac-name" className="text-xs font-semibold text-slate-400 uppercase">Faculty Full Name</label>
                    <input
                      id="fac-name"
                      type="text"
                      required
                      value={facultyForm.name}
                      onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                      placeholder="Dr. Ramesh Kumar"
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="fac-email" className="text-xs font-semibold text-slate-400 uppercase">Email Address</label>
                    <input
                      id="fac-email"
                      type="email"
                      required
                      value={facultyForm.email}
                      onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                      placeholder="ramesh.kumar@velammal.edu.in"
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  {modalAction === 'create' && (
                    <div className="space-y-1">
                      <label htmlFor="fac-pass" className="text-xs font-semibold text-slate-400 uppercase">Access Password</label>
                      <input
                        id="fac-pass"
                        type="password"
                        required
                        value={facultyForm.password}
                        onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="fac-desig" className="text-xs font-semibold text-slate-400 uppercase">Designation</label>
                      <input
                        id="fac-desig"
                        type="text"
                        required
                        value={facultyForm.designation}
                        onChange={(e) => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                        placeholder="Professor & Head"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="fac-dept" className="text-xs font-semibold text-slate-400 uppercase">Department</label>
                      <select
                        id="fac-dept"
                        value={facultyForm.departmentId}
                        onChange={(e) => setFacultyForm({ ...facultyForm, departmentId: e.target.value })}
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      >
                        {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Form 4: Student */}
              {modalType === 'student' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="stud-name" className="text-xs font-semibold text-slate-400 uppercase">Name</label>
                      <input
                        id="stud-name"
                        type="text"
                        required
                        value={studentForm.name}
                        onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                        placeholder="Abishek R"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="stud-email" className="text-xs font-semibold text-slate-400 uppercase">Email</label>
                      <input
                        id="stud-email"
                        type="email"
                        required
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                        placeholder="abishek.r@student.velammal.edu.in"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  {modalAction === 'create' && (
                    <div className="space-y-1">
                      <label htmlFor="stud-pass" className="text-xs font-semibold text-slate-400 uppercase">Access Password</label>
                      <input
                        id="stud-pass"
                        type="password"
                        required
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="stud-roll" className="text-xs font-semibold text-slate-400 uppercase">Roll No</label>
                      <input
                        id="stud-roll"
                        type="text"
                        required
                        value={studentForm.rollNo}
                        onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                        placeholder="2024AIDS002"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="stud-batch" className="text-xs font-semibold text-slate-400 uppercase">Batch</label>
                      <select
                        id="stud-batch"
                        value={studentForm.batchYear}
                        onChange={(e) => setStudentForm({ ...studentForm, batchYear: e.target.value })}
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-sm text-white focus:outline-none"
                      >
                        <option value="2024-28">2024-28</option>
                        <option value="2025-29">2025-29</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="stud-sec" className="text-xs font-semibold text-slate-400 uppercase">Section</label>
                      <select
                        id="stud-sec"
                        value={studentForm.section}
                        onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-sm text-white focus:outline-none"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="stud-mob" className="text-xs font-semibold text-slate-400 uppercase">Mobile No</label>
                      <input
                        id="stud-mob"
                        type="text"
                        value={studentForm.mobileNo}
                        onChange={(e) => setStudentForm({ ...studentForm, mobileNo: e.target.value })}
                        placeholder="9876543220"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="stud-guard" className="text-xs font-semibold text-slate-400 uppercase">Guardian Contact</label>
                      <input
                        id="stud-guard"
                        type="text"
                        value={studentForm.guardianContact}
                        onChange={(e) => setStudentForm({ ...studentForm, guardianContact: e.target.value })}
                        placeholder="9876543221"
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="stud-dept" className="text-xs font-semibold text-slate-400 uppercase">Department</label>
                    <select
                      id="stud-dept"
                      value={studentForm.departmentId}
                      onChange={(e) => setStudentForm({ ...studentForm, departmentId: e.target.value })}
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white focus:outline-none"
                    >
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white shadow-lg"
                >
                  Save Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* VIEW: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-slate-900/40 backdrop-blur-md p-4 rounded-xl border border-slate-800/80">
            {/* Search */}
            <div className="space-y-1">
              <label htmlFor="audit-search" className="text-xs font-semibold text-slate-400 uppercase">Search</label>
              <input
                id="audit-search"
                type="text"
                placeholder="Name, role, route..."
                value={auditFilters.search}
                onChange={(e) => {
                  const newFilters = { ...auditFilters, search: e.target.value, page: 1 };
                  setAuditFilters(newFilters);
                  fetchAuditLogs(newFilters);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            {/* Action */}
            <div className="space-y-1">
              <label htmlFor="audit-action" className="text-xs font-semibold text-slate-400 uppercase">Action</label>
              <select
                id="audit-action"
                value={auditFilters.action}
                onChange={(e) => {
                  const newFilters = { ...auditFilters, action: e.target.value, page: 1 };
                  setAuditFilters(newFilters);
                  fetchAuditLogs(newFilters);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="STUDENT_CREATED">Student Created</option>
                <option value="STUDENT_UPDATED">Student Updated</option>
                <option value="STUDENT_DELETED">Student Deleted</option>
                <option value="FACULTY_CREATED">Faculty Created</option>
                <option value="FACULTY_UPDATED">Faculty Updated</option>
                <option value="FACULTY_DELETED">Faculty Deleted</option>
                <option value="MARK_CREATED">Marks Created</option>
                <option value="MARK_UPDATED">Marks Updated</option>
                <option value="ATTENDANCE_CREATED">Attendance Created</option>
                <option value="ATTENDANCE_UPDATED">Attendance Updated</option>
              </select>
            </div>
            {/* Entity Type */}
            <div className="space-y-1">
              <label htmlFor="audit-entity" className="text-xs font-semibold text-slate-400 uppercase">Entity</label>
              <select
                id="audit-entity"
                value={auditFilters.entityType}
                onChange={(e) => {
                  const newFilters = { ...auditFilters, entityType: e.target.value, page: 1 };
                  setAuditFilters(newFilters);
                  fetchAuditLogs(newFilters);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="">All Entities</option>
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
                <option value="MARK">Mark</option>
                <option value="ATTENDANCE">Attendance</option>
              </select>
            </div>
            {/* Start Date */}
            <div className="space-y-1">
              <label htmlFor="audit-start" className="text-xs font-semibold text-slate-400 uppercase">Start Date</label>
              <input
                id="audit-start"
                type="date"
                value={auditFilters.startDate}
                onChange={(e) => {
                  const newFilters = { ...auditFilters, startDate: e.target.value, page: 1 };
                  setAuditFilters(newFilters);
                  fetchAuditLogs(newFilters);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            {/* End Date */}
            <div className="space-y-1">
              <label htmlFor="audit-end" className="text-xs font-semibold text-slate-400 uppercase">End Date</label>
              <input
                id="audit-end"
                type="date"
                value={auditFilters.endDate}
                onChange={(e) => {
                  const newFilters = { ...auditFilters, endDate: e.target.value, page: 1 };
                  setAuditFilters(newFilters);
                  fetchAuditLogs(newFilters);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            {/* Reset */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  const resetFilters = { page: 1, limit: 25, action: '', entityType: '', startDate: '', endDate: '', search: '' };
                  setAuditFilters(resetFilters);
                  fetchAuditLogs(resetFilters);
                }}
                className="w-full text-center px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            {loadingAudit ? (
              <TableSkeleton />
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No audit logs found matching criteria.</div>
            ) : (
              <table className="w-full border-collapse text-left text-sm text-slate-400">
                <thead className="bg-[#0b121e] font-semibold text-slate-200 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Actor</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Target Entity</th>
                    <th className="px-6 py-4">Summary</th>
                    <th className="px-6 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map((log) => {
                    const getSummary = () => {
                      const actorName = log.actorUser?.name || 'System';
                      if (log.action.includes('CREATED')) {
                        return `${actorName} created a new ${log.entityType.toLowerCase()} record`;
                      }
                      if (log.action.includes('DELETED')) {
                        return `${actorName} deleted a ${log.entityType.toLowerCase()} record`;
                      }
                      if (log.action.includes('UPDATED')) {
                        const keys = log.newValue ? Object.keys(log.newValue) : [];
                        return `${actorName} modified ${log.entityType.toLowerCase()} fields: ${keys.join(', ')}`;
                      }
                      return `Action performed by ${actorName}`;
                    };

                    return (
                      <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-550">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-200">
                          <div>{log.actorUser?.name || 'System'}</div>
                          <div className="text-[10px] text-slate-500">{log.actorRole}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            log.action.includes('CREATED') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            log.action.includes('UPDATED') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          <span className="text-slate-350">{log.entityType}</span>
                          {log.entityId && <span className="block text-[10px] text-slate-500">{log.entityId}</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300 max-w-xs truncate">
                          {getSummary()}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditLog(log)}
                            className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                          >
                            Inspect JSON
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {auditPagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-500">
                Page {auditPagination.page} of {auditPagination.totalPages} (Total {auditPagination.total} logs)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={auditPagination.page === 1 || loadingAudit}
                  onClick={() => {
                    const newFilters = { ...auditFilters, page: auditPagination.page - 1 };
                    setAuditFilters(newFilters);
                    fetchAuditLogs(newFilters);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={auditPagination.page === auditPagination.totalPages || loadingAudit}
                  onClick={() => {
                    const newFilters = { ...auditFilters, page: auditPagination.page + 1 };
                    setAuditFilters(newFilters);
                    fetchAuditLogs(newFilters);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AUDIT DETAILS EXPANSION MODAL */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0b1323] p-6 text-slate-350 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Audit Record Details</h3>
                <p className="text-[10px] text-slate-500 font-medium font-mono">Log Identifier: {selectedAuditLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedAuditLog(null)} 
                type="button" 
                aria-label="Close modal dialog"
                className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-900 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4 text-xs bg-[#090e18] p-4 rounded-xl border border-slate-900">
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Actor User</span>
                  <span className="text-slate-200 font-semibold">{selectedAuditLog.actorUser?.name || 'System'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Actor Role</span>
                  <span className="text-slate-200 font-semibold">{selectedAuditLog.actorRole}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Action Performed</span>
                  <span className="text-slate-200 font-semibold">{selectedAuditLog.action}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Timestamp</span>
                  <span className="text-slate-200 font-semibold">{new Date(selectedAuditLog.timestamp).toLocaleString()}</span>
                </div>
                <div className="col-span-2 border-t border-slate-800/60 pt-2">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">HTTP Context</span>
                  <span className="text-slate-200 font-mono font-semibold">
                    {selectedAuditLog.httpMethod} {selectedAuditLog.apiRoute || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold mb-2 uppercase font-mono">Previous State</span>
                  <pre className="text-[10px] bg-[#070b13] p-4 rounded-xl border border-slate-900 overflow-x-auto text-amber-500 font-mono max-h-60 overflow-y-auto">
                    {JSON.stringify(selectedAuditLog.previousValue, null, 2) || 'null'}
                  </pre>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold mb-2 uppercase font-mono">New State</span>
                  <pre className="text-[10px] bg-[#070b13] p-4 rounded-xl border border-slate-900 overflow-x-auto text-emerald-500 font-mono max-h-60 overflow-y-auto">
                    {JSON.stringify(selectedAuditLog.newValue, null, 2) || 'null'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Toast Notification popup */}
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
};

export default AdminDashboard;
