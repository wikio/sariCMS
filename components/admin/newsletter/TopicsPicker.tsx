// components/admin/newsletter/TopicsPicker.tsx
'use client';

/**
 * Saisie des centres d'intérêt d'un abonné.
 *
 * La valeur est une liste de termes, séparés à la virgule, et le champ reste
 * libre : ce que le visiteur a écrit (« IRM », « échographe portatif ») vaut
 * autant que les thèmes proposés par le bloc newsletter. Les suggestions
 * viennent de `?action=topics` — les termes déjà portés par des fiches, puis
 * ceux que le bloc de la vitrine propose — et ne servent qu'à taper plus vite.
 *
 * La séparation est tolérante : virgule, point-virgule ou `Entrée`. Un terme
 * collé en fin de saisie est conservé tel quel, sans majuscule forcée, pour que
 * la liste reste lisible telle que l'administrateur l'a écrite.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { TopicSuggestion } from '@/lib/newsletter-admin';

export default function TopicsPicker({
  value,
  onChange,
  suggestions = [],
  placeholder,
  label,
  help,
  addLabel,
  removeLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: TopicSuggestion[];
  placeholder?: string;
  label?: string;
  help?: string;
  addLabel?: string;
  removeLabel?: string;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const add = useCallback(
    (raw: string) => {
      const next = raw
        .split(/[,;]/)
        .map((piece) => piece.trim())
        .filter(Boolean);
      if (!next.length) return;
      const merged = [...value];
      for (const topic of next) {
        if (!merged.some((item) => item.toLowerCase() === topic.toLowerCase())) merged.push(topic);
      }
      onChange(merged);
      setDraft('');
    },
    [onChange, value],
  );

  const filtered = useMemo(() => {
    const needle = draft.trim().toLowerCase();
    return suggestions
      .filter((item) => !value.some((topic) => topic.toLowerCase() === item.topic.toLowerCase()))
      .filter((item) => !needle || item.topic.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  // Un clic ailleurs dans la page referme la liste de suggestions.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault();
      add(draft);
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      event.preventDefault();
      onChange(value.slice(0, -1));
      return;
    }
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div className="space-y-1.5" ref={boxRef}>
      {label ? (
        <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
          {label}
        </span>
      ) : null}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5"
        style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface, transparent)' }}
        onClick={() => setOpen(true)}
      >
        {value.map((topic) => (
          <span
            key={topic}
            className="ad-chip ad-chip-mute inline-flex items-center gap-1 max-w-full"
            title={removeLabel ? `${removeLabel} — ${topic}` : topic}
          >
            <span className="truncate">{topic}</span>
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              aria-label={removeLabel ? `${removeLabel} ${topic}` : topic}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((item) => item !== topic));
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] bg-transparent text-sm py-1 focus:outline-none"
          value={draft}
          placeholder={value.length ? '' : placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const text = e.target.value;
            // Une virgule saisie en fin de terme valide le terme, comme dans un
            // champ d'étiquettes : rien à ajouter à la main.
            if (text.endsWith(',') || text.endsWith(';')) add(text);
            else setDraft(text);
          }}
          onKeyDown={onKey}
          aria-label={label}
        />
        {draft.trim() ? (
          <button
            type="button"
            className="ad-btn ad-btn-ghost text-[11px] px-2 py-0.5"
            onClick={() => add(draft)}
          >
            {addLabel || '+'}
          </button>
        ) : null}
      </div>

      {open && filtered.length ? (
        <div
          className="rounded-lg border overflow-hidden text-sm"
          style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface, #fff)' }}
        >
          {filtered.map((item) => (
            <button
              key={item.topic}
              type="button"
              className="w-full text-start px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(item.topic)}
            >
              <span className="font-semibold">{item.topic}</span>
              <span className="text-[10px] ms-auto tabular-nums" style={{ color: 'var(--ad-muted)' }}>
                {item.count > 0 ? `${item.count}×` : item.proposed ? '•' : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {help ? (
        <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
