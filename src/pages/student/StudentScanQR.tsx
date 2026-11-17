import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle2, KeyRound, StopCircle, AlertTriangle } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface ConfirmationDetails {
  subject_code: string;
  subject_name: string;
  teacher_name: string;
  topic: string;
  session_date: string;
  marked_at: string;
}

export function StudentScanQR() {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [scanning, setScanning] = useState(false);
  const [rawToken, setRawToken] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationDetails | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'smart-erp-qr-reader';

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const verifyAttendance = async (scannedValue: string, pinOverride?: string) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch<{ message: string; details: ConfirmationDetails }>(
        '/api/student/attendance/scan',
        {
          method: 'POST',
          body: JSON.stringify({
            rawToken: scannedValue,
            room_code: pinOverride ?? roomCode,
          }),
        }
      );
      setConfirmation(res.details);
      setRequiresPin(false);
      await stopCamera();
    } catch (err) {
      const typed = err as Error & { payload?: { requiresRoomCode?: boolean } };
      if (typed.payload?.requiresRoomCode) {
        setRawToken(scannedValue);
        setRequiresPin(true);
        setMode('manual');
        await stopCamera();
      }
      setError(typed.message || 'Could not mark attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const startCamera = async () => {
    setError('');
    setConfirmation(null);
    try {
      await stopCamera();
      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;
      setScanning(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          verifyAttendance(decodedText);
        },
        () => {
          // Ignore frame decode misses
        }
      );
    } catch (err) {
      setScanning(false);
      setError(
        err instanceof Error
          ? `Camera unavailable (${err.message}). Use the "Paste QR Link / Token" option below.`
          : 'Camera permission denied. Use the manual token option.'
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAttendance(rawToken, roomCode);
  };

  return (
    <AppShell title="Scan Lecture QR Code" breadcrumb="Student Portal">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
              mode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setMode('manual');
            }}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
              mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Paste QR Link / Token
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {confirmation && (
          <div className="bg-white border border-emerald-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="h-7 w-7 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Attendance Marked Present</h2>
                <p className="text-xs text-slate-600">Verified by server timestamp & enrollment</p>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subject</span>
                <span className="font-semibold text-slate-900">
                  {confirmation.subject_code} · {confirmation.subject_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Instructor</span>
                <span className="text-slate-800">{confirmation.teacher_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lecture Topic</span>
                <span className="text-slate-800">{confirmation.topic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Marked At</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {new Date(confirmation.marked_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'camera' && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">Mobile & Webcam QR Scanner</h2>
              <p className="text-xs text-slate-600">
                Point your camera at the QR code projected by your teacher in the classroom.
              </p>
            </div>

            <div
              id={readerElementId}
              className="w-full min-h-[260px] bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center text-xs text-slate-500"
            >
              {!scanning && 'Camera preview inactive'}
            </div>

            <div className="flex gap-3">
              {!scanning ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer min-h-[44px]"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Camera Scan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer min-h-[44px]"
                >
                  <StopCircle className="h-4 w-4" />
                  <span>Stop Camera</span>
                </button>
              )}
            </div>
          </section>
        )}

        {mode === 'manual' && (
          <form
            onSubmit={handleManualSubmit}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                Verify via QR Link or Session Token
              </h2>
              <p className="text-xs text-slate-600">
                Paste the QR session URL or token provided on the classroom screen.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                QR URL or Session Token
              </label>
              <input
                type="text"
                required
                value={rawToken}
                onChange={(e) => setRawToken(e.target.value)}
                placeholder="https://.../scan/<token> or hex token"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Classroom PIN {requiresPin ? '(Required by instructor)' : '(If set by instructor)'}
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required={requiresPin}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="Optional 4-digit PIN"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer min-h-[44px]"
            >
              {submitting ? 'Verifying...' : 'Mark Attendance Present'}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
