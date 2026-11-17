import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch, downloadCsv } from '../../lib/api';

interface ReportRow {
  student_code: string;
  roll_number: string;
  student_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  belowThreshold: boolean;
  requiredClasses: number;
}

export function AdminAttendance() {
  const [report, setReport] = useState<ReportRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [onlyDeficit, setOnlyDeficit] = useState(false);

  const load = async (subId = '') => {
    const query = subId ? `?subjectId=${subId}` : '';
    const [repRes, subRes] = await Promise.all([
      apiFetch<{ report: ReportRow[] }>(`/api/admin/attendance/report${query}`),
      apiFetch<{ subjects: Array<{ id: number; code: string; name: string }> }>('/api/admin/subjects'),
    ]);
    setReport(repRes.report);
    setSubjects(subRes.subjects);
  };

  useEffect(() => {
    load(subjectFilter).catch(() => {});
  }, [subjectFilter]);

  const filtered = report.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.student_name.toLowerCase().includes(q) ||
      r.student_code.toLowerCase().includes(q) ||
      r.subject_code.toLowerCase().includes(q);
    const matchesDeficit = !onlyDeficit || r.belowThreshold;
    return matchesSearch && matchesDeficit;
  });

  const handleExport = () => {
    const query = subjectFilter ? `?subjectId=${subjectFilter}&format=csv` : '?format=csv';
    downloadCsv(`/api/admin/attendance/report${query}`, 'smart_erp_attendance_report.csv');
  };

  return (
    <AppShell
      title="Attendance Records & Reports"
      breadcrumb="Administration"
      action={
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download CSV</span>
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by student name, ID, or subject code..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg"
            />
          </div>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyDeficit}
              onChange={(e) => setOnlyDeficit(e.target.checked)}
              className="rounded border-slate-300 text-red-600"
            />
            <span>Below 75% only</span>
          </label>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4 text-right">Present</th>
                  <th className="py-2.5 px-4 text-right">Absent</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Rate</th>
                  <th className="py-2.5 px-4 text-right">Status / Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((r) => (
                  <tr key={`${r.student_code}-${r.subject_id}`} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{r.student_name}</p>
                      <p className="text-xs font-mono text-slate-500">{r.student_code}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800">{r.subject_name}</p>
                      <p className="text-xs font-mono text-slate-500">{r.subject_code}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {r.present}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {r.absent}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {r.total}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                      <span className={r.belowThreshold ? 'text-red-700' : 'text-emerald-700'}>
                        {r.percentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-xs">
                      {r.belowThreshold ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium tabular-nums">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Need {r.requiredClasses} more
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Nominal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
