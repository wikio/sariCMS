'use client';

export default function Toggle({
  on,
  onChange,
  label,
  hint,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {label ? <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{label}</div> : null}
      {hint && <p className="text-[11px] leading-snug" style={{ color: 'var(--ad-muted)' }}>{hint}</p>}
      <button
        type="button"
        disabled={disabled}
        className={`ad-toggle ${on ? 'is-on' : ''}`}
        onClick={() => onChange(!on)}
        aria-pressed={on}
      >
        <span className="ad-toggle-knob" />
        <span className="ad-toggle-label">{on ? 'Oui' : 'Non'}</span>
      </button>
    </div>
  );
}
