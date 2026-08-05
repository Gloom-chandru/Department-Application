import React, { useEffect, useState } from 'react';
import { Briefcase, Loader2 } from 'lucide-react';
import api from '../utils/api';
import Toast from '../components/Toast';

export default function FacultyPlacementView() {
  const [drives, setDrives] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [batchYear, setBatchYear] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (batchYear) params.batchYear = batchYear;
      const [d, s] = await Promise.all([
        api.get('/placement/faculty/drives'),
        api.get('/placement/faculty/students', { params: { ...params, limit: 50 } })
      ]);
      setDrives(d.data.data || []);
      setStudents(s.data.data || []);
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Failed to load placement data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [batchYear]);

  const openSummary = async (driveId) => {
    try {
      const res = await api.get(`/placement/faculty/drives/${driveId}/summary`);
      setSummary(res.data);
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Failed to load summary', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const placed = students.filter((s) => s.placementStatus === 'PLACED').length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-main">
          <Briefcase className="h-7 w-7 text-amber-500" />
          Department Placement Overview
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Read-only view of drives and student placement status for your department. Resumes and individual CTC are hidden.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-app bg-bg-card/40 p-4">
          <div className="text-[11px] uppercase text-text-muted">Active drives</div>
          <div className="mt-1 text-2xl font-semibold text-text-main">{drives.length}</div>
        </div>
        <div className="rounded-2xl border border-border-app bg-bg-card/40 p-4">
          <div className="text-[11px] uppercase text-text-muted">Students (page)</div>
          <div className="mt-1 text-2xl font-semibold text-text-main">{students.length}</div>
        </div>
        <div className="rounded-2xl border border-border-app bg-bg-card/40 p-4">
          <div className="text-[11px] uppercase text-text-muted">Placed (page)</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">{placed}</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-main">Drives</h2>
        {drives.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => openSummary(d.id)}
            className="w-full text-left rounded-2xl border border-border-app bg-bg-card/40 p-4 hover:border-border-card transition-colors"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text-main">{d.title}</div>
                <div className="text-xs text-text-muted">{d.company?.name} · {d.status}</div>
              </div>
              <div className="text-xs text-text-muted">
                Apps: {d.applicationCount}
              </div>
            </div>
          </button>
        ))}
        {drives.length === 0 && <p className="text-sm text-text-muted">No drives for your department.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-main">Students</h2>
          <input
            value={batchYear}
            onChange={(e) => setBatchYear(e.target.value)}
            placeholder="Filter batch e.g. 2024-2028"
            className="rounded-xl border border-border-app bg-bg-app px-3 py-2 text-xs text-text-main"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border-app">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-bg-card/80 text-text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Roll No</th>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Batch</th>
                <th className="px-3 py-2.5 font-medium">CGPA</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Apps</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-border-app/80">
                  <td className="px-3 py-2.5 text-text-main">{s.rollNo}</td>
                  <td className="px-3 py-2.5 text-text-main">{s.name}</td>
                  <td className="px-3 py-2.5 text-text-muted">{s.batchYear}</td>
                  <td className="px-3 py-2.5 text-text-main">{s.cgpa ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={s.placementStatus === 'PLACED' ? 'text-emerald-400' : 'text-amber-400'}>
                      {s.placementStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{s.applicationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-sidebar/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-card bg-bg-card p-6 space-y-3">
            <h3 className="text-lg font-semibold text-text-main">{summary.title}</h3>
            <p className="text-xs text-text-muted">{summary.company?.name}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border-app p-3">
                <div className="text-[10px] text-text-muted">Cohort</div>
                <div className="text-lg font-semibold text-text-main">{summary.counts?.cohort}</div>
              </div>
              <div className="rounded-xl border border-border-app p-3">
                <div className="text-[10px] text-text-muted">Applied</div>
                <div className="text-lg font-semibold text-text-main">{summary.counts?.applied}</div>
              </div>
              <div className="rounded-xl border border-border-app p-3">
                <div className="text-[10px] text-text-muted">Selected</div>
                <div className="text-lg font-semibold text-emerald-400">{summary.counts?.selected}</div>
              </div>
            </div>
            <p className="text-[11px] text-text-muted">Package details are not shown to faculty.</p>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="w-full rounded-xl border border-border-card py-2 text-xs text-text-main"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {toast.message && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      )}
    </div>
  );
}
