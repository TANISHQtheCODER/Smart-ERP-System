import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface OverviewResponse {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalSubjects: number;
    totalSessions: number;
    overallPercentage: number;
    deficitAlertCount: number;
  };
  deficitAlerts: Array<{
    student_id: number;
    student_code: string;
    full_name: string;
    subject_code: string;
    subject_name: string;
    present: number;
    total: number;
    percentage: number;
    requiredClasses: number;
  }>;
  recentSessions: Array<{
    id: number;
    session_date: string;
    topic: string;
    status: string;
    subject_code: string;
    subject_name: string;
    teacher_name: string;
    marked_count: number;
    present_count: number;
  }>;
  notices: Array<{
    id: number;
    title: string;
    category: string;
    target_role: string;
    published_at: string;
  }>;
}

export function AdminDashboard() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<OverviewResponse>('/api/admin/overview')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Overview"
      breadcrumb="Administration"
      action={
        <Link
          to="/admin/attendance"
          className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
        >
          Attendance Reports
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Enrolled Students</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.stats.totalStudents}
              </p>
              <p className="mt-1 text-xs text-slate-500">Active semester cohorts</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Teaching Faculty</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.stats.totalTeachers}
              </p>
              <p className="mt-1 text-xs text-slate-500">Assigned across departments</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Active Subjects</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.stats.totalSubjects}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {data.stats.totalSessions} lecture sessions logged
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Institutional Attendance</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.stats.overallPercentage}%
              </p>
              <p className="mt-1 text-xs text-amber-700 tabular-nums">
                {data.stats.deficitAlertCount} subject enrollments below 75%
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Deficit Watchlist */}
            <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Below 75% Attendance Watchlist
                  </h2>
                  <p className="text-xs text-slate-500">
                    Students requiring consecutive attendance recovery
                  </p>
                </div>
                <Link
                  to="/admin/attendance"
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Full report</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {data.deficitAlerts.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  All enrolled students meet or exceed the 75% attendance requirement.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-2.5 px-4">Student</th>
                        <th className="py-2.5 px-4">Subject</th>
                        <th className="py-2.5 px-4 text-right">Attended</th>
                        <th className="py-2.5 px-4 text-right">Rate</th>
                        <th className="py-2.5 px-4 text-right">Recovery Needed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {data.deficitAlerts.map((item) => (
                        <tr
                          key={`${item.student_id}-${item.subject_code}`}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900">{item.full_name}</p>
                            <p className="text-xs font-mono text-slate-500">{item.student_code}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-slate-800">{item.subject_name}</p>
                            <p className="text-xs font-mono text-slate-500">{item.subject_code}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                            {item.present}/{item.total}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold font-mono text-xs tabular-nums">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {item.percentage}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-medium text-slate-700 tabular-nums">
                            {item.requiredClasses} classes
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent Notices */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-900">College Notices</h2>
                <Link
                  to="/admin/notices"
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  Manage
                </Link>
              </div>
              <div className="divide-y divide-slate-100 flex-1">
                {data.notices.map((n) => (
                  <div key={n.id} className="p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span
                        className={
                          n.category === 'Urgent'
                            ? 'font-semibold text-red-700'
                            : 'font-medium text-slate-700'
                        }
                      >
                        {n.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">Audience: {n.target_role}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {new Date(n.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Recent Attendance Sessions */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Recent Lecture Sessions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Instructor</th>
                    <th className="py-2.5 px-4">Topic</th>
                    <th className="py-2.5 px-4 text-right">Present</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.recentSessions.map((ses) => (
                    <tr key={ses.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {ses.session_date}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {ses.subject_code} · {ses.subject_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{ses.teacher_name}</td>
                      <td className="py-3 px-4 text-slate-600">{ses.topic}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 tabular-nums">
                        {ses.present_count}/{ses.marked_count}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium">
                        <span className={ses.status === 'active' ? 'text-emerald-700' : 'text-slate-600'}>
                          {ses.status === 'active' ? 'Live Active' : 'Closed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
