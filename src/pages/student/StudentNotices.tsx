import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { apiFetch } from '../../lib/api';

interface NoticeItem {
  id: number;
  title: string;
  content: string;
  category: string;
  author_name: string;
  published_at: string;
}

export function StudentNotices() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    apiFetch<{ notices: NoticeItem[] }>('/api/student/notices').then((res) =>
      setNotices(res.notices)
    );
  }, []);

  const filtered = notices.filter((n) => category === 'All' || n.category === category);

  return (
    <AppShell title="College Notice Board" breadcrumb="Student Portal">
      <div className="space-y-4 max-w-4xl">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {['All', 'Urgent', 'Exam', 'Academic', 'Event'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                category === cat ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No notices in this category.
            </p>
          ) : (
            filtered.map((n) => (
              <article key={n.id} className="p-6 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                  <span>Posted by {n.author_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {new Date(n.published_at).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-slate-900">{n.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{n.content}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
