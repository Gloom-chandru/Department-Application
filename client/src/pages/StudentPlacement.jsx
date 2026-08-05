import React, { useEffect, useState } from 'react';
import { Briefcase, Loader2, Upload, FileText } from 'lucide-react';
import api from '../utils/api';
import Toast from '../components/Toast';
import EligibilityReasonsPanel from '../components/EligibilityReasonsPanel';
import ApplicationStageTimeline, { StageBadge } from '../components/ApplicationStageTimeline';
import OfferActionsCard from '../components/OfferActionsCard';

export default function StudentPlacement() {
  const [tab, setTab] = useState('drives');
  const [profile, setProfile] = useState(null);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [skills, setSkills] = useState('');
  const [bio, setBio] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [p, d, a, o] = await Promise.all([
        api.get('/placement/student/profile'),
        api.get('/placement/student/drives'),
        api.get('/placement/student/applications'),
        api.get('/placement/student/offers')
      ]);
      setProfile(p.data);
      setSkills(p.data.profile?.skills || '');
      setBio(p.data.profile?.bio || '');
      setDrives(d.data.data || []);
      setApplications(a.data.data || []);
      setOffers(o.data.data || []);
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Failed to load placement data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveProfile = async () => {
    try {
      setBusy(true);
      await api.put('/placement/student/profile', { skills, bio });
      setToast({ message: 'Profile updated', type: 'success' });
      await loadAll();
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Update failed', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const uploadResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append('resume', file);
      await api.post('/placement/student/profile/resume', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setToast({ message: 'Resume uploaded', type: 'success' });
      await loadAll();
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Resume upload failed', type: 'error' });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const apply = async (driveId) => {
    try {
      setBusy(true);
      await api.post(`/placement/student/drives/${driveId}/apply`);
      setToast({ message: 'Application submitted', type: 'success' });
      setSelectedDrive(null);
      await loadAll();
    } catch (err) {
      setToast({
        message: err.response?.data?.message || 'Apply failed',
        type: 'error'
      });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (appId) => {
    try {
      setBusy(true);
      await api.post(`/placement/student/applications/${appId}/withdraw`);
      setToast({ message: 'Application withdrawn', type: 'success' });
      await loadAll();
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Withdraw failed', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const student = profile?.student;
  const p = profile?.profile;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-main">
            <Briefcase className="h-7 w-7 text-blue-500" />
            Placement Portal
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage your career profile, apply to drives, and track offers.
          </p>
        </div>
        <div className="rounded-2xl border border-border-app bg-bg-card/40 px-4 py-3 text-xs">
          <div className="text-text-muted">Status</div>
          <div className={`text-sm font-semibold ${p?.placementStatus === 'PLACED' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {p?.placementStatus || 'UNPLACED'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'CGPA', value: student?.cgpa ?? 'Not set' },
          { label: 'Backlogs', value: student?.currentBacklogs ?? 0 },
          { label: 'Applications', value: applications.length },
          { label: 'Offers', value: offers.length }
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border-app bg-bg-card/40 p-4">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">{c.label}</div>
            <div className="mt-1 text-xl font-semibold text-text-main">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border-app pb-2">
        {['drives', 'applications', 'offers', 'profile'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize ${
              tab === t
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="rounded-2xl border border-border-app bg-bg-card/40 p-6 space-y-4">
          <p className="text-xs text-text-muted">
            CGPA and backlogs are set by admin. Upload a resume to apply for drives.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-text-main hover:bg-blue-500">
              <Upload className="h-3.5 w-3.5" />
              Upload Resume (PDF/DOCX)
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={uploadResume} />
            </label>
            {p?.hasResume && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <FileText className="h-3.5 w-3.5" />
                {p.originalResumeName || 'Resume on file'}
              </span>
            )}
          </div>
          <textarea
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Skills (comma-separated)"
            className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            rows={2}
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio"
            className="w-full rounded-xl border border-border-app bg-bg-app px-3.5 py-2.5 text-xs text-text-main"
            rows={3}
          />
          <button
            type="button"
            disabled={busy}
            onClick={saveProfile}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-text-main hover:bg-blue-500 disabled:opacity-50"
          >
            Save Profile
          </button>
        </div>
      )}

      {tab === 'drives' && (
        <div className="space-y-3">
          {drives.length === 0 && <p className="text-sm text-text-muted">No published drives yet.</p>}
          {drives.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border-app bg-bg-card/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-main">{d.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {d.company?.name} · {d.location}
                    {d.packageCtc != null ? ` · CTC ${d.packageCtc} LPA` : ''}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Deadline: {new Date(d.applicationDeadline).toLocaleString()} · {d.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    d.eligible
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                  }`}>
                    {d.eligible ? 'Eligible' : 'Not eligible'}
                  </span>
                  {d.application ? (
                    <StageBadge stage={d.application.stage} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedDrive(d)}
                      className="rounded-xl border border-border-card px-3 py-1.5 text-xs text-text-main hover:border-blue-500/40 hover:text-blue-300"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'applications' && (
        <div className="space-y-4">
          {applications.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border-app bg-bg-card/40 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-main">{a.drive?.title}</h3>
                  <p className="text-xs text-text-muted">{a.drive?.company?.name}</p>
                </div>
                <StageBadge stage={a.stage} />
              </div>
              <ApplicationStageTimeline history={a.stageHistory || []} />
              {['APPLIED', 'SHORTLISTED', 'APTITUDE', 'TECHNICAL', 'HR'].includes(a.stage) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => withdraw(a.id)}
                  className="rounded-xl border border-rose-900/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/20"
                >
                  Withdraw
                </button>
              )}
            </div>
          ))}
          {applications.length === 0 && <p className="text-sm text-text-muted">No applications yet.</p>}
        </div>
      )}

      {tab === 'offers' && (
        <div className="space-y-3">
          {offers.map((o) => (
            <OfferActionsCard key={o.id} offer={o} onUpdated={() => loadAll()} />
          ))}
          {offers.length === 0 && <p className="text-sm text-text-muted">No offers yet.</p>}
        </div>
      )}

      {selectedDrive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-sidebar/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border-card bg-bg-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-text-main">{selectedDrive.title}</h3>
            <p className="text-sm text-text-muted">{selectedDrive.description}</p>
            <EligibilityReasonsPanel reasons={selectedDrive.reasons} eligible={selectedDrive.eligible} />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSelectedDrive(null)}
                className="rounded-xl border border-border-card px-3 py-2 text-xs text-text-main"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busy || !selectedDrive.eligible || selectedDrive.application}
                onClick={() => apply(selectedDrive.id)}
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-text-main hover:bg-blue-500 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.message && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      )}
    </div>
  );
}
