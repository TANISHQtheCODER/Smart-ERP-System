import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface SubjectRow {
  id: number;
  code: string;
  name: string;
  credits: number;
  lecture_duration_minutes: number;
  department_code: string;
  semester_label: string;
  division: string;
  enrolled_count: number;
}

interface TeacherAssignment {
  id: number;
  teacher_code: string;
  teacher_name: string;
  subject_code: string;
  subject_name: string;
  academic_term: string;
}

interface StudentEnrollment {
  id: number;
  student_code: string;
  student_name: string;
  subject_code: string;
  subject_name: string;
}

export function AdminSubjects() {
  const [tab, setTab] = useState<'subjects' | 'teachers' | 'students'>('subjects');
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [semesters, setSemesters] = useState<Array<{ id: number; label: string; division: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: number; teacher_code: string; full_name: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: number; student_code: string; full_name: string }>>([]);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Create subject form
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subDeptId, setSubDeptId] = useState('');
  const [subSemId, setSubSemId] = useState('');
  const [subCredits, setSubCredits] = useState('4');
  const [subDuration, setSubDuration] = useState('60');

  // Assign teacher form
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [academicTerm, setAcademicTerm] = useState('2026-Odd');

  // Enroll students form
  const [enrollSubjectId, setEnrollSubjectId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  const load = async () => {
    const [subRes, acadRes, tRes, sRes] = await Promise.all([
      apiFetch<{
        subjects: SubjectRow[];
        teacherAssignments: TeacherAssignment[];
        studentEnrollments: StudentEnrollment[];
      }>('/api/admin/subjects'),
      apiFetch<{
        departments: Array<{ id: number; code: string; name: string }>;
        semesters: Array<{ id: number; label: string; division: string }>;
      }>('/api/admin/academics'),
      apiFetch<{ teachers: Array<{ id: number; teacher_code: string; full_name: string }> }>(
        '/api/admin/teachers'
      ),
      apiFetch<{ students: Array<{ id: number; student_code: string; full_name: string }> }>(
        '/api/admin/students'
      ),
    ]);

    setSubjects(subRes.subjects);
    setTeacherAssignments(subRes.teacherAssignments);
    setStudentEnrollments(subRes.studentEnrollments);
    setDepartments(acadRes.departments);
    setSemesters(acadRes.semesters);
    setTeachers(tRes.teachers);
    setStudents(sRes.students);

    if (!subDeptId && acadRes.departments[0]) setSubDeptId(String(acadRes.departments[0].id));
    if (!subSemId && acadRes.semesters[0]) setSubSemId(String(acadRes.semesters[0].id));
    if (!assignTeacherId && tRes.teachers[0]) setAssignTeacherId(String(tRes.teachers[0].id));
    if (!assignSubjectId && subRes.subjects[0]) setAssignSubjectId(String(subRes.subjects[0].id));
    if (!enrollSubjectId && subRes.subjects[0]) setEnrollSubjectId(String(subRes.subjects[0].id));
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({
          code: subCode,
          name: subName,
          department_id: Number(subDeptId),
          semester_id: Number(subSemId),
          credits: Number(subCredits),
          lecture_duration_minutes: Number(subDuration),
        }),
      });
      setSubCode('');
      setSubName('');
      setMessage('Subject added to catalog.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subject.');
    }
  };

  const assignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/teacher-subjects', {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: Number(assignTeacherId),
          subject_id: Number(assignSubjectId),
          academic_term: academicTerm,
        }),
      });
      setMessage('Subject assigned to faculty member.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed.');
    }
  };

  const enrollStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await apiFetch<{ inserted: number }>('/api/admin/student-subjects', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: Number(enrollSubjectId),
          student_ids: selectedStudentIds,
        }),
      });
      setSelectedStudentIds([]);
      setMessage(`Enrolled ${res.inserted} new student(s) into the subject.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    }
  };

  const toggleStudentSelection = (id: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeRecord = async (url: string) => {
    setError('');
    await apiFetch(url, { method: 'DELETE' });
    await load();
  };

  return (
    <AppShell title="Subjects, Faculty Assignment & Enrollment" breadcrumb="Administration">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('subjects')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'subjects' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Subjects Catalog
          </button>
          <button
            type="button"
            onClick={() => setTab('teachers')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'teachers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Assign Teachers
          </button>
          <button
            type="button"
            onClick={() => setTab('students')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Enroll Students
          </button>
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

        {tab === 'subjects' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={createSubject}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Create Subject</h2>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Subject Code</label>
                <input
                  type="text"
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. CS505"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Compiler Design"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Department</label>
                <select
                  value={subDeptId}
                  onChange={(e) => setSubDeptId(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700">Semester & Division</label>
                <select
                  value={subSemId}
                  onChange={(e) => setSubSemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} Div {s.division}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={subCredits}
                    onChange={(e) => setSubCredits(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Lecture (mins)</label>
                  <input
                    type="number"
                    min={30}
                    max={180}
                    value={subDuration}
                    onChange={(e) => setSubDuration(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Add Subject
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Cohort</th>
                    <th className="py-2.5 px-4 text-right">Duration</th>
                    <th className="py-2.5 px-4 text-right">Enrolled</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {subjects.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                        {sub.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{sub.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {sub.department_code} · {sub.semester_label} Div {sub.division}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {sub.lecture_duration_minutes}m
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 tabular-nums">
                        {sub.enrolled_count}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeRecord(`/api/admin/subjects/${sub.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
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

        {tab === 'teachers' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={assignTeacher}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Assign Subject to Teacher</h2>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Faculty Member</label>
                <select
                  value={assignTeacherId}
                  onChange={(e) => setAssignTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teacher_code} — {t.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Subject</label>
                <select
                  value={assignSubjectId}
                  onChange={(e) => setAssignSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Academic Term</label>
                <input
                  type="text"
                  value={academicTerm}
                  onChange={(e) => setAcademicTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Assign Subject
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Assigned Teacher</th>
                    <th className="py-2.5 px-4">Term</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {teacherAssignments.map((ta) => (
                    <tr key={ta.id}>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {ta.subject_code} · {ta.subject_name}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {ta.teacher_name}{' '}
                        <span className="font-mono text-xs text-slate-500">({ta.teacher_code})</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{ta.academic_term}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeRecord(`/api/admin/teacher-subjects/${ta.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
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

        {tab === 'students' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={enrollStudents}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Enroll Students</h2>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Target Subject</label>
                <select
                  value={enrollSubjectId}
                  onChange={(e) => setEnrollSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">Select Students</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedStudentIds(
                        selectedStudentIds.length === students.length
                          ? []
                          : students.map((s) => s.id)
                      )
                    }
                    className="text-xs text-blue-700 hover:underline cursor-pointer"
                  >
                    {selectedStudentIds.length === students.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {students.map((st) => (
                    <label
                      key={st.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(st.id)}
                        onChange={() => toggleStudentSelection(st.id)}
                        className="rounded border-slate-300 text-blue-700"
                      />
                      <span className="font-mono text-slate-600">{st.student_code}</span>
                      <span className="text-slate-900 truncate">{st.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={selectedStudentIds.length === 0}
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                Enroll Selected ({selectedStudentIds.length})
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[540px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 sticky top-0">
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Student ID</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {studentEnrollments.map((se) => (
                      <tr key={se.id}>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {se.subject_code} · {se.subject_name}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                          {se.student_code}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800">{se.student_name}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => removeRecord(`/api/admin/student-subjects/${se.id}`)}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
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
        )}
      </div>
    </AppShell>
  );
}
