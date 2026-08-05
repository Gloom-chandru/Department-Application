import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Calendar, PlusCircle, Trash2, Loader2, AlertCircle, X, CheckCircle, ExternalLink 
} from 'lucide-react';
import Toast from '../components/Toast';

const StudentRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [requestType, setRequestType] = useState('LEAVE');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reviewerFacultyId, setReviewerFacultyId] = useState('');
  const [documentFile, setDocumentFile] = useState(null);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqsRes, revsRes] = await Promise.all([
        api.get('/requests'),
        api.get('/requests/reviewers')
      ]);
      setRequests(reqsRes.data);
      setReviewers(revsRes.data);
      if (revsRes.data.length > 0) {
        setReviewerFacultyId(revsRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage('Failed to fetch requests or reviewers from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelRequest = async (id) => {
    try {
      const confirmCancel = window.confirm('Are you sure you want to cancel this pending request?');
      if (!confirmCancel) return;

      await api.patch(`/requests/${id}/cancel`);
      setToastType('success');
      setToastMessage('Request cancelled successfully.');
      fetchData();
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Failed to cancel request.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason || reason.length < 10) {
      setToastType('error');
      setToastMessage('Reason must be at least 10 characters.');
      return;
    }
    if (!startDate || !endDate) {
      setToastType('error');
      setToastMessage('Please select valid start and end dates.');
      return;
    }
    if (startDate > endDate) {
      setToastType('error');
      setToastMessage('Start date cannot be after end date.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('requestType', requestType);
      formData.append('reason', reason);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('reviewerFacultyId', reviewerFacultyId);
      if (documentFile) {
        formData.append('document', documentFile);
      }

      await api.post('/requests', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setToastType('success');
      setToastMessage('Request submitted successfully.');
      setShowModal(false);
      // Reset form
      setReason('');
      setStartDate('');
      setEndDate('');
      setDocumentFile(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
      case 'REJECTED':
        return 'bg-red-500/10 border-red-500/25 text-red-400';
      case 'CANCELLED':
        return 'bg-slate-500/10 border-slate-500/25 text-text-muted';
      default:
        return 'bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse';
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-app pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-main mb-1">
            Leave & On-Duty Requests
          </h1>
          <p className="text-text-muted text-sm">
            Submit request absences, upload medical certificates/event letters, and track approvals.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-text-main font-medium transition-colors text-sm shadow-lg shadow-blue-900/20"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Absence Request</span>
        </button>
      </div>

      {/* REQUESTS HISTORY */}
      <div className="backdrop-blur-md bg-bg-card/30 border border-border-app rounded-2xl p-6">
        <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          My Absence History
        </h2>

        <div className="overflow-x-auto rounded-xl border border-border-app/80">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-bg-card/50 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Date Range</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Reviewer / Remarks</th>
                <th className="px-6 py-4">Document</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-text-main">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-bg-card/10 transition-colors">
                  <td className="px-6 py-4 font-semibold text-text-main">
                    {req.requestType}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-100">
                    {formatDate(req.startDate)} to {formatDate(req.endDate)}
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate" title={req.reason}>
                    {req.reason}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-text-main">Prof. {req.reviewerFaculty.user.name}</div>
                    {req.approvalHistory.length > 1 && (
                      <div className="text-xs text-text-muted italic">
                        "{req.approvalHistory[req.approvalHistory.length - 1].remarks}"
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {req.attachmentPath ? (
                      <a
                        href={`${api.defaults.baseURL}/requests/${req.id}/document`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="max-w-[100px] truncate">{req.originalDocumentName}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {req.status === 'PENDING' ? (
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Cancel Pending Request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-text-muted">
                    No requests submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0f172a] border border-border-app rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-border-app pb-4">
              <h3 className="text-xl font-bold text-text-main">Create Absence Request</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-text-muted mb-1.5">Request Type</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-bg-card border border-border-app rounded-xl text-text-main focus:outline-none focus:border-blue-500"
                >
                  <option value="LEAVE">Leave (Absenteeism)</option>
                  <option value="OD">On-Duty (OD Event Representing)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-bg-card border border-border-app rounded-xl text-text-main focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-bg-card border border-border-app rounded-xl text-text-main focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-text-muted mb-1.5">Department Reviewer</label>
                <select
                  value={reviewerFacultyId}
                  onChange={(e) => setReviewerFacultyId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-bg-card border border-border-app rounded-xl text-text-main focus:outline-none focus:border-blue-500"
                >
                  {reviewers.map(rev => (
                    <option key={rev.id} value={rev.id}>
                      Prof. {rev.name} ({rev.designation})
                    </option>
                  ))}
                  {reviewers.length === 0 && (
                    <option value="">No Faculty reviewers found in your department.</option>
                  )}
                </select>
                <p className="text-[10px] text-text-muted mt-1 italic">
                  Temporary reviewer-selection policy: limited to your department faculty.
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-text-muted mb-1.5">Reason for Absence</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Explain the reason for absence (minimum 10 chars)..."
                  className="w-full h-24 px-3 py-2.5 bg-bg-card border border-border-app rounded-xl text-text-main focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-text-muted mb-1.5">Supporting Attachment (Optional)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setDocumentFile(e.target.files[0])}
                  className="w-full text-text-muted text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-bg-sidebar file:text-text-main file:cursor-pointer hover:file:bg-bg-input"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Accepts PDF, PNG, JPG/JPEG files up to 5MB.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-app text-text-main hover:bg-bg-sidebar transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-text-main transition-colors text-sm font-semibold shadow-lg shadow-blue-900/20"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert Popups */}
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
};

export default StudentRequests;
