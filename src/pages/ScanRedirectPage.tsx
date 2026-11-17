import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface ScanDetails {
  subject_code: string;
  subject_name: string;
  teacher_name: string;
  topic: string;
  session_date: string;
  marked_at: string;
}

export function ScanRedirectPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'verifying' | 'pin' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<ScanDetails | null>(null);
  const [pin, setPin] = useState('');

  const submitScan = async (roomCode?: string) => {
    if (!token) return;
    setStatus('verifying');
    try {
      const res = await apiFetch<{ message: string; details: ScanDetails }>(
        '/api/student/attendance/scan',
        {
          method: 'POST',
          body: JSON.stringify({ rawToken: token, room_code: roomCode }),
        }
      );
      setDetails(res.details);
      setMessage(res.message);
      setStatus('success');
    } catch (err) {
      const typed = err as Error & { payload?: { requiresRoomCode?: boolean } };
      if (typed.payload?.requiresRoomCode) {
        setMessage(typed.message);
        setStatus('pin');
      } else {
        setMessage(typed.message || 'Verification failed.');
        setStatus('error');
      }
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/scan/${token || ''}`)}`, { replace: true });
      return;
    }
    if (user.role !== 'student') {
      setStatus('error');
      setMessage('Only authenticated students can mark QR attendance.');
      return;
    }
    submitScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitScan(pin);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-5">
        {status === 'verifying' && (
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <Loader2 className="h-8 w-8 text-blue-700 animate-spin" />
            <h1 className="text-lg font-semibold text-slate-900">Verifying attendance session</h1>
            <p className="text-sm text-slate-600">Checking token expiry and subject enrollment...</p>
          </div>
        )}

        {status === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-900">Enter Classroom PIN</h1>
            <p className="text-sm text-slate-600">{message}</p>
            <input
              type="text"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit classroom PIN"
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
            >
              Confirm & Mark Present
            </button>
          </form>
        )}

        {status === 'success' && details && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="h-7 w-7 shrink-0" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">Attendance Marked Present</h1>
                <p className="text-xs text-slate-600">{message}</p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subject</span>
                <span className="font-medium text-slate-900">
                  {details.subject_code} · {details.subject_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Instructor</span>
                <span className="text-slate-900">{details.teacher_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Topic</span>
                <span className="text-slate-900">{details.topic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recorded At</span>
                <span className="font-mono text-xs text-slate-700">
                  {new Date(details.marked_at).toLocaleString()}
                </span>
              </div>
            </div>
            <Link
              to="/student"
              className="block w-full text-center py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold"
            >
              Go to Student Dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-red-700">
              <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Attendance Not Marked</h1>
                <p className="text-sm text-slate-600 mt-1">{message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                to={user ? `/${user.role}` : '/login'}
                className="flex-1 text-center py-2.5 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
              >
                Back to Dashboard
              </Link>
              {user?.role === 'student' && (
                <Link
                  to="/student/scan"
                  className="flex-1 text-center py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium"
                >
                  Open Scanner
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
