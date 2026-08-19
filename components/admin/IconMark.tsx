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
  const Icon = getLucideIcon(name);
  if (!name) return showLabel ? <span>—</span> : null;
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <Icon className={className} strokeWidth={2} style={{ color: 'var(--ad-accent)', flexShrink: 0 }} />
      {showLabel && <span className="font-mono text-sm">{name}</span>}
    </span>
  );
}
