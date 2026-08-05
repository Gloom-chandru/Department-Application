import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Bell, Check, X, ClipboardList, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import Drawer from './ui/Drawer';
import Button from './ui/Button';
import { EmptyState } from './ui/FeedbackStates';

const getRelativeTime = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
};

const NotificationCenter = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
      const res = await api.get('/notifications?limit=10');
      setNotifications(res.data.notifications);
    } catch (err) {
      console.error('Error loading recent notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRecentNotifications();
    }
  }, [isOpen]);

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
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'MARKS_PUBLISHED':
        return <ClipboardList className="h-4 w-4 text-emerald-500" />;
      case 'SYSTEM':
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-primary-500" />;
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'border-l-4 border-red-500 bg-red-500/5';
      case 'HIGH':
        return 'border-l-4 border-amber-500 bg-amber-500/5';
      case 'LOW':
        return 'border-l-4 border-border-card bg-bg-sidebar/35';
      default:
        return 'border-l-4 border-primary-500 bg-primary-500/5';
    }
  };

  return (
    <>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        aria-label="View notification drawer"
        className="relative p-2 rounded-lg border border-border-card bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-sidebar focus-ring transition-colors cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-bg-card animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Slide-out Drawer */}
      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifications Center"
        size="md"
      >
        <div className="flex flex-col h-full">
          {/* Action Bar */}
          {unreadCount > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-primary-500 hover:text-primary-400 hover:underline cursor-pointer"
              >
                Mark all as read
              </button>
            </div>
          )}

          {/* Messages Panel Container */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="animate-pulse bg-bg-sidebar border border-border-card p-4 rounded-lg flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-border-card" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-border-card w-1/3 rounded" />
                      <div className="h-3 bg-border-card w-2/3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="All caught up!"
                description="No recent notifications found."
              />
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/notifications');
                  }}
                  className={`
                    group relative flex gap-3 p-3.5 rounded-lg border border-border-card/50 transition-all duration-150 cursor-pointer
                    ${getPriorityStyle(notif.priority)}
                    ${!notif.readStatus ? 'shadow-premium-sm border-l-4' : 'opacity-65 hover:opacity-100'}
                  `}
                >
                  <div className="shrink-0 mt-0.5">{getTypeIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0 pr-12">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-bold truncate ${!notif.readStatus ? 'text-text-main' : 'text-text-muted'}`}>
                        {notif.title || 'Notification'}
                      </span>
                      {!notif.readStatus && (
                        <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{notif.message}</p>
                    <span className="block text-[10px] text-text-muted/65 mt-2.5 font-medium">
                      {getRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  {/* Actions overlay buttons */}
                  <div className="absolute right-3.5 top-3.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.readStatus && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        title="Mark as read"
                        className="p-1 rounded-md bg-bg-sidebar hover:bg-bg-card border border-border-card text-text-muted hover:text-text-main cursor-pointer focus-ring"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleArchive(notif.id, e)}
                      title="Archive notification"
                      className="p-1 rounded-md bg-bg-sidebar hover:bg-bg-card border border-border-card text-text-muted hover:text-red-500 cursor-pointer focus-ring"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer View All Notifications Button */}
          <div className="border-t border-border-card/65 pt-4 mt-4 select-none shrink-0">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
            >
              <span>View All Notifications</span>
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default NotificationCenter;
