import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin', id: 'ADM-001', name: 'Dr. Eleanor Vance', pass: 'password123' },
  { role: 'Teacher', id: 'TCH-101', name: 'Prof. Priya Nair', pass: 'password123' },
  { role: 'Student', id: 'STU-2026-001', name: 'Aarav Mehta', pass: 'password123' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const nextUrl = params.get('next');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(identifier, password);
      if (nextUrl) {
        navigate(nextUrl, { replace: true });
      } else {
        navigate(`/${user.role}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (id: string, pass: string) => {
    setIdentifier(id);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-2 items-stretch">
      {/* Left Institutional Showcase Panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-slate-900 overflow-hidden">
        <img
          src="/src/assets/images/campus_login_backdrop_1794899749446.jpg"
          alt="University engineering campus courtyard"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/30"
          aria-hidden="true"
        />
        <div className="relative z-10 p-10">
          <span className="text-lg font-bold tracking-tight text-white">Smart ERP</span>
        </div>

        <div className="relative z-10 p-10 max-w-xl space-y-4">
          <h2
            className="text-3xl font-bold tracking-tight text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Unified academic records and QR-verified classroom attendance.
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            Built for administrators, faculty, and students. Generate rotating classroom QR sessions,
            verify enrollment in real time, and track 75% attendance eligibility automatically.
          </p>
          <div className="pt-2 flex items-center gap-4 text-xs text-slate-300">
            <span>Role-based Portals</span>
            <span aria-hidden="true">·</span>
            <span>Expiring QR Tokens</span>
            <span aria-hidden="true">·</span>
            <span>75% Deficit Calculator</span>
          </div>
        </div>
      </div>

      {/* Right Sign-In Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-white">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-700 lg:hidden">Smart ERP</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign in to your portal
            </h1>
            <p className="text-sm text-slate-600">
              Enter your institutional ID or registered email address.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">
                Login ID or Email
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. STU-2026-001 or name@smarterp.edu"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
            >
              <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Demo Access Helper */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              <span>Demo accounts (password: password123)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => fillDemo(acc.id, acc.pass)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold text-slate-900">{acc.role}</p>
                  <p className="text-xs font-mono text-slate-600 truncate">{acc.id}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
