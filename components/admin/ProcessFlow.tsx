'use client';

import { Check } from 'lucide-react';

export type ProcessStep = {
  id?: string;
  label: string;
  detail?: string;
  at?: string;
  owner?: string;
  done?: boolean;
};

export function normalizeSteps(value: unknown): ProcessStep[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, i) => {
    if (typeof item === 'string') return { id: String(i), label: item };
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id ?? i),
        label: String(row.label || row.title || row.status || row.name || `Étape ${i + 1}`),
        detail: row.detail || row.note || row.comment ? String(row.detail || row.note || row.comment) : undefined,
        at: row.at ? String(row.at) : undefined,
        owner: row.owner || row.responsable ? String(row.owner || row.responsable) : undefined,
        done: Boolean(row.done),
      };
    }
    return { id: String(i), label: String(item) };
  });
}

export default function ProcessFlow({
  steps,
  current,
}: {
  steps: ProcessStep[];
  current?: string;
}) {
  if (!steps.length) {
    return <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Aucun processus défini.</p>;
  }
  const currentIndex = current
    ? steps.findIndex((s) => s.id === current || s.label === current)
    : steps.findIndex((s) => !s.done);
  return (
    <ol className="ad-process">
      {steps.map((step, i) => {
        const done = step.done || (currentIndex >= 0 && i < currentIndex);
        const on = currentIndex === i || (!current && !done && i === steps.findIndex((s) => !s.done));
        return (
          <li key={step.id || `${step.label}-${i}`} className={`ad-process-step ${done ? 'is-done' : ''} ${on ? 'is-on' : ''}`}>
            <span className="ad-process-dot">{done ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
            {i < steps.length - 1 && <span className="ad-process-line" />}
            <div className="min-w-0">
              <div className="font-black text-sm leading-tight">{step.label}</div>
              {step.detail && <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{step.detail}</p>}
              {(step.at || step.owner) && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--ad-muted)' }}>
                  {[step.owner, step.at ? new Date(step.at).toLocaleString() : ''].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
