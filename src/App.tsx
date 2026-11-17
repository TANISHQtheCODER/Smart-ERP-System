import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { ScanRedirectPage } from './pages/ScanRedirectPage';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAcademics } from './pages/admin/AdminAcademics';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminTeachers } from './pages/admin/AdminTeachers';
import { AdminSubjects } from './pages/admin/AdminSubjects';
import { AdminAttendance } from './pages/admin/AdminAttendance';
import { AdminNotices } from './pages/admin/AdminNotices';

import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { TeacherSubjects } from './pages/teacher/TeacherSubjects';
import { TeacherAttendanceLive } from './pages/teacher/TeacherAttendanceLive';
import { TeacherHistory } from './pages/teacher/TeacherHistory';
import { TeacherLeaves } from './pages/teacher/TeacherLeaves';
import { TeacherSchedule } from './pages/teacher/TeacherSchedule';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentScanQR } from './pages/student/StudentScanQR';
import { StudentAttendance } from './pages/student/StudentAttendance';
import { StudentTimetable } from './pages/student/StudentTimetable';
import { StudentNotices } from './pages/student/StudentNotices';
import { StudentLeaves } from './pages/student/StudentLeaves';

function RequireRole({
  roles,
  children,
}: {
  roles: Array<'admin' | 'teacher' | 'student'>;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading Smart ERP...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading Smart ERP...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/${user.role}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/scan/:token" element={<ScanRedirectPage />} />

          <Route
            path="/profile"
            element={
              <RequireRole roles={['admin', 'teacher', 'student']}>
                <ProfilePage />
              </RequireRole>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <AdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/admin/academics"
            element={
              <RequireRole roles={['admin']}>
                <AdminAcademics />
              </RequireRole>
            }
          />
          <Route
            path="/admin/students"
            element={
              <RequireRole roles={['admin']}>
                <AdminStudents />
              </RequireRole>
            }
          />
          <Route
            path="/admin/teachers"
            element={
              <RequireRole roles={['admin']}>
                <AdminTeachers />
              </RequireRole>
            }
          />
          <Route
            path="/admin/subjects"
            element={
              <RequireRole roles={['admin']}>
                <AdminSubjects />
              </RequireRole>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <RequireRole roles={['admin']}>
                <AdminAttendance />
              </RequireRole>
            }
          />
          <Route
            path="/admin/notices"
            element={
              <RequireRole roles={['admin']}>
                <AdminNotices />
              </RequireRole>
            }
          />

          {/* Teacher Routes */}
          <Route
            path="/teacher"
            element={
              <RequireRole roles={['teacher']}>
                <TeacherDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/subjects"
            element={
              <RequireRole roles={['teacher']}>
                <TeacherSubjects />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <RequireRole roles={['teacher']}>
                <TeacherAttendanceLive />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/history"
            element={
              <RequireRole roles={['teacher']}>
                <TeacherHistory />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/leaves"
            element={
              <RequireRole roles={['teacher']}>
                <TeacherLeaves />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/schedule"
            element={
              <RequireRole roles={['teacher']}>
                <TeacherSchedule />
              </RequireRole>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <RequireRole roles={['student']}>
                <StudentDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/student/scan"
            element={
              <RequireRole roles={['student']}>
                <StudentScanQR />
              </RequireRole>
            }
          />
          <Route
            path="/student/attendance"
            element={
              <RequireRole roles={['student']}>
                <StudentAttendance />
              </RequireRole>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <RequireRole roles={['student']}>
                <StudentTimetable />
              </RequireRole>
            }
          />
          <Route
            path="/student/notices"
            element={
              <RequireRole roles={['student']}>
                <StudentNotices />
              </RequireRole>
            }
          />
          <Route
            path="/student/leaves"
            element={
              <RequireRole roles={['student']}>
                <StudentLeaves />
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
