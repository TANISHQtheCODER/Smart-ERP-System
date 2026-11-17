import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, QrCode } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface SubjectMetric {
  id: number;
  code: string;
  name: string;
  credits: number;
  lecture_duration_minutes: number;
  teacher_name: string | null;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  belowThreshold: boolean;
  requiredClasses: number;
  requiredHours: number;
  safeMargin: number;
}

interface StudentDashboardData {
  student: {
    student_code: string;
    roll_number: string;
    department_name: string;
    course_name: string;
    semester_label: string;
    division: string;
  };
  overall: {
    present: number;
    absent: number;
    total: number;
    percentage: number;
    belowThreshold: boolean;
    requiredClasses: number;
  };
  subjects: SubjectMetric[];
  warnings: SubjectMetric[];
  notices: Array<{
    id: number;
    title: string;
    category: string;
    published_at: string;
  }>;
  timetable: Array<{
    id: number;
    day_of_week: string;
    start_time: string;
    end_time: string;
    room: string;
    subject_code: string;
    subject_name: string;
  }>;
}

export function StudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<StudentDashboardData>('/api/student/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Student Dashboard"
      breadcrumb="Student Portal"
      action={
        <Link
          to="/student/scan"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>Scan QR Attendance</span>
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* 75% Warning Notification Banner */}
          {data.warnings.length > 0 ? (
            <section
              role="alert"
              className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-red-900">
                    Attendance Alert: {data.warnings.length} subject(s) below the 75% minimum
                  </h2>
                  <p className="text-xs text-red-800">
                    Attend all upcoming consecutive classes without additional absences to restore
                    exam eligibility.
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {data.warnings.map((w) => (
                  <div
                    key={w.id}
                    className="bg-white border border-red-200 rounded-lg p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {w.code} · {w.name}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        {w.present} present / {w.total} conducted ({w.percentage}%)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-700 tabular-nums">
                        {w.requiredClasses} more classes
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {w.requiredHours} hrs required
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
              <p className="text-sm font-medium text-emerald-900">
                All enrolled subjects meet or exceed the 75% attendance requirement.
              </p>
            </section>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Overall Attendance</p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${
                  data.overall.belowThreshold ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {data.overall.percentage}%
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {data.overall.present} present of {data.overall.total} classes
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Enrolled Subjects</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.subjects.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.student.semester_label} Div {data.student.division}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Subjects Below 75%</p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${
                  data.warnings.length > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {data.warnings.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.warnings.length > 0 ? 'Immediate focus required' : 'Good standing'}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Student Roll No.</p>
              <p className="mt-2 text-xl font-bold font-mono text-slate-900 tabular-nums">
                {data.student.roll_number}
              </p>
              <p className="mt-1 text-xs text-slate-500 truncate">{data.student.course_name}</p>
            </div>
          </div>

          {/* Subject-wise Attendance Breakdown */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Subject-Wise Attendance</h2>
              <Link to="/student/attendance" className="text-xs font-medium text-blue-700 hover:underline">
                View detailed history
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.subjects.map((sub) => (
                <div key={sub.id} className="p-5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {sub.code} · {sub.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sub.teacher_name || 'Faculty assigned'} · {sub.present} Present ·{' '}
                        {sub.absent} Absent · {sub.total} Conducted
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span
                        className={`text-base font-bold font-mono tabular-nums ${
                          sub.belowThreshold ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {sub.percentage}%
                      </span>
                      <p className="text-xs text-slate-600 tabular-nums">
                        {sub.belowThreshold
                          ? `Attend next ${sub.requiredClasses} classes (${sub.requiredHours} hrs) to reach 75%`
                          : sub.safeMargin > 0
                          ? `On track · Can miss up to ${sub.safeMargin} class(es)`
                          : 'On track · Exactly at threshold'}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sub.belowThreshold ? 'bg-red-600' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, sub.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Timetable Preview */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Weekly Classes</h2>
                <Link to="/student/timetable" className="text-xs font-medium text-blue-700 hover:underline">
                  Full timetable
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {data.timetable.slice(0, 5).map((slot) => (
                  <div key={slot.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {slot.subject_code} · {slot.subject_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {slot.day_of_week} · {slot.start_time} – {slot.end_time}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-700">{slot.room}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* College Notices */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Recent Notices</h2>
                <Link to="/student/notices" className="text-xs font-medium text-blue-700 hover:underline">
                  All notices
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {data.notices.map((n) => (
                  <div key={n.id} className="px-5 py-3.5 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span
                        className={
                          n.category === 'Urgent'
                            ? 'font-semibold text-red-700'
                            : 'font-semibold text-slate-700'
                        }
                      >
                        {n.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(n.published_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
