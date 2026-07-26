import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  FileText, Search, ShieldAlert, Loader2, Calendar, ChevronLeft, ChevronRight, User 
} from 'lucide-react';
import Toast from '../components/Toast';

const AdminRequestsOverview = () => {
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters State
  const [departmentId, setDepartmentId] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const [requestType, setRequestType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Detail Modal
  const [selectedReq, setSelectedReq] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const fetchFiltersData = async () => {
    try {
      const deptsRes = await api.get('/admin/departments');
      setDepartments(deptsRes.data);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        departmentId,
        batchYear,
        section,
        status,
        requestType,
        startDate,
        endDate
      };

      const res = await api.get('/requests/admin', { params });
      setRequests(res.data.requests);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage('Failed to fetch requests overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [page, departmentId, batchYear, section, status, requestType, startDate, endDate]);

  const viewDetails = async (id) => {
    try {
      setLoadingDetails(true);
      const res = await api.get(`/requests/admin/${id}`);
      setSelectedReq(res.data);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage('Failed to load request workflow details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
      case 'REJECTED':
        return 'bg-red-500/10 border-red-500/25 text-red-400';
      case 'CANCELLED':
        return 'bg-slate-500/10 border-slate-500/25 text-slate-400';
      default:
        return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toISOString().split('T')[0];
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* HEADER */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
          Leave & OD Administration
        </h1>
        <p className="text-slate-400 text-sm">
          Institutional absence request logs, filters, status breakdowns, and reviewer history tracking.
        </p>
      </div>

      {/* FILTERS PANEL */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">Department</label>
          <select
            value={departmentId}
            onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">Batch Year</label>
          <input
            type="text"
            placeholder="e.g. 2024-28"
            value={batchYear}
            onChange={(e) => { setBatchYear(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">Section</label>
          <input
            type="text"
            placeholder="e.g. A"
            value={section}
            onChange={(e) => { setSection(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">Type</label>
          <select
            value={requestType}
            onChange={(e) => { setRequestType(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All Types</option>
            <option value="LEAVE">LEAVE</option>
            <option value="OD">OD</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* LIST TABLE */}
      <div className="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Filtered Absences Log ({total} total)
          </h2>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Dept / Section</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Dates</th>
                  <th className="px-6 py-4">Reviewer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-900/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100">{req.student.user.name}</div>
                      <div className="text-xs text-slate-500">Roll No: {req.student.rollNo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">{req.student.department.code}</div>
                      <div className="text-xs text-slate-400">Sec: {req.student.section} | Batch: {req.student.batchYear}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold uppercase text-slate-200">
                      {req.requestType}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {formatDate(req.startDate)} to {formatDate(req.endDate)}
                    </td>
                    <td className="px-6 py-4 text-slate-200">
                      Prof. {req.reviewerFaculty.user.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => viewDetails(req.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-750 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-semibold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
                      No records match the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4">
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white">Oversight Workflow Inspection</h3>
              <button 
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Student Name</span>
                <span className="font-semibold text-slate-200">{selectedReq.student.user.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Roll Number</span>
                <span className="font-semibold text-slate-200">{selectedReq.student.rollNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Dates</span>
                <span className="font-semibold text-slate-200">{formatDate(selectedReq.startDate)} to {formatDate(selectedReq.endDate)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Absence Type</span>
                <span className="font-semibold text-slate-200 uppercase">{selectedReq.requestType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Reviewer Faculty</span>
                <span className="font-semibold text-slate-200">Prof. {selectedReq.reviewerFaculty.user.name}</span>
              </div>

              {/* Document Block: Display metadata only, show alert icon for downloads */}
              <div className="flex justify-between items-center border-b border-slate-850 pb-2 bg-slate-950/20 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Document Privacy Boundaries</span>
                </span>
                {selectedReq.originalDocumentName ? (
                  <span className="text-slate-400 text-xs italic" title="Admin is barred from downloading private student documentation">
                    {selectedReq.originalDocumentName} (Protected)
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </div>

              {/* Approval workflow timeline */}
              <div>
                <h4 className="font-bold text-slate-400 text-xs uppercase mb-3">Workflow Logs Timeline</h4>
                <div className="space-y-3 border-l border-slate-800 pl-4 ml-2">
                  {selectedReq.approvalHistory.map((h, idx) => (
                    <div key={h.id} className="relative">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <div className="text-xs font-semibold text-slate-200">
                        {h.action} by {h.actorUser.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(h.createdAt).toLocaleString()}
                      </div>
                      {h.remarks && (
                        <div className="text-xs text-slate-400 italic mt-0.5">
                          "{h.remarks}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert Popups */}
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
};

export default AdminRequestsOverview;
