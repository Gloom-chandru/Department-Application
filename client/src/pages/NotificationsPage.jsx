import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  Bell, Check, X, ClipboardList, Info, AlertTriangle, ShieldAlert, ArrowLeft, Loader2
} from 'lucide-react';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    type: '',
    readStatus: '',
    includeArchived: 'false'
  });
  const navigate = useNavigate();

  const fetchNotifications = async (filtersOverride = {}) => {
    try {
      setLoading(true);
      const activeFilters = { ...filters, ...filtersOverride };
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });

      const res = await api.get(`/notifications?${params.toString()}`);
      setNotifications(res.data.notifications);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readStatus: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, readStatus: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async (id) => {
    try {
      await api.patch(`/notifications/${id}/archive`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    fetchNotifications(newFilters);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'ATTENDANCE_WARNING':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'MARKS_PUBLISHED':
        return <ClipboardList className="h-5 w-5 text-emerald-500" />;
      case 'SYSTEM':
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] p-4 sm:p-8 text-slate-350">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Header navigation bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              type="button"
              aria-label="Go back to dashboard"
              className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Bell className="h-6 w-6 text-blue-500" />
                Notification Center
              </h1>
              <p className="text-xs text-slate-500">Manage and view your academic and institutional alerts</p>
            </div>
          </div>
          <button
            onClick={handleMarkAllRead}
            disabled={notifications.length === 0}
            className="px-4 py-2 border border-slate-850 hover:border-slate-800 bg-slate-900 text-slate-200 hover:text-white font-semibold text-xs rounded-xl disabled:opacity-40 transition-colors"
          >
            Mark all read
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-850">
          <div className="space-y-1">
            <label htmlFor="notif-type" className="text-[10px] font-bold text-slate-500 uppercase">Alert Type</label>
            <select
              id="notif-type"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="ATTENDANCE_WARNING">Attendance Warnings</option>
              <option value="MARKS_PUBLISHED">Marks Published</option>
              <option value="SYSTEM">System Alerts</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="notif-status" className="text-[10px] font-bold text-slate-500 uppercase">Read Status</label>
            <select
              id="notif-status"
              value={filters.readStatus}
              onChange={(e) => handleFilterChange('readStatus', e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="notif-archived" className="text-[10px] font-bold text-slate-500 uppercase">Include Archived</label>
            <select
              id="notif-archived"
              value={filters.includeArchived}
              onChange={(e) => handleFilterChange('includeArchived', e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="false">Active Only</option>
              <option value="true">Include Archived</option>
            </select>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-slate-900/10 border border-slate-850 p-12 text-center rounded-2xl text-slate-500 text-sm">
              You do not have any notifications matching these criteria.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`relative flex gap-4 p-5 rounded-2xl bg-slate-900/20 border border-slate-850 hover:bg-slate-900/40 transition-colors ${
                  !notif.readStatus ? 'border-l-4 border-l-blue-500' : 'opacity-70'
                }`}
              >
                <div className="mt-1">{getTypeIcon(notif.type)}</div>
                <div className="flex-1 min-w-0 pr-12">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white leading-snug">
                      {notif.title || 'Notification'}
                    </h3>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                      notif.priority === 'URGENT' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      notif.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {notif.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
                  <span className="block text-[10px] text-slate-550 mt-2 font-mono">
                    Sent at: {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Actions */}
                <div className="absolute right-4 top-4 flex gap-2">
                  {!notif.readStatus && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleArchive(notif.id)}
                    title="Archive notification"
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4 text-xs text-slate-500">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total notifications)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page === 1}
                onClick={() => {
                  const newFilters = { ...filters, page: pagination.page - 1 };
                  setFilters(newFilters);
                  fetchNotifications(newFilters);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 font-semibold text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => {
                  const newFilters = { ...filters, page: pagination.page + 1 };
                  setFilters(newFilters);
                  fetchNotifications(newFilters);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 font-semibold text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default NotificationsPage;
