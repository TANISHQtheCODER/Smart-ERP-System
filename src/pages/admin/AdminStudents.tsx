import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface StudentRow {
  id: number;
  user_id: number;
  student_code: string;
  roll_number: string;
  department_id: number;
  course_id: number;
  semester_id: number;
  batch_year: number;
  email: string;
  full_name: string;
  phone: string;
  is_active: number;
  department_code: string;
  course_code: string;
  semester_label: string;
  division: string;
}

interface AcademicMeta {
  departments: Array<{ id: number; code: string; name: string }>;
  courses: Array<{ id: number; department_id: number; code: string; name: string }>;
  semesters: Array<{ id: number; course_id: number; label: string; division: string }>;
}

export function AdminStudents() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [meta, setMeta] = useState<AcademicMeta>({ departments: [], courses: [], semesters: [] });
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Form state
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [password, setPassword] = useState('password123');
  const [deptId, setDeptId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semId, setSemId] = useState('');
  const [batchYear, setBatchYear] = useState('2026');

  const load = async () => {
    const [stuRes, acadRes] = await Promise.all([
      apiFetch<{ students: StudentRow[] }>('/api/admin/students'),
      apiFetch<AcademicMeta>('/api/admin/academics'),
    ]);
    setStudents(stuRes.students);
    setMeta(acadRes);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load students.'));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setStudentCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setRollNumber('');
    setPassword('password123');
    setDeptId(meta.departments[0] ? String(meta.departments[0].id) : '');
    setCourseId(meta.courses[0] ? String(meta.courses[0].id) : '');
    setSemId(meta.semesters[0] ? String(meta.semesters[0].id) : '');
    setBatchYear('2026');
    setModalOpen(true);
  };

  const openEdit = (s: StudentRow) => {
    setEditing(s);
    setStudentCode(s.student_code);
    setFullName(s.full_name);
    setEmail(s.email);
    setPhone(s.phone || '');
    setRollNumber(s.roll_number);
    setDeptId(String(s.department_id));
    setCourseId(String(s.course_id));
    setSemId(String(s.semester_id));
    setBatchYear(String(s.batch_year));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editing) {
        await apiFetch(`/api/admin/students/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            roll_number: rollNumber,
            department_id: Number(deptId),
            course_id: Number(courseId),
            semester_id: Number(semId),
            batch_year: Number(batchYear),
            is_active: 1,
          }),
        });
        setMessage(`Updated student ${editing.student_code}.`);
      } else {
        const res = await apiFetch<{ student_code: string }>('/api/admin/students', {
          method: 'POST',
          body: JSON.stringify({
            student_code: studentCode || undefined,
            full_name: fullName,
            email,
            phone,
            roll_number: rollNumber || undefined,
            password,
            department_id: Number(deptId),
            course_id: Number(courseId),
            semester_id: Number(semId),
            batch_year: Number(batchYear),
          }),
        });
        setMessage(`Created student account ${res.student_code}.`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleResetPassword = async (s: StudentRow) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/admin/users/${s.user_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: 'password123' }),
      });
      setMessage(`Reset password for ${s.full_name} (${s.student_code}) to "password123".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    }
  };

  const handleDelete = async (s: StudentRow) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/admin/students/${s.id}`, { method: 'DELETE' });
      setMessage(`Removed student ${s.student_code}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.student_code.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q);
    const matchesDept = !deptFilter || String(s.department_id) === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <AppShell
      title="Student Directory"
      breadcrumb="Administration"
      action={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Student</span>
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

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student ID, name, roll number, or email..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg"
          >
            <option value="">All Departments</option>
            {meta.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Student ID</th>
                  <th className="py-2.5 px-4">Name & Email</th>
                  <th className="py-2.5 px-4">Roll No.</th>
                  <th className="py-2.5 px-4">Program</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No student records match your filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {s.student_code}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{s.full_name}</p>
                        <p className="text-xs text-slate-500">{s.email}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{s.roll_number}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {s.department_code} · {s.course_code} · {s.semester_label} Div {s.division}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 rounded cursor-pointer"
                          title="Edit student"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(s)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 rounded cursor-pointer"
                          title="Reset password to password123"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="p-1.5 text-slate-500 hover:text-red-700 rounded cursor-pointer"
                          title="Delete student"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? `Edit Student ${editing.student_code}` : 'Register New Student'}
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
                      Student ID (blank = auto)
                    </label>
                    <input
                      type="text"
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      placeholder="Auto STU-2026-NNN"
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
                  <label className="block text-xs font-medium text-slate-700">Roll Number</label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. CS24-007"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
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
                  <label className="block text-xs font-medium text-slate-700">Department</label>
                  <select
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {meta.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Course</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {meta.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Semester & Div</label>
                  <select
                    value={semId}
                    onChange={(e) => setSemId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {meta.semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} Div {s.division}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Batch Year</label>
                  <input
                    type="number"
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
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
                  {editing ? 'Save Changes' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
