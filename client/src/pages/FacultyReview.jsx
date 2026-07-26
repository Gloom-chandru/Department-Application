import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Inbox, FileText, CheckCircle, XCircle, Loader2, MessageSquare, ExternalLink, Calendar 
} from 'lucide-react';
import Toast from '../components/Toast';

const FacultyReview = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  
  // Remarks Form State
  const [remarksMap, setRemarksMap] = useState({});

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const res = await api.get('/requests/review');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage('Failed to fetch assigned requests inbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActioningId(id);
      const remarks = remarksMap[id] || '';
      await api.patch(`/requests/${id}/approve`, { remarks });
      setToastType('success');
      setToastMessage('Request approved successfully.');
      fetchInbox();
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Failed to approve request.');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id) => {
    const remarks = remarksMap[id] || '';
    if (!remarks.trim()) {
      setToastType('error');
      setToastMessage('Rejection remarks are required.');
      return;
    }

    try {
      setActioningId(id);
      await api.patch(`/requests/${id}/reject`, { remarks });
      setToastType('success');
      setToastMessage('Request rejected.');
      fetchInbox();
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Failed to reject request.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRemarksChange = (id, val) => {
    setRemarksMap(prev => ({
      ...prev,
      [id]: val
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'text-emerald-400 font-semibold';
      case 'REJECTED':
        return 'text-red-400 font-semibold';
      case 'CANCELLED':
        return 'text-slate-500 italic';
      default:
        return 'text-amber-400 font-semibold animate-pulse';
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* HEADER */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
          Review Inbox
        </h1>
        <p className="text-slate-400 text-sm">
          Review, approve, or reject Leave and OD absence requests assigned directly to you.
        </p>
      </div>

      {/* INBOX CONTENT */}
      <div className="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
          <Inbox className="h-5 w-5 text-blue-500" />
          Pending Assignments Inbox
        </h2>

        <div className="space-y-4">
          {requests.map((req) => (
            <div 
              key={req.id} 
              className="flex flex-col lg:flex-row justify-between items-start gap-6 p-6 rounded-2xl border border-slate-800 bg-slate-950/20 hover:border-slate-700/80 transition-all"
            >
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-bold text-white uppercase tracking-wider bg-slate-850 px-2.5 py-1 rounded-md border border-slate-800">
                    {req.requestType}
                  </span>
                  <span className={`text-sm ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                  <span className="text-slate-600 text-xs">
                    Submitted: {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold">Student Identity</p>
                    <p className="font-semibold text-slate-200 mt-0.5">{req.student.user.name}</p>
                    <p className="text-xs text-slate-400">
                      Roll No: {req.student.rollNo} | Sec: {req.student.section} | Batch: {req.student.batchYear}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold">Requested Dates</p>
                    <p className="font-semibold text-slate-200 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span>{formatDate(req.startDate)} to {formatDate(req.endDate)}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-slate-500 text-xs uppercase font-bold mb-1">Reason Statement</p>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                    {req.reason}
                  </p>
                </div>

                {req.attachmentPath && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold mb-1">Supporting Document</p>
                    <a
                      href={`${api.defaults.baseURL}/requests/${req.id}/document`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      <span>{req.originalDocumentName}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* ACTION PANEL */}
              {req.status === 'PENDING' && (
                <div className="w-full lg:w-80 shrink-0 space-y-3 bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                  <div>
                    <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
                      Reviewer Remarks {req.status === 'PENDING' && <span className="text-red-500">* (if rejecting)</span>}
                    </label>
                    <textarea
                      value={remarksMap[req.id] || ''}
                      onChange={(e) => handleRemarksChange(req.id, e.target.value)}
                      placeholder="Add remarks or reasons for review decision..."
                      className="w-full h-20 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actioningId === req.id}
                      className="flex-1 flex justify-center items-center gap-1 py-2 px-3 bg-red-600/10 border border-red-500/30 hover:bg-red-600 hover:text-white text-red-400 rounded-xl transition-all text-xs font-bold"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actioningId === req.id}
                      className="flex-1 flex justify-center items-center gap-1 py-2 px-3 bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-emerald-400 rounded-xl transition-all text-xs font-bold"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {requests.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              Your inbox is clean. No requests require review.
            </div>
          )}
        </div>
      </div>

      {/* Toast Alert Popups */}
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
};

export default FacultyReview;
