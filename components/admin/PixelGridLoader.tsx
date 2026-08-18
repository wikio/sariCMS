'use client';

export default function PixelGridLoader({
  label = 'Chargement',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const cells = Array.from({ length: 64 });
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-20'} gap-5`}>
      <div className="relative">
        <div className="ad-pixel-grid">
          {cells.map((_, i) => {
            const col = i % 8;
            const row = Math.floor(i / 8);
            const delay = (col + row) * 0.055;
            return (
              <span
                key={i}
                className="ad-pixel-cell"
                style={{ animationDelay: `${delay}s` }}
              />
            );
          })}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 h-4 opacity-50"
          style={{
            background: 'linear-gradient(to bottom, transparent, var(--ad-accent-2), transparent)',
            animation: 'adScan 1.6s linear infinite',
          }}
        />
      </div>
      <div className="text-[10px] uppercase tracking-[0.28em] font-bold" style={{ color: 'var(--ad-muted)' }}>
        {label}
      </div>
    </div>
  );
}
