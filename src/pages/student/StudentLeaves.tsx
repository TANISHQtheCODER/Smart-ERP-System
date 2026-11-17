import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface LeaveRequest {
  id: number;
  subject_code: string | null;
  subject_name: string | null;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_name: string | null;
  review_note: string;
  created_at: string;
}

export function StudentLeaves() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [subjectId, setSubjectId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [lRes, dRes] = await Promise.all([
      apiFetch<{ leaves: LeaveRequest[] }>('/api/student/leaves'),
      apiFetch<{ subjects: Array<{ id: number; code: string; name: string }> }>(
        '/api/student/dashboard'
      ),
    ]);
    setLeaves(lRes.leaves);
    setSubjects(dRes.subjects);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/student/leaves', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: subjectId || undefined,
          from_date: fromDate,
          to_date: toDate,
          reason,
        }),
      });
      setFromDate('');
      setToDate('');
      setReason('');
      setMessage('Leave request submitted for faculty review.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit leave request.');
    }
  };

  return (
    <AppShell title="Leave Requests" breadcrumb="Student Portal">
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900">Apply for Leave</h2>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {message}
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Subject (Optional)</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Subjects / General Leave</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">From Date</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">To Date</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Reason</label>
            <textarea
              rows={3}
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Medical, official competition, or family emergency details..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
          >
            Submit Leave Request
          </button>
        </form>

        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Submitted Requests</h2>
          </div>
          {leaves.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No leave requests submitted.</p>
          ) : (
            leaves.map((l) => (
              <div key={l.id} className="p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums">
                      {l.from_date} to {l.to_date}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{l.subject_code || 'General Leave'}</span>
                  </div>
                  <p className="text-sm text-slate-900">{l.reason}</p>
                  {l.review_note && (
                    <p className="text-xs text-slate-500">
                      Faculty note ({l.reviewer_name || 'Instructor'}): {l.review_note}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs font-semibold capitalize shrink-0 ${
                    l.status === 'approved'
                      ? 'text-emerald-700'
                      : l.status === 'rejected'
                      ? 'text-red-700'
                      : 'text-amber-700'
                  }`}
                >
                  {l.status}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
