import React, { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [details, setDetails] = useState<Record<string, string | number>>({});
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  useEffect(() => {
    apiFetch<{ user: typeof user; details: Record<string, string | number> }>('/api/profile')
      .then((res) => {
        setDetails(res.details || {});
        if (res.user) {
          setFullName(res.user.full_name);
          setPhone(res.user.phone || '');
        }
      })
      .catch(() => {});
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      await refreshUser();
      setProfileMsg('Profile details saved.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    setPassErr('');
    try {
      const res = await apiFetch<{ message: string }>('/api/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setPassMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : 'Failed to change password.');
    }
  };

  if (!user) return null;

  return (
    <AppShell title="Profile & Security" breadcrumb="Account">
      <div className="space-y-6 max-w-4xl">
        {/* Identity Summary */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar src={user.avatar_url} name={user.full_name} size="lg" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">{user.full_name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-mono text-slate-800">{user.login_id}</span>
              <span aria-hidden="true">·</span>
              <span>{user.email}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{user.role}</span>
            </div>
            {details.department_name && (
              <p className="text-xs text-slate-500 pt-1">
                {String(details.department_name)}
                {details.course_name ? ` · ${String(details.course_name)}` : ''}
                {details.semester_label ? ` · ${String(details.semester_label)} Div ${String(details.division)}` : ''}
                {details.designation ? ` · ${String(details.designation)}` : ''}
              </p>
            )}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Edit Contact */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Contact Details</h3>
            {profileMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {profileMsg}
              </div>
            )}
            {profileErr && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {profileErr}
              </div>
            )}
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Save changes
              </button>
            </form>
          </section>

          {/* Change Password */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
            {passMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {passMsg}
              </div>
            )}
            {passErr && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {passErr}
              </div>
            )}
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Update password
              </button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
