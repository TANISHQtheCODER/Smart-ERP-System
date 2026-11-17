import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface NoticeRow {
  id: number;
  title: string;
  content: string;
  category: string;
  target_role: string;
  author_name: string;
  published_at: string;
}

interface TimetableRow {
  id: number;
  subject_code: string;
  subject_name: string;
  teacher_name: string;
  semester_label: string;
  division: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
}

export function AdminNotices() {
  const [tab, setTab] = useState<'notices' | 'timetable'>('notices');
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: number; teacher_code: string; full_name: string }>>([]);
  const [semesters, setSemesters] = useState<Array<{ id: number; label: string; division: string }>>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Notice form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Academic');
  const [targetRole, setTargetRole] = useState('all');

  // Timetable form
  const [ttSubjectId, setTtSubjectId] = useState('');
  const [ttTeacherId, setTtTeacherId] = useState('');
  const [ttSemesterId, setTtSemesterId] = useState('');
  const [ttDay, setTtDay] = useState('Monday');
  const [ttStart, setTtStart] = useState('09:00');
  const [ttEnd, setTtEnd] = useState('10:00');
  const [ttRoom, setTtRoom] = useState('LH-204');

  const load = async () => {
    const [ntRes, subRes, tRes, acadRes] = await Promise.all([
      apiFetch<{ notices: NoticeRow[]; timetable: TimetableRow[] }>('/api/admin/notices'),
      apiFetch<{ subjects: Array<{ id: number; code: string; name: string }> }>('/api/admin/subjects'),
      apiFetch<{ teachers: Array<{ id: number; teacher_code: string; full_name: string }> }>(
        '/api/admin/teachers'
      ),
      apiFetch<{ semesters: Array<{ id: number; label: string; division: string }> }>(
        '/api/admin/academics'
      ),
    ]);
    setNotices(ntRes.notices);
    setTimetable(ntRes.timetable);
    setSubjects(subRes.subjects);
    setTeachers(tRes.teachers);
    setSemesters(acadRes.semesters);

    if (!ttSubjectId && subRes.subjects[0]) setTtSubjectId(String(subRes.subjects[0].id));
    if (!ttTeacherId && tRes.teachers[0]) setTtTeacherId(String(tRes.teachers[0].id));
    if (!ttSemesterId && acadRes.semesters[0]) setTtSemesterId(String(acadRes.semesters[0].id));
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/notices', {
        method: 'POST',
        body: JSON.stringify({ title, content, category, target_role: targetRole }),
      });
      setTitle('');
      setContent('');
      setMessage('Notice published.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish notice.');
    }
  };

  const addTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/timetable', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: Number(ttSubjectId),
          teacher_id: Number(ttTeacherId),
          semester_id: Number(ttSemesterId),
          day_of_week: ttDay,
          start_time: ttStart,
          end_time: ttEnd,
          room: ttRoom,
        }),
      });
      setMessage('Timetable slot added.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slot.');
    }
  };

  const remove = async (url: string) => {
    await apiFetch(url, { method: 'DELETE' });
    await load();
  };

  return (
    <AppShell title="College Notices & Timetable" breadcrumb="Administration">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('notices')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'notices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Notice Board
          </button>
          <button
            type="button"
            onClick={() => setTab('timetable')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'timetable' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Master Timetable
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

        {tab === 'notices' ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={publishNotice}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Publish Announcement</h2>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Headline for students or faculty"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Event">Event</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Audience</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="all">All Users</option>
                    <option value="student">Students Only</option>
                    <option value="teacher">Faculty Only</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Notice Body</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Publish Notice
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {notices.map((n) => (
                <div key={n.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span
                        className={
                          n.category === 'Urgent'
                            ? 'font-semibold text-red-700'
                            : 'font-semibold text-slate-700'
                        }
                      >
                        {n.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">Audience: {n.target_role}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(n.published_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{n.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{n.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(`/api/admin/notices/${n.id}`)}
                    className="p-1.5 text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <form
              onSubmit={addTimetable}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <h2 className="text-base font-semibold text-slate-900">Add Timetable Slot</h2>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Subject</label>
                <select
                  value={ttSubjectId}
                  onChange={(e) => setTtSubjectId(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700">Teacher</label>
                <select
                  value={ttTeacherId}
                  onChange={(e) => setTtTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Semester & Div</label>
                <select
                  value={ttSemesterId}
                  onChange={(e) => setTtSemesterId(e.target.value)}
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
                  <label className="block text-xs font-medium text-slate-700">Day</label>
                  <select
                    value={ttDay}
                    onChange={(e) => setTtDay(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Room</label>
                  <input
                    type="text"
                    required
                    value={ttRoom}
                    onChange={(e) => setTtRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Start</label>
                  <input
                    type="time"
                    value={ttStart}
                    onChange={(e) => setTtStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">End</label>
                  <input
                    type="time"
                    value={ttEnd}
                    onChange={(e) => setTtEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
              >
                Add Schedule Slot
              </button>
            </form>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Day & Time</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Instructor</th>
                    <th className="py-2.5 px-4">Room</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {timetable.map((slot) => (
                    <tr key={slot.id}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{slot.day_of_week}</p>
                        <p className="text-xs font-mono text-slate-500 tabular-nums">
                          {slot.start_time} – {slot.end_time}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">
                          {slot.subject_code} · {slot.subject_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {slot.semester_label} Div {slot.division}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{slot.teacher_name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{slot.room}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => remove(`/api/admin/timetable/${slot.id}`)}
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
      </div>
    </AppShell>
  );
}
