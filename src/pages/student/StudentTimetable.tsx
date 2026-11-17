import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface TimetableEntry {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  subject_code: string;
  subject_name: string;
  teacher_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StudentTimetable() {
  const [slots, setSlots] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ timetable: TimetableEntry[] }>('/api/student/dashboard')
      .then((res) => setSlots(res.timetable))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Weekly Timetable" breadcrumb="Student Portal">
      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.day_of_week === day);
            return (
              <section key={day} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-semibold text-slate-900">{day}</h2>
                </div>
                {daySlots.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">No scheduled lectures.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {daySlots.map((slot) => (
                      <div key={slot.id} className="p-4 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono tabular-nums">
                            {slot.start_time} – {slot.end_time}
                          </span>
                          <span className="font-mono font-medium text-slate-700">{slot.room}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {slot.subject_code} · {slot.subject_name}
                        </p>
                        <p className="text-xs text-slate-600">{slot.teacher_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
