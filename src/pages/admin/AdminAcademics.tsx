import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface Department {
  id: number;
  code: string;
  name: string;
}
interface Course {
  id: number;
  department_id: number;
  code: string;
  name: string;
  duration_years: number;
  department_code: string;
}
interface Semester {
  id: number;
  course_id: number;
  number: number;
  label: string;
  division: string;
  course_code: string;
  course_name: string;
}

export function AdminAcademics() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [tab, setTab] = useState<'departments' | 'courses' | 'semesters'>('departments');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Department form
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');

  // Course form
  const [courseDeptId, setCourseDeptId] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseYears, setCourseYears] = useState('4');

  // Semester form
  const [semCourseId, setSemCourseId] = useState('');
  const [semNumber, setSemNumber] = useState('1');
  const [semLabel, setSemLabel] = useState('');
  const [semDivision, setSemDivision] = useState('A');

  const load = async () => {
    const res = await apiFetch<{
      departments: Department[];
      courses: Course[];
      semesters: Semester[];
    }>('/api/admin/academics');
    setDepartments(res.departments);
    setCourses(res.courses);
    setSemesters(res.semesters);
    if (!courseDeptId && res.departments[0]) setCourseDeptId(String(res.departments[0].id));
    if (!semCourseId && res.courses[0]) setSemCourseId(String(res.courses[0].id));
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/departments', {
        method: 'POST',
        body: JSON.stringify({ code: deptCode, name: deptName }),
      });
      setDeptCode('');
      setDeptName('');
      setMessage('Department added.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add department.');
    }
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify({
          department_id: Number(courseDeptId),
          code: courseCode,
          name: courseName,
          duration_years: Number(courseYears),
        }),
      });
      setCourseCode('');
      setCourseName('');
      setMessage('Course added.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add course.');
    }
  };

  const addSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/semesters', {
        method: 'POST',
        body: JSON.stringify({
          course_id: Number(semCourseId),
          number: Number(semNumber),
          label: semLabel || `Semester ${semNumber}`,
          division: semDivision,
        }),
      });
      setSemLabel('');
      setMessage('Semester & division added.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add semester.');
    }
  };

  const handleDelete = async (endpoint: string) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(endpoint, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item.');
    }
  };

  return (
    <AppShell title="Departments, Courses & Semesters" breadcrumb="Administration">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(['departments', 'courses', 'semesters'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

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

        {tab === 'departments' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={addDepartment}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Add Department</h2>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Department Code</label>
                <input
                  type="text"
                  required
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. MECH"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Mechanical Engineering"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Create Department
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Department Name</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                        {d.code}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{d.name}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(`/api/admin/departments/${d.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          title="Delete department"
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
        )}

        {tab === 'courses' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={addCourse}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Add Course / Program</h2>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Department</label>
                <select
                  value={courseDeptId}
                  onChange={(e) => setCourseDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Course Code</label>
                <input
                  type="text"
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. MTECH-AI"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Course Name</label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. M.Tech Artificial Intelligence"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Duration (Years)</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={courseYears}
                  onChange={(e) => setCourseYears(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Create Course
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Course Name</th>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4 text-right">Duration</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                        {c.code}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{c.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{c.department_code}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                        {c.duration_years} yrs
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(`/api/admin/courses/${c.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
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
        )}

        {tab === 'semesters' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={addSemester}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Add Semester & Division</h2>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Course</label>
                <select
                  value={semCourseId}
                  onChange={(e) => setSemCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">Semester #</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={semNumber}
                    onChange={(e) => setSemNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">Division</label>
                  <input
                    type="text"
                    required
                    value={semDivision}
                    onChange={(e) => setSemDivision(e.target.value)}
                    placeholder="A"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Display Label</label>
                <input
                  type="text"
                  value={semLabel}
                  onChange={(e) => setSemLabel(e.target.value)}
                  placeholder={`Semester ${semNumber}`}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Create Semester Division
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Course</th>
                    <th className="py-2.5 px-4">Semester</th>
                    <th className="py-2.5 px-4">Division</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {semesters.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {s.course_code} · {s.course_name}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{s.label}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">Div {s.division}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(`/api/admin/semesters/${s.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
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
        )}
      </div>
    </AppShell>
  );
}
