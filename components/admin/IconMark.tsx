'use client';

import { getLucideIcon } from '@/lib/lucide-icons';

export default function IconMark({
  name,
  className = 'w-4 h-4',
  showLabel = false,
}: {
  name?: string | null;
  className?: string;
  showLabel?: boolean;
}) {
  if (!name) return showLabel ? <span>—</span> : null;
  const Icon = getLucideIcon(name);
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={className} style={{ color: 'var(--ad-accent)' }} />
      {showLabel && <span className="font-mono text-sm">{name}</span>}
    </span>
  );
}
