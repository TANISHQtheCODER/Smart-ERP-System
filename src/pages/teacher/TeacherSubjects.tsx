import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch, downloadCsv } from '../../lib/api';

interface SubjectWithRoster {
  id: number;
  code: string;
  name: string;
  credits: number;
  lecture_duration_minutes: number;
  semester_label: string;
  division: string;
  students: Array<{
    id: number;
    student_code: string;
    roll_number: string;
    full_name: string;
    email: string;
    present: number;
    absent: number;
    total: number;
    percentage: number;
    belowThreshold: boolean;
    requiredClasses: number;
  }>;
}

export function TeacherSubjects() {
  const [subjects, setSubjects] = useState<SubjectWithRoster[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ subjects: SubjectWithRoster[] }>('/api/teacher/subjects')
      .then((res) => {
        setSubjects(res.subjects);
        if (res.subjects[0]) setSelectedId(res.subjects[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const current = subjects.find((s) => s.id === selectedId) || null;

  return (
    <AppShell
      title="My Subjects & Student Rosters"
      breadcrumb="Faculty Portal"
      action={
        current ? (
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `/api/teacher/reports/subject/${current.id}?format=csv`,
                `${current.code}_attendance.csv`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Subject CSV</span>
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : subjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
          No subjects are currently assigned to your faculty account.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedId(sub.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  selectedId === sub.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sub.code} · {sub.name}
              </button>
            ))}
          </div>

          {current && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {current.code} · {current.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {current.semester_label} Div {current.division} · {current.credits} Credits ·{' '}
                    {current.lecture_duration_minutes} mins/lecture · {current.students.length}{' '}
                    enrolled
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Student ID</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Roll No.</th>
                      <th className="py-2.5 px-4 text-right">Present / Total</th>
                      <th className="py-2.5 px-4 text-right">Attendance %</th>
                      <th className="py-2.5 px-4 text-right">Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {current.students.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                          {st.student_code}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{st.full_name}</p>
                          <p className="text-xs text-slate-500">{st.email}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">
                          {st.roll_number}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {st.present}/{st.total}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                          <span className={st.belowThreshold ? 'text-red-700' : 'text-emerald-700'}>
                            {st.percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-xs">
                          {st.belowThreshold ? (
                            <span className="inline-flex items-center gap-1 text-red-700 font-medium tabular-nums">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Needs {st.requiredClasses} classes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Eligible
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
