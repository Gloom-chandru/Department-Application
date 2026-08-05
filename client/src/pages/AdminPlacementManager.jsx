import React, { useEffect, useState } from 'react';
import {
  Briefcase, Loader2, Plus, Building2, BarChart3, Users, Download, Upload
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../utils/api';
import Toast from '../components/Toast';
import { StageBadge } from '../components/ApplicationStageTimeline';
import BulkUploadDropzone from '../components/BulkUploadDropzone';
import DryRunSummary from '../components/DryRunSummary';
import ValidationErrorTable from '../components/ValidationErrorTable';
import { downloadBlob } from '../utils/downloadHelper';

const STAGES = ['APPLIED', 'SHORTLISTED', 'APTITUDE', 'TECHNICAL', 'HR', 'SELECTED', 'REJECTED', 'WITHDRAWN'];

export default function AdminPlacementManager() {
  const [tab, setTab] = useState('analytics');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [offers, setOffers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byCompany, setByCompany] = useState([]);
  const [byDept, setByDept] = useState([]);
  const [byBatch, setByBatch] = useState([]);
  const [packages, setPackages] = useState(null);

  const [companyForm, setCompanyForm] = useState({ name: '', code: '', industry: '' });
  const [driveForm, setDriveForm] = useState({
    companyId: '',
    title: '',
    description: '',
    location: '',
    packageCtc: '',
    applicationDeadline: '',
    minCgpa: '',
    maxBacklogs: '0',
    departmentIds: [],
    batchYears: ''
  });
  const [selectedDriveApps, setSelectedDriveApps] = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [eligStudentId, setEligStudentId] = useState('');
  const [eligForm, setEligForm] = useState({ cgpa: '', currentBacklogs: '0' });

  const [importType, setImportType] = useState('placement-eligibility');
  const [dryRun, setDryRun] = useState(null);
  const [importFile, setImportFile] = useState(null);

  const showToast = (message, type = 'info') => setToast({ message, type });

  const loadCore = async () => {
    try {
      setLoading(true);
      const [deptRes, coRes, drRes, sumRes, compRes, deptA, batchA, pkgRes, offRes] = await Promise.all([
        api.get('/admin/departments'),
        api.get('/placement/admin/companies', { params: { limit: 100 } }),
        api.get('/placement/admin/drives', { params: { limit: 50 } }),
        api.get('/placement/admin/analytics/summary'),
        api.get('/placement/admin/analytics/by-company'),
        api.get('/placement/admin/analytics/by-department'),
        api.get('/placement/admin/analytics/by-batch'),
        api.get('/placement/admin/analytics/packages'),
        api.get('/placement/admin/offers', { params: { limit: 50 } })
      ]);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : deptRes.data?.data || []);
      setCompanies(coRes.data.data || []);
      setDrives(drRes.data.data || []);
      setSummary(sumRes.data);
      setByCompany(compRes.data.data || []);
      setByDept(deptA.data.data || []);
      setByBatch(batchA.data.data || []);
      setPackages(pkgRes.data);
      setOffers(offRes.data.data || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load placement admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCore();
  }, []);

  const createCompany = async (e) => {
    e.preventDefault();
    try {
      await api.post('/placement/admin/companies', companyForm);
      showToast('Company created', 'success');
      setCompanyForm({ name: '', code: '', industry: '' });
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Create failed', 'error');
    }
  };

  const createDrive = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        companyId: driveForm.companyId,
        title: driveForm.title,
        description: driveForm.description,
        location: driveForm.location,
        packageCtc: driveForm.packageCtc ? Number(driveForm.packageCtc) : null,
        applicationDeadline: new Date(driveForm.applicationDeadline).toISOString(),
        minCgpa: driveForm.minCgpa !== '' ? Number(driveForm.minCgpa) : null,
        maxBacklogs: driveForm.maxBacklogs !== '' ? Number(driveForm.maxBacklogs) : null,
        departmentIds: driveForm.departmentIds,
        batchYears: driveForm.batchYears.split(',').map((b) => b.trim()).filter(Boolean)
      };
      await api.post('/placement/admin/drives', payload);
      showToast('Drive created (DRAFT)', 'success');
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Drive create failed', 'error');
    }
  };

  const publishDrive = async (id) => {
    try {
      await api.post(`/placement/admin/drives/${id}/publish`);
      showToast('Drive published', 'success');
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Publish failed', 'error');
    }
  };

  const closeDrive = async (id) => {
    try {
      await api.post(`/placement/admin/drives/${id}/close`);
      showToast('Drive closed', 'success');
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Close failed', 'error');
    }
  };

  const loadApps = async (driveId) => {
    setSelectedDriveId(driveId);
    try {
      const res = await api.get(`/placement/admin/drives/${driveId}/applications`, { params: { limit: 100 } });
      setSelectedDriveApps(res.data.data || []);
      setTab('applications');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load applications', 'error');
    }
  };

  const changeStage = async (appId, toStage) => {
    try {
      await api.patch(`/placement/admin/applications/${appId}/stage`, { toStage });
      showToast(`Stage → ${toStage}`, 'success');
      if (selectedDriveId) await loadApps(selectedDriveId);
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Stage change failed', 'error');
    }
  };

  const createOffer = async (appId) => {
    const ctc = window.prompt('Enter CTC (LPA):');
    if (!ctc) return;
    try {
      await api.post(`/placement/admin/applications/${appId}/offer`, { ctc: Number(ctc) });
      showToast('Offer created', 'success');
      if (selectedDriveId) await loadApps(selectedDriveId);
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Offer create failed', 'error');
    }
  };

  const updateEligibility = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/placement/admin/students/${eligStudentId}/academic-eligibility`, {
        cgpa: eligForm.cgpa !== '' ? Number(eligForm.cgpa) : null,
        currentBacklogs: Number(eligForm.currentBacklogs || 0)
      });
      showToast('Student eligibility updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    }
  };

  const downloadTemplate = async () => {
    const map = {
      'placement-eligibility': '/bulk/templates/placement-eligibility',
      companies: '/bulk/templates/companies',
      offers: '/bulk/templates/offers'
    };
    const res = await api.get(map[importType], { responseType: 'blob' });
    downloadBlob(res.data, `${importType}_template.xlsx`);
  };

  const runDryRun = async (file) => {
    setImportFile(file);
    const fd = new FormData();
    fd.append('file', file);
    const map = {
      'placement-eligibility': '/bulk/import/placement-eligibility/dry-run',
      companies: '/bulk/import/companies/dry-run',
      offers: '/bulk/import/offers/dry-run'
    };
    try {
      const res = await api.post(map[importType], fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDryRun(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Dry-run failed', 'error');
    }
  };

  const confirmImport = async () => {
    if (!dryRun?.token || !importFile) return;
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('token', dryRun.token);
    const map = {
      'placement-eligibility': '/bulk/import/placement-eligibility/confirm',
      companies: '/bulk/import/companies/confirm',
      offers: '/bulk/import/offers/confirm'
    };
    try {
      const res = await api.post(map[importType], fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast(res.data.message || 'Import confirmed', 'success');
      setDryRun(null);
      setImportFile(null);
      await loadCore();
    } catch (err) {
      showToast(err.response?.data?.message || 'Confirm failed', 'error');
    }
  };

  const exportData = async (kind) => {
    const map = {
      applications: '/bulk/export/placement-applications',
      offers: '/bulk/export/placement-offers',
      roster: '/bulk/export/placement-roster'
    };
    const res = await api.get(map[kind], { params: { format: 'xlsx' }, responseType: 'blob' });
    downloadBlob(res.data, `placement_${kind}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'drives', label: 'Drives', icon: Briefcase },
    { id: 'applications', label: 'Applications', icon: Users },
    { id: 'eligibility', label: 'Eligibility', icon: Users },
    { id: 'import', label: 'Import/Export', icon: Upload }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-main">
          <Briefcase className="h-7 w-7 text-blue-500" />
          Placement Management
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Companies, drives, applications, offers, analytics, and bulk import/export.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border-app pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
              tab === t.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && summary && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Cohort', value: summary.cohortSize },
              { label: 'Placed', value: summary.placed },
              { label: 'Placement %', value: `${summary.placementPercent}%` },
              { label: 'Applications', value: summary.applications }
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-border-app bg-bg-card/40 p-4">
                <div className="text-[11px] uppercase text-text-muted">{c.label}</div>
                <div className="mt-1 text-2xl font-semibold text-text-main">{c.value}</div>
              </div>
            ))}
          </div>

          {packages && (
            <div className="rounded-2xl border border-border-app bg-bg-card/40 p-5">
              <h3 className="text-sm font-semibold text-text-main mb-3">Package stats (accepted offers)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                {[
                  ['Highest', packages.highest],
                  ['Average', packages.avg],
                  ['Median', packages.median],
                  ['Lowest', packages.lowest],
                  ['Accepted', packages.acceptedCount]
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border-app p-3">
                    <div className="text-text-muted">{k}</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-400">{v ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border-app bg-bg-card/40 p-5 h-72">
              <h3 className="text-sm font-semibold text-text-main mb-3">By department</h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={byDept}>
                  <XAxis dataKey="code" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="placementPercent" fill="#3b82f6" name="Placement %" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-border-app bg-bg-card/40 p-5 h-72">
              <h3 className="text-sm font-semibold text-text-main mb-3">By batch</h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={byBatch}>
                  <XAxis dataKey="batchYear" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="placed" fill="#10b981" name="Placed" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border-app bg-bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-text-main mb-3">Company-wise selections</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="text-text-muted">
                  <tr>
                    <th className="py-2 pr-4">Company</th>
                    <th className="py-2 pr-4">Selected</th>
                    <th className="py-2 pr-4">Accepted</th>
                    <th className="py-2">Avg CTC</th>
                  </tr>
                </thead>
                <tbody>
                  {byCompany.map((c) => (
                    <tr key={c.companyId} className="border-t border-border-app">
                      <td className="py-2 pr-4 text-text-main">{c.companyName}</td>
                      <td className="py-2 pr-4 text-text-main">{c.selectedApplications}</td>
                      <td className="py-2 pr-4 text-text-main">{c.acceptedOffers}</td>
                      <td className="py-2 text-emerald-400">{c.avgCtc != null ? Number(c.avgCtc).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'companies' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createCompany} className="rounded-2xl border border-border-app bg-bg-card/40 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <Plus className="h-4 w-4" /> New company
            </h3>
            <input
              required
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              placeholder="Name"
              className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              value={companyForm.code}
              onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
              placeholder="Code (optional)"
              className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              value={companyForm.industry}
              onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
              placeholder="Industry"
              className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-text-main hover:bg-blue-500">
              Create
            </button>
          </form>
          <div className="rounded-2xl border border-border-app bg-bg-card/40 p-5 space-y-2 max-h-96 overflow-y-auto">
            {companies.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 border-b border-border-app/60 py-2 text-xs">
                <div>
                  <div className="font-semibold text-text-main">{c.name}</div>
                  <div className="text-text-muted">{c.code || '—'} · {c.industry || '—'}</div>
                </div>
                <span className={c.isActive ? 'text-emerald-400' : 'text-text-muted'}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'drives' && (
        <div className="space-y-6">
          <form onSubmit={createDrive} className="rounded-2xl border border-border-app bg-bg-card/40 p-5 grid gap-3 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold text-text-main">Create drive (DRAFT)</h3>
            <select
              required
              value={driveForm.companyId}
              onChange={(e) => setDriveForm({ ...driveForm, companyId: e.target.value })}
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            >
              <option value="">Select company</option>
              {companies.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              required
              value={driveForm.title}
              onChange={(e) => setDriveForm({ ...driveForm, title: e.target.value })}
              placeholder="Job role / title"
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              required
              value={driveForm.location}
              onChange={(e) => setDriveForm({ ...driveForm, location: e.target.value })}
              placeholder="Location"
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              type="datetime-local"
              required
              value={driveForm.applicationDeadline}
              onChange={(e) => setDriveForm({ ...driveForm, applicationDeadline: e.target.value })}
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              value={driveForm.packageCtc}
              onChange={(e) => setDriveForm({ ...driveForm, packageCtc: e.target.value })}
              placeholder="CTC (LPA)"
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              value={driveForm.minCgpa}
              onChange={(e) => setDriveForm({ ...driveForm, minCgpa: e.target.value })}
              placeholder="Min CGPA"
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              value={driveForm.maxBacklogs}
              onChange={(e) => setDriveForm({ ...driveForm, maxBacklogs: e.target.value })}
              placeholder="Max backlogs"
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <input
              required
              value={driveForm.batchYears}
              onChange={(e) => setDriveForm({ ...driveForm, batchYears: e.target.value })}
              placeholder="Batch years (comma-separated)"
              className="rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <div className="sm:col-span-2">
              <div className="text-[11px] text-text-muted mb-1">Eligible departments</div>
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => {
                  const checked = driveForm.departmentIds.includes(d.id);
                  return (
                    <label key={d.id} className="inline-flex items-center gap-1.5 text-xs text-text-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setDriveForm({
                            ...driveForm,
                            departmentIds: checked
                              ? driveForm.departmentIds.filter((id) => id !== d.id)
                              : [...driveForm.departmentIds, d.id]
                          });
                        }}
                      />
                      {d.code}
                    </label>
                  );
                })}
              </div>
            </div>
            <textarea
              required
              value={driveForm.description}
              onChange={(e) => setDriveForm({ ...driveForm, description: e.target.value })}
              placeholder="Description"
              rows={3}
              className="sm:col-span-2 rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-text-main hover:bg-blue-500">
              Create draft
            </button>
          </form>

          <div className="space-y-3">
            {drives.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border-app bg-bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-main">{d.title}</div>
                  <div className="text-xs text-text-muted">
                    {d.company?.name} · {d.status} · Apps: {d._count?.applications ?? 0}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.status === 'DRAFT' && (
                    <button type="button" onClick={() => publishDrive(d.id)} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-text-main">
                      Publish
                    </button>
                  )}
                  {d.status === 'PUBLISHED' && (
                    <button type="button" onClick={() => closeDrive(d.id)} className="rounded-xl border border-amber-700/40 px-3 py-1.5 text-xs text-amber-300">
                      Close
                    </button>
                  )}
                  <button type="button" onClick={() => loadApps(d.id)} className="rounded-xl border border-border-card px-3 py-1.5 text-xs text-text-main">
                    Applications
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            {selectedDriveId ? `Applications for drive ${selectedDriveId}` : 'Select a drive from the Drives tab to load applications.'}
          </p>
          {selectedDriveApps.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border-app bg-bg-card/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-text-main">{a.student?.user?.name} ({a.student?.rollNo})</div>
                  <div className="text-xs text-text-muted">{a.student?.department?.code} · CGPA {a.student?.cgpa ?? '—'}</div>
                </div>
                <StageBadge stage={a.stage} />
              </div>
              <div className="flex flex-wrap gap-2">
                {STAGES.filter((s) => s !== a.stage).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeStage(a.id, s)}
                    className="rounded-lg border border-border-app px-2 py-1 text-[10px] text-text-muted hover:text-blue-300"
                  >
                    → {s}
                  </button>
                ))}
                {!a.offer && (
                  <button
                    type="button"
                    onClick={() => createOffer(a.id)}
                    className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300"
                  >
                    Create offer
                  </button>
                )}
              </div>
            </div>
          ))}
          {selectedDriveId && selectedDriveApps.length === 0 && (
            <p className="text-sm text-text-muted">No applications for this drive.</p>
          )}
          {offers.length > 0 && (
            <div className="rounded-2xl border border-border-app bg-bg-card/40 p-4">
              <h3 className="text-sm font-semibold text-text-main mb-3">Recent offers</h3>
              {offers.slice(0, 10).map((o) => (
                <div key={o.id} className="flex justify-between border-b border-border-card/50 py-2 text-xs">
                  <span className="text-text-main">{o.student?.user?.name} · {o.company?.name}</span>
                  <span className="text-emerald-400">{o.ctc} LPA · {o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'eligibility' && (
        <form onSubmit={updateEligibility} className="rounded-2xl border border-border-app bg-bg-card/40 p-5 space-y-3 max-w-lg">
          <h3 className="text-sm font-semibold text-text-main">Update student CGPA / backlogs</h3>
          <p className="text-xs text-text-muted">CGPA is never derived from marks. Use student UUID from admin student list.</p>
          <input
            required
            value={eligStudentId}
            onChange={(e) => setEligStudentId(e.target.value)}
            placeholder="Student ID (UUID)"
            className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
          />
          <input
            value={eligForm.cgpa}
            onChange={(e) => setEligForm({ ...eligForm, cgpa: e.target.value })}
            placeholder="CGPA"
            className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
          />
          <input
            value={eligForm.currentBacklogs}
            onChange={(e) => setEligForm({ ...eligForm, currentBacklogs: e.target.value })}
            placeholder="Current backlogs"
            className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
          />
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-text-main">
            Save
          </button>
        </form>
      )}

      {tab === 'import' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {['placement-eligibility', 'companies', 'offers'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setImportType(t); setDryRun(null); setImportFile(null); }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  importType === t ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-border-card px-3 py-2 text-xs text-text-main"
          >
            <Download className="h-3.5 w-3.5" /> Download template
          </button>
          <BulkUploadDropzone
            selectedFile={importFile}
            onFileSelect={runDryRun}
            onFileClear={() => { setImportFile(null); setDryRun(null); }}
          />
          {dryRun && (
            <div className="space-y-4">
              <DryRunSummary
                summary={dryRun.summary}
                valid={dryRun.valid}
                expiresAt={Date.now() + 15 * 60 * 1000}
                importType={importType}
                onTokenExpire={() => setDryRun(null)}
              />
              {dryRun.errors?.length > 0 && <ValidationErrorTable errors={dryRun.errors} />}
              {dryRun.valid && (
                <button
                  type="button"
                  onClick={confirmImport}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-text-main"
                >
                  Confirm import
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {['applications', 'offers', 'roster'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => exportData(k)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300"
              >
                <Download className="h-3.5 w-3.5" /> Export {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {toast.message && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      )}
    </div>
  );
}
