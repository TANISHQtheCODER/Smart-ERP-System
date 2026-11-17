import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const sizeClasses =
    size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-16 w-16 text-lg'
      : 'h-9 w-9 text-xs';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClasses} rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center shrink-0 select-none`}
      aria-label={name}
    >
      {initials || 'U'}
    </div>
  );
}
