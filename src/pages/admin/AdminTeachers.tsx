import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface TeacherRow {
  id: number;
  user_id: number;
  teacher_code: string;
  department_id: number;
  designation: string;
  specialization: string;
  email: string;
  full_name: string;
  phone: string;
  department_code: string;
  department_name: string;
}

export function AdminTeachers() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [teacherCode, setTeacherCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('password123');
  const [deptId, setDeptId] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [specialization, setSpecialization] = useState('');

  const load = async () => {
    const [tRes, acadRes] = await Promise.all([
      apiFetch<{ teachers: TeacherRow[] }>('/api/admin/teachers'),
      apiFetch<{ departments: Array<{ id: number; code: string; name: string }> }>('/api/admin/academics'),
    ]);
    setTeachers(tRes.teachers);
    setDepartments(acadRes.departments);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load teachers.'));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setTeacherCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('password123');
    setDeptId(departments[0] ? String(departments[0].id) : '');
    setDesignation('Assistant Professor');
    setSpecialization('');
    setModalOpen(true);
  };

  const openEdit = (t: TeacherRow) => {
    setEditing(t);
    setTeacherCode(t.teacher_code);
    setFullName(t.full_name);
    setEmail(t.email);
    setPhone(t.phone || '');
    setDeptId(String(t.department_id));
    setDesignation(t.designation);
    setSpecialization(t.specialization || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editing) {
        await apiFetch(`/api/admin/teachers/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            department_id: Number(deptId),
            designation,
            specialization,
            is_active: 1,
          }),
        });
        setMessage(`Updated faculty profile ${editing.teacher_code}.`);
      } else {
        const res = await apiFetch<{ teacher_code: string }>('/api/admin/teachers', {
          method: 'POST',
          body: JSON.stringify({
            teacher_code: teacherCode || undefined,
            full_name: fullName,
            email,
            phone,
            password,
            department_id: Number(deptId),
            designation,
            specialization,
          }),
        });
        setMessage(`Created faculty account ${res.teacher_code}.`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleResetPassword = async (t: TeacherRow) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/admin/users/${t.user_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: 'password123' }),
      });
      setMessage(`Reset password for ${t.full_name} (${t.teacher_code}) to "password123".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    }
  };

  const handleDelete = async (t: TeacherRow) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/admin/teachers/${t.id}`, { method: 'DELETE' });
      setMessage(`Removed faculty member ${t.teacher_code}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      t.full_name.toLowerCase().includes(q) ||
      t.teacher_code.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell
      title="Faculty Directory"
      breadcrumb="Administration"
      action={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Teacher</span>
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <div className="relative max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teachers by ID, name, or email..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Teacher ID</th>
                  <th className="py-2.5 px-4">Name & Email</th>
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4">Designation & Specialization</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                      {t.teacher_code}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{t.full_name}</p>
                      <p className="text-xs text-slate-500">{t.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{t.department_code}</td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800">{t.designation}</p>
                      <p className="text-xs text-slate-500">{t.specialization || 'General'}</p>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 rounded cursor-pointer"
                        title="Edit teacher"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(t)}
                        className="p-1.5 text-slate-500 hover:text-amber-700 rounded cursor-pointer"
                        title="Reset password to password123"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="p-1.5 text-slate-500 hover:text-red-700 rounded cursor-pointer"
                        title="Delete teacher"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? `Edit Teacher ${editing.teacher_code}` : 'Register Faculty Member'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Teacher ID (blank = auto)
                    </label>
                    <input
                      type="text"
                      value={teacherCode}
                      onChange={(e) => setTeacherCode(e.target.value)}
                      placeholder="Auto TCH-103"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">Initial Password</label>
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Department</label>
                  <select
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
                >
                  {editing ? 'Save Changes' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
