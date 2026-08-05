import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Search, Compass, Sun, Moon, LogOut, Bell, Shield, GraduationCap, BookOpen } from 'lucide-react';
import { handleTabFocusTrap } from '../utils/a11y';

export default function CommandPalette({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Define commands based on role
  const getCommands = () => {
    if (!user) return [];

    const baseCommands = [
      {
        id: 'toggle-theme',
        title: 'Toggle Color Theme',
        subtitle: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        icon: theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />,
        action: () => {
          toggleTheme();
          onClose();
        }
      },
      {
        id: 'logout',
        title: 'Sign Out',
        subtitle: 'Log out of your VIT Student Portal session',
        icon: <LogOut className="h-4 w-4 text-red-500" />,
        action: () => {
          logout();
          navigate('/login');
          onClose();
        }
      }
    ];

    const studentCommands = [
      { id: 'nav-dash', title: 'Dashboard', subtitle: 'View academic standing & attendance dial', icon: <GraduationCap className="h-4 w-4 text-blue-500" />, action: () => { navigate('/'); onClose(); } },
      { id: 'nav-placement', title: 'Placement Portal', subtitle: 'View eligible placement drives & offers', icon: <Compass className="h-4 w-4 text-emerald-500" />, action: () => { navigate('/student/placement'); onClose(); } },
      { id: 'nav-timetable', title: 'My Timetable', subtitle: 'Check weekly schedule & lecture hall locations', icon: <Compass className="h-4 w-4 text-indigo-500" />, action: () => { navigate('/timetable'); onClose(); } },
      { id: 'nav-requests', title: 'Leave & On-Duty', subtitle: 'Apply for leaves and OD approvals', icon: <Compass className="h-4 w-4 text-purple-500" />, action: () => { navigate('/requests'); onClose(); } },
      { id: 'nav-profile', title: 'Profile Settings', subtitle: 'Update email & view register number details', icon: <Compass className="h-4 w-4 text-slate-400" />, action: () => { navigate('/profile'); onClose(); } },
    ];

    const facultyCommands = [
      { id: 'nav-panel', title: 'Faculty Registry', subtitle: 'Mark attendance & submit student grades', icon: <BookOpen className="h-4 w-4 text-amber-500" />, action: () => { navigate('/'); onClose(); } },
      { id: 'nav-risk', title: 'Academic Attention Portal', subtitle: 'Track at-risk students below 75% attendance', icon: <Compass className="h-4 w-4 text-rose-500" />, action: () => { navigate('/faculty/risk'); onClose(); } },
      { id: 'nav-placement-fac', title: 'Placement Drives Overview', subtitle: 'View campus recruitment records', icon: <Compass className="h-4 w-4 text-emerald-500" />, action: () => { navigate('/faculty/placement'); onClose(); } },
      { id: 'nav-schedule', title: 'My Lecture Schedule', subtitle: 'View mapped slot timings & classes', icon: <Compass className="h-4 w-4 text-indigo-500" />, action: () => { navigate('/schedule'); onClose(); } },
      { id: 'nav-review', title: 'Absences Approvals Inbox', subtitle: 'Approve or reject student leave applications', icon: <Compass className="h-4 w-4 text-purple-500" />, action: () => { navigate('/review'); onClose(); } },
      { id: 'nav-profile-fac', title: 'Profile Settings', subtitle: 'View faculty details', icon: <Compass className="h-4 w-4 text-slate-400" />, action: () => { navigate('/profile'); onClose(); } },
    ];

    const adminCommands = [
      { id: 'nav-admin', title: 'Admin Overview', subtitle: 'System-wide analytics, distribution & logs', icon: <Shield className="h-4 w-4 text-red-500" />, action: () => { navigate('/'); onClose(); } },
      { id: 'nav-risk-analytics', title: 'Predictive Risk Analytics', subtitle: 'Review alert lists and critical thresholds', icon: <Compass className="h-4 w-4 text-rose-500" />, action: () => { navigate('/admin/risk'); onClose(); } },
      { id: 'nav-placement-mgr', title: 'Placement Drive Orchestrator', subtitle: 'Create placement drives & eligibility criteria', icon: <Compass className="h-4 w-4 text-emerald-500" />, action: () => { navigate('/admin/placement'); onClose(); } },
      { id: 'nav-bulk', title: 'Bulk Data Imports', subtitle: 'Upload spreadsheets for Students & Marks', icon: <Compass className="h-4 w-4 text-blue-500" />, action: () => { navigate('/admin/bulk'); onClose(); } },
      { id: 'nav-timetable-mgr', title: 'Timetable Configurations', subtitle: 'Add slots, rooms, and detect lecturer clashes', icon: <Compass className="h-4 w-4 text-indigo-500" />, action: () => { navigate('/admin/timetable'); onClose(); } },
      { id: 'nav-oversight', title: 'Absences Oversight Tracker', subtitle: 'Audit system-wide leave logs', icon: <Compass className="h-4 w-4 text-purple-500" />, action: () => { navigate('/admin/requests'); onClose(); } },
      { id: 'nav-profile-admin', title: 'Profile Info', subtitle: 'Verify account configurations', icon: <Compass className="h-4 w-4 text-slate-400" />, action: () => { navigate('/profile'); onClose(); } },
    ];

    let roleCommands = [];
    if (user.role === 'STUDENT') roleCommands = studentCommands;
    else if (user.role === 'FACULTY') roleCommands = facultyCommands;
    else if (user.role === 'ADMIN') roleCommands = adminCommands;

    return [...roleCommands, ...baseCommands];
  };

  const commands = getCommands();

  // Filter commands by search term
  const filteredCommands = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(search.toLowerCase()) ||
    cmd.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        handleTabFocusTrap(e, containerRef.current);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      {/* Overlay Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Container */}
      <div
        ref={containerRef}
        tabIndex={-1}
        className="relative w-full max-w-xl rounded-xl border border-border-card bg-bg-card shadow-premium-xl flex flex-col focus:outline-none overflow-hidden z-10 animate-slide-up"
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
      >
        {/* Search Input Box */}
        <div className="flex items-center gap-3 border-b border-border-card/65 px-4 py-3.5">
          <Search className="h-5 w-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or page to search..."
            className="w-full bg-transparent border-0 text-sm text-text-main placeholder-text-muted/50 focus:outline-none"
            aria-autocomplete="list"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border-card bg-bg-sidebar px-1.5 font-mono text-[10px] font-bold text-text-muted select-none">
            ESC
          </kbd>
        </div>

        {/* Command List Options */}
        <div className="max-h-[320px] overflow-y-auto p-1.5" role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-muted select-none font-semibold">
              No matching pages or actions found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  role="option"
                  aria-selected={isSelected}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 select-none
                    ${isSelected ? 'bg-bg-sidebar text-text-main' : 'text-text-muted'}
                  `}
                >
                  <div className={`p-1.5 rounded-md ${isSelected ? 'bg-bg-card text-text-main shadow-premium-sm' : 'bg-transparent text-text-muted'}`}>
                    {cmd.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold tracking-tight ${isSelected ? 'text-text-main' : 'text-text-muted hover:text-text-main'}`}>
                      {cmd.title}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">{cmd.subtitle}</p>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-text-muted select-none mr-1.5">
                      ENTER
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
