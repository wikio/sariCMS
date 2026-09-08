'use client';

/**
 * Les briques de l'atelier.
 *
 * Tout le monde n'a pas besoin d'un composant de bibliothèque : un champ nombre,
 * un segmenté et un nuancier tiennent en quelques lignes, et les écrire ici évite
 * d'apporter `react-hook-form` ou une dépendance de couleurs dans le bundle admin.
 * Deux choix valent une explication :
 *
 * - `ColorField` repose sur `<input type="color">`, que Safari, Chrome et Firefox
 *   rendent tous nativement, avec un champ texte à côté pour coller un `#rrggbb` ou
 *   un `rgba()`. C'est ce que j'avais retenu dans le plan plutôt que `react-colorful`,
 *   dont la peer-dependency React 19 n'était pas stabilisée à l'écriture.
 * - Les nombres passent par un `SliderField` + un champ : la sourie pour ajuster à
 *   l'œil, le clavier pour la valeur exacte. Un `number` seul ferait taper deux fois
 *   plus souvent.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GradientSpec } from '@/lib/canvas/types';
import { normalizeColor } from '@/lib/canvas/document';

export function Card({ title, icon, children, actions }: { title: string; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="sc-card">
      <header className="sc-card__title">
        {icon}
        {title}
        {actions ? <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>{actions}</span> : null}
      </header>
      {children}
    </section>
  );
}

export function Row({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  return <div className={wrap ? 'sc-row sc-row--wrap' : 'sc-row'}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="sc-col">
      <span className="sc-label" title={hint}>
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Un champ dont le brouillon suit la valeur du document tant qu'on n'y touche pas.
 *
 * L'atelier écrit dans Fabric à chaque frappe, et Fabric renvoie la valeur arrondie
 * (`opacity: 0.7` là où l'utilisateur a tapé `0.70`). Sans brouillon, le champ se
 * corrigerait sous le curseur. `typingRef` est le seul arbitre : pendant la frappe
 * on garde le texte tel quel, dès qu'on valide le document reprend la main.
 */
function useDraft(value: string, write: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const typingRef = useRef(false);
  useEffect(() => {
    if (!typingRef.current) setDraft(value);
  }, [value]);
  return {
    draft,
    start: (next: string) => {
      typingRef.current = true;
      setDraft(next);
    },
    /** À l'entrée en écriture directe (glisser d'un nuancier) : la valeur externe gagne. */
    yield: () => {
      typingRef.current = false;
    },
    commit: (next: string) => {
      typingRef.current = false;
      write(next);
    },
  };
}

