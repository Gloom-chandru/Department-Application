import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationCenter from './NotificationCenter';
import CommandPalette from './CommandPalette';
import {
  GraduationCap,
  Shield,
  BookOpen,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Search,
  Menu,
  X,
  TrendingUp,
  Compass,
  ClipboardList,
  CalendarDays,
  MailOpen,
  Users,
  Package,
  BarChart3,
  Settings,
  UserCircle,
  TriangleAlert,
} from 'lucide-react';

// ─── Nav definitions per role ────────────────────────────────────────────────

const NAV = {
  STUDENT: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/student/placement', label: 'Placement', icon: Compass },
    { to: '/timetable', label: 'Timetable', icon: CalendarDays },
    { to: '/requests', label: 'Leave & OD', icon: MailOpen },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ],
  FACULTY: [
    { to: '/', label: 'Faculty Panel', icon: LayoutDashboard, exact: true },
    { to: '/faculty/risk', label: 'Risk Attention', icon: TriangleAlert },
    { to: '/faculty/placement', label: 'Placement', icon: Compass },
    { to: '/schedule', label: 'My Schedule', icon: CalendarDays },
    { to: '/review', label: 'Absences Inbox', icon: MailOpen },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ],
  ADMIN: [
    { to: '/', label: 'Admin Panel', icon: LayoutDashboard, exact: true },
    { to: '/admin/risk', label: 'Risk Analytics', icon: BarChart3 },
    { to: '/admin/placement', label: 'Placement', icon: Compass },
    { to: '/admin/bulk', label: 'Bulk Operations', icon: Package },
    { to: '/admin/timetable', label: 'Timetable Mgr', icon: CalendarDays },
    { to: '/admin/requests', label: 'Absences Oversight', icon: ClipboardList },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ],
};

