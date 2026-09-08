'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, Pencil } from 'lucide-react';
import { DATE_FORMAT_PRESETS, previewFormat, type SupportedLocale } from '@/lib/date-format';

interface DateFormatPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Langue de l'aperçu (celle de l'admin). */
  locale?: SupportedLocale;
}

/**
 * Sélection du format de date : liste filtrable de préréglages **ou** motif
 * libre saisi à la main. Chaque option affiche son libellé, une note
 * explicative et un aperçu calculé en direct dans la langue courante.
 */
export default function DateFormatPicker({ value, onChange, locale = 'fr' }: DateFormatPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DATE_FORMAT_PRESETS;
    return DATE_FORMAT_PRESETS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.note.toLowerCase().includes(q) ||
        previewFormat(o.value, locale).toLowerCase().includes(q),
    );
  }, [query, locale]);

  const activePreset = DATE_FORMAT_PRESETS.find((o) => o.value === value);
  // Un format absent du catalogue est forcément un motif saisi à la main.
  const isCustom = !activePreset && value.trim().length > 0;

  return (
    <div className="space-y-2" ref={boxRef}>
      <div className="relative">
        <button
          type="button"
          className="ad-input w-full flex items-center justify-between gap-3 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ad-accent)' }} />
            <span className="truncate">
              {activePreset ? activePreset.label : isCustom ? `Personnalisé · ${value}` : 'Choisir un format…'}
            </span>
          </span>
          <span className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono" style={{ color: 'var(--ad-muted)' }}>
              {value ? previewFormat(value, locale) : ''}
            </span>
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />
          </span>
        </button>

        {open && (
          <div
            className="absolute z-30 w-full mt-1 rounded-lg shadow-lg overflow-hidden"
            style={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-line)' }}
          >
            <div className="p-2" style={{ borderBottom: '1px solid var(--ad-line)' }}>
              <input
                autoFocus
                className="ad-input"
                placeholder="Filtrer les formats…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="max-h-72 overflow-y-auto ad-scroll py-1">
              {options.length === 0 ? (
                <div className="p-4 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>
                  Aucun format ne correspond. Saisissez un motif personnalisé ci-dessous.
                </div>
              ) : (
                options.map((o) => {
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="w-full px-3 py-2 text-left flex items-start gap-3 ad-combo-item"
                      style={on ? { background: 'var(--ad-surface-2)' } : undefined}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold">{o.label}</span>
                          <code className="text-[11px] opacity-60">{o.value}</code>
                        </span>
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                          {o.note}
                        </span>
                        <span className="block text-xs mt-1 font-mono" style={{ color: 'var(--ad-accent)' }}>
                          {previewFormat(o.value, locale)}
                        </span>
                      </span>
                      {on && <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--ad-accent)' }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Motif libre */}
      <label className="space-y-1.5 block">
        <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--ad-muted)' }}>
          <Pencil className="w-3 h-3" /> Format personnalisé
        </span>
        <input
          className="ad-input font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="DD/MM/YYYY HH:mm"
        />
        <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          Jetons : <code>YYYY</code> année · <code>MM</code> mois · <code>MMMM</code> mois en lettres ·{' '}
          <code>DD</code> jour · <code>dddd</code> jour de la semaine · <code>HH:mm</code> heure.
          Le texte entre crochets est conservé tel quel : <code>[le] D MMMM</code>.
        </p>
      </label>

      <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--ad-surface-2)' }}>
        <span style={{ color: 'var(--ad-muted)' }}>Aperçu : </span>
        <span className="font-semibold">{value ? previewFormat(value, locale) : '—'}</span>
      </div>
    </div>
  );
}
