import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/academics', label: 'Academics', icon: Building2 },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/teachers', label: 'Teachers', icon: Users },
  { to: '/admin/subjects', label: 'Subjects & Enrollment', icon: BookOpen },
  { to: '/admin/attendance', label: 'Attendance Reports', icon: FileSpreadsheet },
  { to: '/admin/notices', label: 'Notices & Timetable', icon: Bell },
];

const TEACHER_NAV: NavItem[] = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/subjects', label: 'My Subjects', icon: BookOpen },
  { to: '/teacher/attendance', label: 'Start QR Attendance', icon: QrCode },
  { to: '/teacher/history', label: 'Session History', icon: History },
  { to: '/teacher/leaves', label: 'Leave Approvals', icon: UserCheck },
  { to: '/teacher/schedule', label: 'Timetable & Notices', icon: Calendar },
];

const STUDENT_NAV: NavItem[] = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/scan', label: 'Scan QR Attendance', icon: QrCode },
  { to: '/student/attendance', label: 'My Attendance', icon: ClipboardCheck },
  { to: '/student/timetable', label: 'Timetable', icon: Calendar },
  { to: '/student/notices', label: 'College Notices', icon: Bell },
  { to: '/student/leaves', label: 'Leave Requests', icon: FileText },
];

interface AppShellProps {
  title: string;
  breadcrumb: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ title, breadcrumb, action, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const navItems =
    user.role === 'admin' ? ADMIN_NAV : user.role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;

  const roleTitle =
    user.role === 'admin'
      ? 'Administration'
      : user.role === 'teacher'
      ? 'Faculty Portal'
      : 'Student Portal';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
          <Link to={`/${user.role}`} className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Smart ERP
          </Link>
          <span className="text-xs text-slate-500 whitespace-nowrap">{roleTitle}</span>
        </div>

        {renderNavLinks()}

        <div className="p-3 border-t border-slate-200 space-y-1">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
              <p className="text-xs font-mono text-slate-500 truncate">{user.login_id}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">Smart ERP</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileOpen(false))}
            <div className="p-3 border-t border-slate-200 space-y-1">
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100"
              >
                <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
                  <p className="text-xs font-mono text-slate-500 truncate">{user.login_id}</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 min-h-[44px]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">{breadcrumb}</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {action}
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <span className="font-mono">{user.login_id}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
