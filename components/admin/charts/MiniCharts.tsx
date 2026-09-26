'use client';

export function BarChart({ items }: { items: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[7rem_1fr_2.5rem] gap-2 items-center text-sm">
          <span className="truncate" style={{ color: 'var(--ad-muted)' }}>{item.label}</span>
          <div className="h-3" style={{ background: 'var(--ad-surface-2)', border: '1px solid var(--ad-line)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color || 'var(--ad-accent)' }}
            />
          </div>
          <span className="tabular-nums font-bold text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ items, size = 160 }: { items: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--ad-line)" strokeWidth="16" />
        {items.map((item) => {
          const len = (item.value / total) * c;
          const el = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="74" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--ad-ink)">{items.reduce((s, i) => s + i.value, 0)}</text>
      </svg>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5" style={{ background: item.color }} />
            <span>{item.label}</span>
            <span className="ml-auto font-bold tabular-nums">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
