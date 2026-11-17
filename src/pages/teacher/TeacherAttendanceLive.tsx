import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Copy,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface TeacherSubject {
  id: number;
  code: string;
  name: string;
  semester_label: string;
  division: string;
}

interface RosterStudent {
  student_id: number;
  student_code: string;
  roll_number: string;
  full_name: string;
  record_id: number | null;
  record_status: 'present' | 'absent' | null;
  marked_method: string | null;
  marked_at: string | null;
}

interface AuditEntry {
  id: number;
  student_code: string;
  student_name: string;
  previous_status: string;
  new_status: string;
  changed_by_name: string;
  reason: string;
  changed_at: string;
}

interface SessionDetailResponse {
  session: {
    id: number;
    subject_id: number;
    subject_code: string;
    subject_name: string;
    token: string;
    room_code: string;
    topic: string;
    session_date: string;
    duration_seconds: number;
    expires_at: string;
    status: 'active' | 'closed';
  };
  qrUrl: string;
  roster: RosterStudent[];
  auditLogs: AuditEntry[];
}

export function TeacherAttendanceLive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSessionId = searchParams.get('sessionId');
  const initialSubjectId = searchParams.get('subjectId');

  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [subjectId, setSubjectId] = useState(initialSubjectId || '');
  const [topic, setTopic] = useState('Regular Classroom Lecture');
  const [durationSec, setDurationSec] = useState('60');
  const [roomCode, setRoomCode] = useState('');

  const [sessionId, setSessionId] = useState<number | null>(
    initialSessionId ? Number(initialSessionId) : null
  );
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Manual correction reason input
  const [correctionReason, setCorrectionReason] = useState('Verified physically in classroom');

  useEffect(() => {
    apiFetch<{ subjects: TeacherSubject[] }>('/api/teacher/subjects').then((res) => {
      setSubjects(res.subjects);
      if (!subjectId && res.subjects[0]) {
        setSubjectId(String(res.subjects[0].id));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSessionDetail = useCallback(async (id: number) => {
    const res = await apiFetch<SessionDetailResponse>(`/api/teacher/sessions/${id}`);
    setDetail(res);
    const dataUrl = await QRCode.toDataURL(res.qrUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    setQrDataUrl(dataUrl);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionDetail(sessionId).catch((err) =>
      setError(err instanceof Error ? err.message : 'Unable to load session.')
    );

    const poll = setInterval(() => {
      fetchSessionDetail(sessionId).catch(() => {});
    }, 2500);
    return () => clearInterval(poll);
  }, [sessionId, fetchSessionDetail]);

  const handleRegenerate = useCallback(async () => {
    if (!sessionId) return;
    setError('');
    try {
      await apiFetch(`/api/teacher/sessions/${sessionId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ duration_seconds: Number(durationSec) || 60 }),
      });
      await fetchSessionDetail(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate QR.');
    }
  }, [sessionId, durationSec, fetchSessionDetail]);

  // Countdown timer + optional auto-rotate
  useEffect(() => {
    if (!detail || detail.session.status !== 'active') {
      setSecondsLeft(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(
        0,
        Math.ceil((new Date(detail.session.expires_at).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
      if (diff === 0 && autoRotate) {
        handleRegenerate();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [detail, autoRotate, handleRegenerate]);

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ sessionId: number }>('/api/teacher/sessions', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: Number(subjectId),
          duration_seconds: Number(durationSec) || 60,
          topic,
          room_code: roomCode,
        }),
      });
      setSessionId(res.sessionId);
      setSearchParams({ sessionId: String(res.sessionId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start attendance session.');
    }
  };

  const closeSession = async () => {
    if (!sessionId) return;
    await apiFetch(`/api/teacher/sessions/${sessionId}/close`, { method: 'POST' });
    await fetchSessionDetail(sessionId);
  };

  const markManual = async (studentId: number, status: 'present' | 'absent') => {
    if (!sessionId) return;
    await apiFetch(`/api/teacher/sessions/${sessionId}/mark`, {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        status,
        reason: correctionReason,
      }),
    });
    await fetchSessionDetail(sessionId);
  };

  const copyLink = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presentCount = detail?.roster.filter((r) => r.record_status === 'present').length || 0;

  return (
    <AppShell
      title="QR Attendance Session"
      breadcrumb="Faculty Portal"
      action={
        detail?.session.status === 'active' ? (
          <button
            type="button"
            onClick={closeSession}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Close & Finalize Session</span>
          </button>
        ) : null
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {!sessionId || !detail ? (
          <form
            onSubmit={startSession}
            className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Start Lecture QR Session</h2>
              <p className="text-sm text-slate-600">
                Generate a cryptographically random, time-limited QR code for students in the
                classroom.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Assigned Subject</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.semester_label} Div {s.division})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Lecture Topic</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Deadlock Prevention & Recovery"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  QR Code Expiry Window
                </label>
                <select
                  value={durationSec}
                  onChange={(e) => setDurationSec(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="30">30 seconds (High Security)</option>
                  <option value="45">45 seconds</option>
                  <option value="60">60 seconds (Recommended)</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Classroom PIN (Optional)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="e.g. 4820 (prevents remote sharing)"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!subjectId}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              Generate Live QR Code
            </button>
          </form>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Left QR Projector Column */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {detail.session.subject_code} · {detail.session.session_date}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">
                    {detail.session.subject_name}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">{detail.session.topic}</p>
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    detail.session.status === 'active'
                      ? secondsLeft > 0
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                      : 'text-slate-600'
                  }`}
                >
                  {detail.session.status === 'closed'
                    ? 'Closed'
                    : secondsLeft > 0
                    ? `Expires in ${secondsLeft}s`
                    : 'QR Expired'}
                </span>
              </div>

              {detail.session.status === 'active' ? (
                <>
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="Classroom attendance QR code"
                        className={`w-64 h-64 rounded-lg transition-opacity ${
                          secondsLeft === 0 ? 'opacity-25' : 'opacity-100'
                        }`}
                      />
                    )}
                    {secondsLeft === 0 && (
                      <p className="mt-2 text-xs font-semibold text-red-700">
                        This QR code has expired. Click Regenerate QR below.
                      </p>
                    )}
                    {detail.session.room_code && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-blue-700" />
                        <span>Classroom PIN:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {detail.session.room_code}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Countdown Progress */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        secondsLeft <= 10 ? 'bg-red-600' : 'bg-blue-700'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((secondsLeft / detail.session.duration_seconds) * 100)
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Regenerate QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copied ? 'Copied URL' : 'Copy QR Link'}</span>
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoRotate}
                      onChange={(e) => setAutoRotate(e.target.checked)}
                      className="rounded border-slate-300 text-blue-700"
                    />
                    <span>Auto-rotate QR token immediately upon expiry (anti-sharing)</span>
                  </label>

                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 break-all">
                    <span className="font-medium text-slate-700">Session Token: </span>
                    <span className="font-mono">{detail.session.token}</span>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 space-y-3">
                  <p>
                    This session is closed. Unmarked students were automatically finalized as
                    absent.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionId(null);
                      setDetail(null);
                      setSearchParams({});
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Start Another Session
                  </button>
                </div>
              )}
            </section>

            {/* Right Live Roster & Audit Trail */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Live Attendance Roster
                    </h3>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {presentCount} of {detail.roster.length} enrolled students marked Present
                      (updates automatically)
                    </p>
                  </div>
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Audit reason for manual changes"
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-56"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-2.5 px-4">Student</th>
                        <th className="py-2.5 px-4">Method</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Manual Correction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {detail.roster.map((st) => (
                        <tr key={st.student_id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900">{st.full_name}</p>
                            <p className="text-xs font-mono text-slate-500">{st.student_code}</p>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {st.marked_method === 'qr_scan'
                              ? 'QR Scan'
                              : st.marked_method === 'manual'
                              ? 'Manual'
                              : 'Waiting'}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            {st.record_status === 'present' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Present
                              </span>
                            ) : st.record_status === 'absent' ? (
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <XCircle className="h-3.5 w-3.5" />
                                Absent
                              </span>
                            ) : (
                              <span className="text-slate-400">Unmarked</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => markManual(st.student_id, 'present')}
                              className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer ${
                                st.record_status === 'present'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => markManual(st.student_id, 'absent')}
                              className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer ${
                                st.record_status === 'absent'
                                  ? 'bg-red-50 border-red-200 text-red-800'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              Absent
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {detail.auditLogs.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Manual Correction Audit Log
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {detail.auditLogs.map((log) => (
                      <div key={log.id} className="px-5 py-3 flex flex-wrap justify-between gap-2">
                        <div>
                          <span className="font-semibold text-slate-900">{log.student_name}</span>{' '}
                          <span className="text-slate-500">
                            changed from <span className="font-mono">{log.previous_status}</span> to{' '}
                            <span className="font-mono font-semibold text-slate-800">
                              {log.new_status}
                            </span>
                          </span>
                          {log.reason && (
                            <p className="text-slate-500 mt-0.5">Reason: {log.reason}</p>
                          )}
                        </div>
                        <div className="text-right text-slate-500">
                          <p>{log.changed_by_name}</p>
                          <p className="font-mono tabular-nums">
                            {new Date(log.changed_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