const ROLE_META = {
  STUDENT: { icon: GraduationCap, color: 'text-blue-400', bgGrad: 'from-blue-600 to-indigo-600', label: 'Student' },
  FACULTY: { icon: BookOpen, color: 'text-amber-400', bgGrad: 'from-amber-500 to-orange-500', label: 'Faculty' },
  ADMIN: { icon: Shield, color: 'text-rose-400', bgGrad: 'from-rose-600 to-red-600', label: 'Administrator' },
};

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({ item, collapsed, onClick }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to) && item.to !== '/';

  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`
        group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
        transition-all duration-200 relative overflow-hidden
        ${isActive
          ? 'bg-primary-brand/15 text-text-main border border-primary-brand/25'
          : 'text-text-muted hover:text-text-main hover:bg-bg-app/60'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary-brand" />
      )}
      <Icon
        className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200
          ${isActive ? 'text-primary-brand' : 'group-hover:scale-110'}
        `}
      />
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}
    </Link>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle, onClose, isMobileOpen, user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV[user?.role] || [];
  const roleMeta = ROLE_META[user?.role] || ROLE_META.STUDENT;
  const RoleIcon = roleMeta.icon;

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose?.();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className={`flex items-center gap-3 px-4 pt-5 pb-4 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className={`flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/30 shrink-0`}>
          <GraduationCap className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-main leading-none tracking-tight truncate">VIT Portal</p>
            <p className="text-[10px] text-text-muted mt-0.5 truncate">Velammal Inst. of Technology</p>
          </div>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:flex justify-end px-3 pb-2">
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border-card bg-bg-sidebar text-text-muted hover:text-text-main hover:bg-bg-app transition-all focus-ring"
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border-card/60 mb-3" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} onClick={onClose} />
        ))}
      </nav>

      {/* User card at bottom */}
      <div className="shrink-0 px-3 pb-4 pt-3 border-t border-border-card/60 mt-2">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-app/60 border border-border-card/40">
            <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${roleMeta.bgGrad} flex items-center justify-center shrink-0 shadow-sm`}>
              <RoleIcon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-main truncate leading-none">{user.name}</p>
              <p className={`text-[10px] mt-0.5 font-medium ${roleMeta.color} truncate`}>
                {roleMeta.label}{user.department ? ` · ${user.department.code}` : ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors focus-ring"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="w-full flex justify-center p-2 rounded-xl text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors focus-ring"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0
          bg-bg-sidebar border-r border-border-card
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[64px]' : 'w-[220px]'}
        `}
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside
            className="relative z-50 flex flex-col w-[240px] bg-bg-sidebar border-r border-border-card h-full animate-slide-up"
            aria-label="Mobile sidebar navigation"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="absolute top-4 right-3 p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-app/60 transition-colors focus-ring"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Topnav ───────────────────────────────────────────────────────────────────

function Topnav({ onMobileMenuOpen, onCommandPaletteOpen }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  // Derive page title from location
  const pageTitle = (() => {
    const path = location.pathname;
    if (path === '/') return user?.role === 'ADMIN' ? 'Admin Overview' : user?.role === 'FACULTY' ? 'Faculty Panel' : 'Dashboard';
    if (path === '/profile') return 'Profile';
    if (path === '/timetable') return 'My Timetable';
    if (path === '/requests') return 'Leave & On-Duty';
    if (path === '/review') return 'Absences Inbox';
    if (path === '/schedule') return 'My Schedule';
    if (path === '/notifications') return 'Notifications';
    if (path === '/student/placement') return 'Placement Portal';
    if (path === '/faculty/placement') return 'Placement Overview';
    if (path === '/faculty/risk') return 'Risk Attention';
    if (path === '/admin/placement') return 'Placement Manager';
    if (path === '/admin/risk') return 'Risk Analytics';
    if (path === '/admin/bulk') return 'Bulk Operations';
    if (path === '/admin/timetable') return 'Timetable Manager';
    if (path === '/admin/requests') return 'Absences Oversight';
    return 'VIT Portal';
  })();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border-card/70 bg-bg-sidebar/80 backdrop-blur-xl px-4 gap-3">
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuOpen}
        aria-label="Open navigation menu"
        className="lg:hidden flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-app/60 transition-colors focus-ring"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <h1 className="text-sm font-semibold text-text-main truncate flex-1 leading-none">
        {pageTitle}
      </h1>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Command palette trigger */}
        <button
          onClick={onCommandPaletteOpen}
          aria-label="Open command palette (Ctrl+K)"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-card bg-bg-app/60 text-text-muted text-xs font-medium hover:text-text-main hover:bg-bg-app transition-all focus-ring"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-border-card bg-bg-sidebar px-1.5 font-mono text-[10px] font-bold text-text-muted select-none">
            ⌘K
          </kbd>
        </button>

        {/* Search icon only on mobile */}
        <button
          onClick={onCommandPaletteOpen}
          aria-label="Open command palette"
          className="sm:hidden flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-app/60 transition-colors focus-ring"
        >
          <Search className="h-4.5 w-4.5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="flex items-center justify-center p-2 rounded-lg border border-border-card bg-bg-app/60 text-text-muted hover:text-text-main hover:bg-bg-app transition-all focus-ring"
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4 text-amber-400" />
            : <Moon className="h-4 w-4 text-indigo-500" />
          }
        </button>

        {/* Notification center */}
        <NotificationCenter />
      </div>
    </header>
  );
}

// ─── Layout (root) ────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Close mobile nav on route change
  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut: Ctrl/Cmd+K → command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!user) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-app text-text-main">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        isMobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top navigation */}
        <Topnav
          onMobileMenuOpen={() => setMobileOpen(true)}
          onCommandPaletteOpen={() => setCmdPaletteOpen(true)}
        />

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          id="main-content"
          tabIndex={-1}
          aria-label="Page content"
        >
          {children}
        </main>
      </div>

      {/* Command Palette overlay */}
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
      />
    </div>
  );
}
