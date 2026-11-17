import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface ScheduleData {
  timetable: Array<{
    id: number;
    subject_code: string;
    subject_name: string;
    semester_label: string;
    division: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    room: string;
  }>;
  notices: Array<{
    id: number;
    title: string;
    content: string;
    category: string;
    author_name: string;
    published_at: string;
  }>;
}

export function TeacherSchedule() {
  const [data, setData] = useState<ScheduleData | null>(null);

  useEffect(() => {
    apiFetch<ScheduleData>('/api/teacher/schedule').then(setData);
  }, []);

  return (
    <AppShell title="Teaching Timetable & Notices" breadcrumb="Faculty Portal">
      {data && (
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Weekly Teaching Schedule</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Day</th>
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Cohort</th>
                    <th className="py-2.5 px-4 text-right">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.timetable.map((slot) => (
                    <tr key={slot.id}>
                      <td className="py-3 px-4 font-medium text-slate-900">{slot.day_of_week}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {slot.start_time} – {slot.end_time}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {slot.subject_code} · {slot.subject_name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {slot.semester_label} Div {slot.division}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-800">
                        {slot.room}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Faculty Notices</h2>
            </div>
            {data.notices.map((n) => (
              <div key={n.id} className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{n.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(n.published_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{n.content}</p>
              </div>
            ))}
          </section>
        </div>
      )}
    </AppShell>
  );
}
