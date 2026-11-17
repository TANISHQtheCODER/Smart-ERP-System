import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function ForgotPasswordPage() {
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          login_id: loginId,
          email,
          new_password: newPassword,
        }),
      });
      setSuccess(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="space-y-1.5">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to sign in</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Reset account password</h1>
          <p className="text-sm text-slate-600">
            Verify your institutional Login ID and registered email address to set a new password.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p>{success}</p>
              <Link to="/login" className="inline-block mt-2 font-semibold underline">
                Return to Sign in
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="loginId" className="block text-sm font-medium text-slate-700">
              Login ID
            </label>
            <input
              id="loginId"
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. STU-2026-001"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Registered Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@smarterp.edu"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="newPass" className="block text-sm font-medium text-slate-700">
              New Password
            </label>
            <input
              id="newPass"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {submitting ? 'Updating...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}
