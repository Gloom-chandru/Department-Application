import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, User, GraduationCap, Shield, BookOpen, Bell } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) => 
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive(path)
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
        : 'text-text-muted hover:text-text-main hover:bg-bg-sidebar/50'
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-border-app bg-bg-sidebar/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-blue-500" />
            <Link to="/" className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white leading-none">VIT Student Portal</span>
              <span className="text-xs text-text-muted mt-0.5">Velammal Institute of Technology</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {user.role === 'STUDENT' && (
              <>
                <Link to="/" className={linkClass('/')}>Dashboard</Link>
                <Link to="/student/placement" className={linkClass('/student/placement')}>Placement</Link>
                <Link to="/timetable" className={linkClass('/timetable')}>Timetable</Link>
                <Link to="/requests" className={linkClass('/requests')}>Leave & OD</Link>
                <Link to="/profile" className={linkClass('/profile')}>Profile</Link>
              </>
            )}
            
            {user.role === 'FACULTY' && (
              <>
                <Link to="/" className={linkClass('/')}>Faculty Panel</Link>
                <Link to="/faculty/risk" className={linkClass('/faculty/risk')}>Risk Attention</Link>
                <Link to="/faculty/placement" className={linkClass('/faculty/placement')}>Placement</Link>
                <Link to="/schedule" className={linkClass('/schedule')}>My Schedule</Link>
                <Link to="/review" className={linkClass('/review')}>Absences Inbox</Link>
                <Link to="/profile" className={linkClass('/profile')}>Profile</Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <>
                <Link to="/" className={linkClass('/')}>Admin Panel</Link>
                <Link to="/admin/risk" className={linkClass('/admin/risk')}>Risk Analytics</Link>
                <Link to="/admin/placement" className={linkClass('/admin/placement')}>Placement</Link>
                <Link to="/admin/bulk" className={linkClass('/admin/bulk')}>Bulk Operations</Link>
                <Link to="/admin/timetable" className={linkClass('/admin/timetable')}>Timetable Manager</Link>
                <Link to="/admin/requests" className={linkClass('/admin/requests')}>Absences Oversight</Link>
                <Link to="/profile" className={linkClass('/profile')}>Profile</Link>
              </>
            )}
          </div>

          {/* User Details & Logout Button (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <NotificationCenter />
            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-text-main">{user.name}</span>
              <span className="text-xs text-text-muted flex items-center justify-end gap-1">
                {user.role === 'ADMIN' && <Shield className="h-3 w-3 text-red-400" />}
                {user.role === 'FACULTY' && <BookOpen className="h-3 w-3 text-amber-400" />}
                {user.role === 'STUDENT' && <GraduationCap className="h-3 w-3 text-blue-400" />}
                {user.role} {user.department ? `(${user.department.code})` : ''}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border-app bg-bg-card text-text-muted hover:text-red-400 hover:border-red-900/30 hover:bg-red-950/10 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle main navigation menu"
              aria-expanded={isOpen}
              className="inline-flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-bg-sidebar hover:text-text-main focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border-app bg-bg-app px-2 pt-2 pb-3 space-y-1">
          {user.role === 'STUDENT' && (
            <>
              <Link to="/" onClick={() => setIsOpen(false)} className={linkClass('/')}>Dashboard</Link>
              <Link to="/student/placement" onClick={() => setIsOpen(false)} className={linkClass('/student/placement')}>Placement</Link>
              <Link to="/timetable" onClick={() => setIsOpen(false)} className={linkClass('/timetable')}>Timetable</Link>
              <Link to="/requests" onClick={() => setIsOpen(false)} className={linkClass('/requests')}>Leave & OD</Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className={linkClass('/profile')}>Profile</Link>
              <Link to="/notifications" onClick={() => setIsOpen(false)} className={linkClass('/notifications')}>Notifications</Link>
            </>
          )}

          {user.role === 'FACULTY' && (
            <>
              <Link to="/" onClick={() => setIsOpen(false)} className={linkClass('/')}>Faculty Panel</Link>
              <Link to="/faculty/risk" onClick={() => setIsOpen(false)} className={linkClass('/faculty/risk')}>Risk Attention</Link>
              <Link to="/faculty/placement" onClick={() => setIsOpen(false)} className={linkClass('/faculty/placement')}>Placement</Link>
              <Link to="/schedule" onClick={() => setIsOpen(false)} className={linkClass('/schedule')}>My Schedule</Link>
              <Link to="/review" onClick={() => setIsOpen(false)} className={linkClass('/review')}>Absences Inbox</Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className={linkClass('/profile')}>Profile</Link>
              <Link to="/notifications" onClick={() => setIsOpen(false)} className={linkClass('/notifications')}>Notifications</Link>
            </>
          )}

          {user.role === 'ADMIN' && (
            <>
              <Link to="/" onClick={() => setIsOpen(false)} className={linkClass('/')}>Admin Panel</Link>
              <Link to="/admin/risk" onClick={() => setIsOpen(false)} className={linkClass('/admin/risk')}>Risk Analytics</Link>
              <Link to="/admin/placement" onClick={() => setIsOpen(false)} className={linkClass('/admin/placement')}>Placement</Link>
              <Link to="/admin/bulk" onClick={() => setIsOpen(false)} className={linkClass('/admin/bulk')}>Bulk Operations</Link>
              <Link to="/admin/timetable" onClick={() => setIsOpen(false)} className={linkClass('/admin/timetable')}>Timetable Manager</Link>
              <Link to="/admin/requests" onClick={() => setIsOpen(false)} className={linkClass('/admin/requests')}>Absences Oversight</Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className={linkClass('/profile')}>Profile</Link>
              <Link to="/notifications" onClick={() => setIsOpen(false)} className={linkClass('/notifications')}>Notifications</Link>
            </>
          )}
          
          <div className="border-t border-border-app mt-4 pt-4 px-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-main">{user.name}</span>
              <span className="text-xs text-text-muted">{user.role} {user.department ? `(${user.department.code})` : ''}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-red-950/20 bg-red-950/15 text-red-400 hover:bg-red-950/30 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