export function NumberField({
  label,
  value,
  onChange,
  min = -100000,
  max = 100000,
  step = 1,
  suffix,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const field = useDraft(String(Math.round(value * 100) / 100), (raw) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    onChange(Math.min(max, Math.max(min, next)));
  });
  const draft = field.draft;
  const commit = field.commit;

  if (!label)
    return (
      <input
        className="sc-input"
        style={{ width: 70 }}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(event) => field.start(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit((event.target as HTMLInputElement).value);
            (event.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  return (
    <Field label={label + (suffix ? ` (${suffix})` : '')}>
      <input
        className="sc-input"
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(event) => field.start(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
        }}
      />
    </Field>
  );
}

export function SliderField({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  unit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Fermé au `change` : l'historique n'enregistre qu'une entrée par glisser. */
  onCommit?: (value: number) => void;
  unit?: string;
}) {
  return (
    <Field label={`${label}${unit ? ` (${unit})` : ''}`}>
      <div className="sc-row">
        <input
          className="sc-range"
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
          onKeyUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
        />
        <span style={{ width: '4ch', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{Math.round(value * 100) / 100}</span>
      </div>
    </Field>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  title,
}: {
  value: T | '';
  options: { value: T; label?: string; icon?: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  title?: string;
}) {
  return (
    <div className="sc-seg" role="group" title={title}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={option.title || option.label || option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label ? <span>{option.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  groups,
}: {
  label?: string;
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  groups?: { label: string; options: { value: T; label: string }[] }[];
}) {
  const select = (
    <select className="sc-select" value={value} onChange={(event) => onChange(event.target.value as T)}>
      {groups
        ? groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))
        : options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
    </select>
  );
  if (!label) return select;
  return <Field label={label}>{select}</Field>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const field = useDraft(value, onChange);
  const shared = {
    placeholder,
    value: field.draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => field.start(event.target.value),
    onBlur: () => field.commit(field.draft),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && (multiline ? event.metaKey || event.ctrlKey : true)) {
        field.commit(field.draft);
        (event.target as HTMLElement).blur();
      }
    },
  };
  const input = multiline ? <textarea className="sc-textarea" {...shared} /> : <input className="sc-input" {...shared} />;
  if (!label) return input;
  return <Field label={label}>{input}</Field>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="sc-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

/** Un bouton-icole avec infobulle — la trame de toute la fenêtre. */
export function Icon({ children, label, pressed, onClick, disabled, danger }: { children: ReactNode; label: string; pressed?: boolean; onClick?: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      className={`sc-btn sc-btn--icon${danger ? ' sc-btn--danger' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const SWATCHES = [
  '#000000',
  '#0f172a',
  '#1e293b',
  '#334155',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
  '#f8fafc',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];

/**
 * Le nuancier. `alpha` autorise un `rgba()` : c'est la différence entre « opacité de
 * l'objet » et « couleur translucide », et l'atelier a besoin des deux (un calque de
 * texte blanc à 70 % sur une photo n'est pas la même chose qu'un texte blanc opaque).
 *
 * `onCommit` n'est appelé qu'à la fin du glisser dans le sélecteur natif — sinon
 * chaque pixel de la sourie écrirait une entrée dans l'historique.
 */
export function ColorField({
  label,
  value,
  onChange,
  onCommit,
  allowNone,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  allowNone?: boolean;
}) {
  const normalized = normalizeColor(value) || value || '#000000';
  const field = useDraft(normalized, (raw) => {
    const next = normalizeColor(raw);
    if (next) {
      onChange(next);
      onCommit?.(next);
    }
  });
  const draft = field.draft;
  const hex = /^#[0-9a-f]{6}$/i.test(draft) ? draft : toHex(draft);
  const commitText = field.commit;

  return (
    <Field label={label || 'Couleur'}>
      <div className="sc-row">
        <label className="sc-color">
          <input
            type="color"
            value={hex}
            onChange={(event) => {
              field.yield();
              onChange(event.target.value);
            }}
            onPointerUp={() => onCommit?.(draft)}
            onBlur={() => onCommit?.(draft)}
          />
          <input
            className="sc-color__value"
            value={draft}
            spellCheck={false}
            onChange={(event) => field.start(event.target.value)}
            onBlur={(event) => commitText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitText((event.target as HTMLInputElement).value);
            }}
          />
        </label>
        {allowNone ? (
          <button type="button" className="sc-btn sc-btn--ghost" title="Aucune couleur" onClick={() => onCommit ? (onChange('transparent'), onCommit('transparent')) : onChange('transparent')}>
            ∅
          </button>
        ) : null}
      </div>
      <div className="sc-swatches">
        {SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            className="sc-swatch"
            style={{ background: color }}
            title={color}
            aria-pressed={draft.toLowerCase() === color}
            onClick={() => {
              field.yield();
              onChange(color);
              onCommit?.(color);
            }}
          />
        ))}
      </div>
    </Field>
  );
}

function toHex(value: string): string {
  const normalized = normalizeColor(value);
  if (!normalized) return '#000000';
  if (normalized.startsWith('#')) return normalized.length === 7 ? normalized : '#000000';
  const parts = normalized.match(/[\d.]+/g);
  if (!parts) return '#000000';
  const [r, g, b] = parts.map((part) => Math.round(Number(part)));
  return `#${[r, g, b].map((channel) => (channel ?? 0).toString(16).padStart(2, '0')).join('')}`;
}

/** Deux poignées de couleur + l'angle ou le rayon : l'éditeur de dégradé, entier. */
export function GradientEditor({
  gradient,
  onChange,
  label = 'Dégradé',
}: {
  gradient: GradientSpec;
  onChange: (gradient: GradientSpec) => void;
  label?: string;
}) {
  const angle = gradient.angle ?? 90;
  const radialX = gradient.radialX ?? 50;
  const radialY = gradient.radialY ?? 50;
  const radialR = gradient.radialR ?? 70;
  const first = gradient.stops[0] || { offset: 0, color: '#000000' };
  const last = gradient.stops[gradient.stops.length - 1] || { offset: 100, color: '#ffffff' };

  const setStops = (index: number, color: string) => {
    const stops = gradient.stops.map((stop, at) => (at === index ? { ...stop, color } : stop));
    onChange({ ...gradient, stops });
  };

  return (
    <Card title={label}>
      <Segmented
        value={gradient.type}
        onChange={(type) => onChange({ ...gradient, type })}
        options={[
          { value: 'linear', label: 'Linéaire' },
          { value: 'radial', label: 'Radial' },
        ]}
      />
      <Row>
        <div className="sc-col">
          <span className="sc-label">Départ</span>
          <ColorField value={first.color} onChange={(color) => setStops(0, color)} onCommit={(color) => setStops(0, color)} />
        </div>
        <div className="sc-col">
          <span className="sc-label">Fin</span>
          <ColorField
            value={last.color}
            onChange={(color) => setStops(gradient.stops.length - 1, color)}
            onCommit={(color) => setStops(gradient.stops.length - 1, color)}
          />
        </div>
      </Row>
      {gradient.type === 'linear' ? (
        <SliderField label="Angle" value={angle} min={0} max={360} onChange={(next) => onChange({ ...gradient, angle: next })} onCommit={(next) => onChange({ ...gradient, angle: next })} unit="°" />
      ) : (
        <>
          <SliderField label="Centre X" value={radialX} min={0} max={100} onChange={(next) => onChange({ ...gradient, radialX: next })} onCommit={(next) => onChange({ ...gradient, radialX: next })} unit="%" />
          <SliderField label="Centre Y" value={radialY} min={0} max={100} onChange={(next) => onChange({ ...gradient, radialY: next })} onCommit={(next) => onChange({ ...gradient, radialY: next })} unit="%" />
          <SliderField label="Rayon" value={radialR} min={5} max={200} onChange={(next) => onChange({ ...gradient, radialR: next })} onCommit={(next) => onChange({ ...gradient, radialR: next })} unit="%" />
        </>
      )}
      <div
        aria-hidden
        style={{
          height: 26,
          borderRadius: 8,
          border: '1px solid #22314c',
          background:
            gradient.type === 'radial'
              ? `radial-gradient(circle at ${radialX}% ${radialY}%, ${gradient.stops.map((stop) => `${stop.color} ${stop.offset}%`).join(', ')})`
              : `linear-gradient(${90 + angle}deg, ${gradient.stops.map((stop) => `${stop.color} ${stop.offset}%`).join(', ')})`,
        }}
      />
    </Card>
  );
}

/** Un menu déroulant écrit à la main : `position` + `z-index`, pas de portail. */
export function Menu({ label, icon, children, align = 'end', className }: { label: string; icon?: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'start' | 'end'; className?: string }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  /**
   * Positionne le panneau en pixels de viewport.
   *
   * Le rail de gauche est une colonne de 64 px en `overflow-y: auto` : un panneau de 232
   * px, absolu à l'intérieur, y naissait rogné — « les icônes de formes sont décalées à
   * gauche, on ne les voit pas ». En `fixed`, il s'ouvre À CÔTÉ du rail, recadré à la
   * fenêtre, avec son propre défilement s'il dépasse du bas de l'écran. Écriture directe du
   * style, pas d'état : mesurer puis `setState` dans un effet relance un rendu complet, et
   * React 19 le décourage à juste titre.
   */
  const applyPos = useCallback(() => {
    const anchor = host.current?.getBoundingClientRect();
    const node = list.current;
    if (!anchor || !node) return;
    const width = Math.max(node.offsetWidth, 232);
    let left = align === 'start' ? anchor.left : anchor.right - width;
    if (anchor.left + width + 12 < window.innerWidth) left = anchor.left;
    else if (anchor.right - width > 8) left = anchor.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = Math.min(anchor.bottom + 6, Math.max(80, window.innerHeight - 48));
    node.style.position = 'fixed';
    node.style.top = `${top}px`;
    node.style.left = `${left}px`;
    node.style.minWidth = `${width}px`;
    node.style.maxHeight = `${Math.max(120, window.innerHeight - top - 10)}px`;
    node.style.zIndex = '80';
  }, [align]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => applyPos();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, applyPos]);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={`sc-menu${className ? ` ${className}` : ''}`} ref={host}>
      <button type="button" className={`sc-btn${open ? ' sc-btn--on' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {icon}
        {label}
      </button>
      {open ? (
        <div
          ref={(node) => {
            list.current = node;
            if (!node) return;
            applyPos();
            // Deuxième mesure à la frame suivante : la largeur dépend du contenu, donc des
            // styles qu'on vient d'écrire — la recalculer une fois le layout posé évite un
            // panneau collé au bord gauche de la fenêtre quand il pourrait tenir à droite.
            window.requestAnimationFrame(applyPos);
          }}
          className="sc-menu__list"
          role="menu"
          style={{ [align]: 0 } as React.CSSProperties}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ children, onClick, hint, icon }: { children: ReactNode; onClick: () => void; hint?: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className="sc-menu__item"
      role="menuitem"
      onClick={() => {
        onClick();
      }}
    >
      {icon}
      {children}
      {hint ? <small>{hint}</small> : null}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="sc-menu__head">{children}</div>;
}
