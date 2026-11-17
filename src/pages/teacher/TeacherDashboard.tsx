import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, QrCode } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface TeacherDashboardData {
  subjects: Array<{
    id: number;
    code: string;
    name: string;
    semester_label: string;
    division: string;
    enrolled_count: number;
    sessions_count: number;
  }>;
  activeSession: {
    id: number;
    subject_code: string;
    subject_name: string;
    topic: string;
    expires_at: string;
  } | null;
  recentSessions: Array<{
    id: number;
    session_date: string;
    topic: string;
    status: string;
    subject_code: string;
    subject_name: string;
    total_records: number;
    present_count: number;
  }>;
  pendingLeaves: number;
}

export function TeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<TeacherDashboardData>('/api/teacher/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Faculty Overview"
      breadcrumb="Faculty Portal"
      action={
        <Link
          to="/teacher/attendance"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>Start QR Attendance</span>
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {data.activeSession && (
            <div className="bg-white border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-700">Active QR Session Running</p>
                <h2 className="text-base font-semibold text-slate-900">
                  {data.activeSession.subject_code} · {data.activeSession.subject_name}
                </h2>
                <p className="text-xs text-slate-600">{data.activeSession.topic}</p>
              </div>
              <Link
                to={`/teacher/attendance?sessionId=${data.activeSession.id}`}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 text-center"
              >
                Open Live QR Projector
              </Link>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Assigned Subjects</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.subjects.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">Current academic term</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Total Enrolled Students</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.subjects.reduce((sum, s) => sum + s.enrolled_count, 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Across assigned cohorts</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Pending Leave Requests</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.pendingLeaves}
              </p>
              <Link to="/teacher/leaves" className="mt-1 inline-block text-xs text-blue-700 hover:underline">
                Review requests
              </Link>
            </div>
          </div>

          {/* Assigned Subjects */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Assigned Subjects</h2>
              <Link
                to="/teacher/subjects"
                className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
              >
                <span>View rosters</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {sub.code} · {sub.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sub.semester_label} Div {sub.division} · {sub.enrolled_count} students ·{' '}
                      {sub.sessions_count} sessions conducted
                    </p>
                  </div>
                  <Link
                    to={`/teacher/attendance?subjectId=${sub.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Launch Attendance</span>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Sessions */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Recent Attendance Sessions</h2>
              <Link to="/teacher/history" className="text-xs font-medium text-blue-700 hover:underline">
                Full history
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Topic</th>
                    <th className="py-2.5 px-4 text-right">Present</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.recentSessions.map((ses) => (
                    <tr key={ses.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {ses.session_date}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {ses.subject_code} · {ses.subject_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{ses.topic}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 tabular-nums">
                        {ses.present_count}/{ses.total_records}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium">
                        <span className={ses.status === 'active' ? 'text-blue-700' : 'text-slate-600'}>
                          {ses.status === 'active' ? 'Active' : 'Closed'}
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
