import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface LeaveRow {
  id: number;
  student_code: string;
  student_name: string;
  subject_code: string | null;
  subject_name: string | null;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string;
  created_at: string;
}

export function TeacherLeaves() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await apiFetch<{ leaves: LeaveRow[] }>('/api/teacher/leaves');
    setLeaves(res.leaves);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const decide = async (id: number, status: 'approved' | 'rejected') => {
    await apiFetch(`/api/teacher/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, review_note: notes[id] || '' }),
    });
    await load();
  };

  return (
    <AppShell title="Student Leave Approvals" breadcrumb="Faculty Portal">
      {loading ? (
        <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : leaves.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
          No leave requests submitted for your subjects.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {leaves.map((l) => (
            <div key={l.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">{l.student_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{l.student_code}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {l.subject_code ? `${l.subject_code} (${l.subject_name})` : 'General Leave'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {l.from_date} to {l.to_date}
                  </span>
                </div>
                <p className="text-sm text-slate-800">{l.reason}</p>
                {l.review_note && (
                  <p className="text-xs text-slate-500">Review note: {l.review_note}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                {l.status === 'pending' ? (
                  <>
                    <input
                      type="text"
                      value={notes[l.id] || ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [l.id]: e.target.value }))}
                      placeholder="Optional note"
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => decide(l.id, 'approved')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(l.id, 'rejected')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                ) : (
                  <span
                    className={`text-xs font-semibold capitalize ${
                      l.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {l.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
