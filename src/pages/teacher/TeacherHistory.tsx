import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface SessionSummary {
  id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  topic: string;
  session_date: string;
  status: 'active' | 'closed';
  enrolled_count: number;
  present_count: number;
  marked_count: number;
}

interface SessionDetail {
  session: {
    id: number;
    subject_code: string;
    subject_name: string;
    topic: string;
    session_date: string;
    status: string;
  };
  roster: Array<{
    student_id: number;
    student_code: string;
    full_name: string;
    record_status: 'present' | 'absent' | null;
    marked_method: string | null;
  }>;
  auditLogs: Array<{
    id: number;
    student_name: string;
    previous_status: string;
    new_status: string;
    changed_by_name: string;
    reason: string;
    changed_at: string;
  }>;
}

export function TeacherHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [reason, setReason] = useState('Post-session attendance correction');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await apiFetch<{ sessions: SessionSummary[] }>('/api/teacher/sessions');
    setSessions(res.sessions);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const inspectSession = async (id: number) => {
    const res = await apiFetch<SessionDetail>(`/api/teacher/sessions/${id}`);
    setSelected(res);
  };

  const correctStatus = async (studentId: number, status: 'present' | 'absent') => {
    if (!selected) return;
    await apiFetch(`/api/teacher/sessions/${selected.session.id}/mark`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, status, reason }),
    });
    await inspectSession(selected.session.id);
    await load();
  };

  return (
    <AppShell title="Attendance Session History" breadcrumb="Faculty Portal">
      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Conducted Sessions</h2>
            </div>
            <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100">
              {sessions.map((ses) => (
                <div
                  key={ses.id}
                  className={`p-4 flex items-center justify-between gap-4 hover:bg-slate-50 ${
                    selected?.session.id === ses.id ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {ses.subject_code} · {ses.subject_name}
                    </p>
                    <p className="text-xs text-slate-600 truncate">{ses.topic}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums">{ses.session_date}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {ses.present_count}/{ses.enrolled_count} present
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{ses.status === 'active' ? 'Live Active' : 'Closed'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ses.status === 'active' && (
                      <Link
                        to={`/teacher/attendance?sessionId=${ses.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold"
                      >
                        Live QR
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => inspectSession(ses.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-white cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {!selected ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Select a lecture session on the left to inspect student attendance records and
                audit logs.
              </div>
            ) : (
              <div>
                <div className="px-5 py-4 border-b border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">
                      {selected.session.subject_code} · {selected.session.session_date}
                    </h3>
                    <span className="text-xs font-medium text-slate-500 capitalize">
                      {selected.session.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{selected.session.topic}</p>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Audit reason for manual edits"
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-2 px-4">Student</th>
                        <th className="py-2 px-4">Status</th>
                        <th className="py-2 px-4 text-right">Correct</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {selected.roster.map((st) => (
                        <tr key={st.student_id}>
                          <td className="py-2.5 px-4">
                            <p className="font-medium text-slate-900">{st.full_name}</p>
                            <p className="text-xs font-mono text-slate-500">{st.student_code}</p>
                          </td>
                          <td className="py-2.5 px-4 text-xs font-semibold">
                            {st.record_status === 'present' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <XCircle className="h-3.5 w-3.5" />
                                {st.record_status === 'absent' ? 'Absent' : 'Unmarked'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => correctStatus(st.student_id, 'present')}
                              className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-emerald-50 cursor-pointer"
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => correctStatus(st.student_id, 'absent')}
                              className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-red-50 cursor-pointer"
                            >
                              Absent
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selected.auditLogs.length > 0 && (
                  <div className="border-t border-slate-200 p-4 space-y-2 bg-slate-50/50">
                    <p className="text-xs font-semibold text-slate-700">Audit Trail</p>
                    {selected.auditLogs.map((log) => (
                      <div key={log.id} className="text-xs text-slate-600">
                        <span className="font-medium text-slate-900">{log.student_name}</span>:{' '}
                        <span className="font-mono">{log.previous_status}</span> →{' '}
                        <span className="font-mono font-semibold">{log.new_status}</span> by{' '}
                        {log.changed_by_name} ({log.reason})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
