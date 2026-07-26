import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  Bell, Check, X, ClipboardList, Info, AlertTriangle, ShieldAlert, AlertCircle 
} from 'lucide-react';

const NotificationCenter = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const fetchRecentNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications?limit=5');
      setNotifications(res.data.notifications);
    } catch (err) {
      console.error('Error loading recent notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // Lightweight polling every 30s
    const timer = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRecentNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readStatus: true } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, readStatus: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleArchive = async (id, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/archive`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'ATTENDANCE_WARNING':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'MARKS_PUBLISHED':
        return <ClipboardList className="h-4 w-4 text-emerald-500" />;
      case 'SYSTEM':
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'border-l-4 border-l-red-500 bg-red-950/10';
      case 'HIGH':
        return 'border-l-4 border-l-orange-500 bg-orange-950/10';
      case 'LOW':
        return 'border-l-4 border-l-slate-650 bg-slate-900/10';
      default:
        return 'border-l-4 border-l-blue-500';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-label="View notifications panel"
        className="relative p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-slate-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-[#0d1424] text-slate-300 shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <h4 className="text-sm font-bold text-slate-200">Recent Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">You have no active notifications.</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => navigate('/notifications')}
                  className={`group relative flex gap-3 p-3 rounded-xl bg-slate-900/35 hover:bg-slate-900/80 cursor-pointer transition-colors border border-slate-900/60 ${getPriorityStyle(notif.priority)} ${
                    !notif.readStatus ? 'shadow-md shadow-blue-500/5' : 'opacity-70'
                  }`}
                >
                  <div className="mt-0.5">{getTypeIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold truncate ${!notif.readStatus ? 'text-slate-105' : 'text-slate-400'}`}>
                        {notif.title || 'Notification'}
                      </span>
                      {!notif.readStatus && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{notif.message}</p>
                    <span className="block text-[9px] text-slate-500 mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.readStatus && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        title="Mark as read"
                        className="p-1 rounded bg-slate-950/80 hover:bg-slate-950 text-slate-400 hover:text-white"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleArchive(notif.id, e)}
                      title="Archive notification"
                      className="p-1 rounded bg-slate-950/80 hover:bg-slate-950 text-slate-450 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer view all link */}
          <div className="border-t border-slate-800 pt-3 mt-3 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors w-full"
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
