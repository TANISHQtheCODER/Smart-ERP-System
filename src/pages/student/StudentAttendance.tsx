import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface SubjectSummary {
  id: number;
  code: string;
  name: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  belowThreshold: boolean;
  requiredClasses: number;
  requiredHours: number;
}

interface AttendanceRecord {
  id: number;
  status: 'present' | 'absent';
  marked_method: 'qr_scan' | 'manual';
  marked_at: string;
  session_date: string;
  topic: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
}

export function StudentAttendance() {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ subjects: SubjectSummary[] }>('/api/student/dashboard'),
      apiFetch<{ records: AttendanceRecord[] }>('/api/student/attendance/history'),
    ])
      .then(([dash, hist]) => {
        setSubjects(dash.subjects);
        setRecords(hist.records);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = records.filter((r) => {
    const matchSub = !subjectFilter || String(r.subject_id) === subjectFilter;
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSub && matchStatus;
  });

  return (
    <AppShell title="My Attendance & 75% Calculator" breadcrumb="Student Portal">
      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-6">
          {/* Subject Summary Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Subject-Wise Attendance & 75% Target Calculation
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4 text-right">Present</th>
                    <th className="py-2.5 px-4 text-right">Absent</th>
                    <th className="py-2.5 px-4 text-right">Conducted</th>
                    <th className="py-2.5 px-4 text-right">Percentage</th>
                    <th className="py-2.5 px-4 text-right">Future Classes Needed (75%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {s.code} · {s.name}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {s.present}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {s.absent}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {s.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-bold tabular-nums">
                        <span className={s.belowThreshold ? 'text-red-700' : 'text-emerald-700'}>
                          {s.percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-xs tabular-nums">
                        {s.belowThreshold ? (
                          <span className="font-semibold text-red-700">
                            {s.requiredClasses} consecutive classes ({s.requiredHours} hrs)
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">75% target met</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Lecture History Log */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Lecture Attendance History</h2>
              <div className="flex gap-2">
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 sticky top-0">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Topic</th>
                    <th className="py-2.5 px-4">Method</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {r.session_date}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {r.subject_code} · {r.subject_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{r.topic}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-500">
                        {r.marked_method === 'qr_scan' ? 'QR Scan' : 'Manual'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs font-semibold">
                        {r.status === 'present' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <XCircle className="h-3.5 w-3.5" />
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
