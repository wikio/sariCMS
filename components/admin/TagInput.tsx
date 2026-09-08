'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({
  values,
  onChange,
  suggestions = [],
  placeholder = 'Rechercher puis Entrée ou virgule…',
}: {
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return suggestions
      .filter((s) => !values.includes(s))
      .filter((s) => !needle || s.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, suggestions, values]);

  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setQ('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2.75rem] px-2 py-1.5" style={{ border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius-sm)', background: 'var(--ad-surface)' }}>
        {values.map((v) => (
          <span key={v} className="ad-chip ad-chip-acc">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Retirer ${v}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm"
          value={q}
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(q);
            }
            if (e.key === 'Backspace' && !q && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={() => q.trim() && add(q)}
        />
      </div>
      {q && hits.length > 0 && (
        <div className="ad-combo-list relative">
          {hits.map((h) => (
            <button key={h} type="button" className="ad-combo-item" onMouseDown={(e) => { e.preventDefault(); add(h); }}>
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
