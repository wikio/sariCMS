'use client';

/**
 * Contrôles de réglage d'un bloc de la page d'accueil.
 *
 * Un seul composant pour tous les types de champs du catalogue
 * (`lib/home/catalog.ts`) : la valeur est toujours lue/écrite dans un
 * `HomeSectionConfig` selon le `scope` déclaré du champ (textes traduits,
 * réglages, style), ce qui évite un écran par bloc.
 */
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getLucideIcon } from '@/lib/lucide-icons';
import GedPicker from '@/components/admin/GedPicker';
import type { HomeField } from '@/lib/home/catalog';
import type { HomeSectionConfig } from '@/lib/home/config';

export function readScopeValue(config: HomeSectionConfig, scope: HomeField['scope'], key: string): unknown {
  if (scope === 'texts') return config.texts?.[key] ?? '';
  if (scope === 'settings') return config.settings?.[key];
  return (config.style as Record<string, unknown> | undefined)?.[key];
}

export function writeScopeValue<T extends HomeSectionConfig>(config: T, scope: HomeField['scope'], key: string, value: unknown): T {
  const next = { ...config };
  if (scope === 'texts') {
    next.texts = { ...(config.texts || {}), [key]: value === undefined || value === null ? '' : String(value) };
  } else if (scope === 'settings') {
    next.settings = { ...(config.settings || {}), [key]: value };
  } else {
    next.style = { ...(config.style || {}), [key]: value } as HomeSectionConfig['style'];
  }
  return next;
}

interface FieldProps {
  field: HomeField;
  config: HomeSectionConfig;
  onChange: (config: HomeSectionConfig) => void;
  disabled?: boolean;
}

const LABEL_CLASS = 'text-[11px] font-black uppercase tracking-[0.14em]';
const HINT_CLASS = 'text-[11px] leading-snug';

export default function HomeFieldControl({ field, config, onChange, disabled }: FieldProps) {
  const id = useId();
  const t = useTranslations('admin.home');
  const value = readScopeValue(config, field.scope, field.key);
  const set = (next: unknown) => onChange(writeScopeValue(config, field.scope, field.key, next));

  const label = field.labelKey ? (t.has(`fields.${field.labelKey}`) ? t(`fields.${field.labelKey}`) : field.label) : field.label;
  const hint = field.hint || field.max ? (
    <p className={HINT_CLASS} style={{ color: 'var(--ad-muted)' }}>
      {field.hint}
      {field.max ? `${field.hint ? ' ' : ''}(max. ${field.max})` : ''}
    </p>
  ) : null;

  const wrap = (control: React.ReactNode) => (
    <label htmlFor={id} className={`space-y-1.5 block ${field.wide ? 'md:col-span-2' : ''}`}>
      <span className={LABEL_CLASS} style={{ color: 'var(--ad-muted)' }}>
        {label}
        {field.i18n ? <span className="ms-2 normal-case tracking-normal opacity-70">· {t('perLanguage')}</span> : null}
      </span>
      {control}
      {hint}
    </label>
  );

  switch (field.kind) {
    case 'textarea':
      return wrap(
        <textarea
          id={id}
          className="ad-input min-h-[92px]"
          value={String(value ?? '')}
          maxLength={field.max}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
        />,
      );
    case 'number':
      return wrap(
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            className="ad-input"
            value={value === undefined || value === null || value === '' ? '' : String(value)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
            onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {field.suffix ? <span className="text-xs" style={{ color: 'var(--ad-muted)' }}>{field.suffix}</span> : null}
        </div>,
      );
    case 'range':
      return wrap(
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            className="w-full"
            value={Number(value ?? field.min ?? 0)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            disabled={disabled}
            onChange={(e) => set(Number(e.target.value))}
          />
          <span className="text-xs tabular-nums w-14 text-end">{String(value ?? field.min ?? 0)}{field.suffix || ''}</span>
        </div>,
      );
    case 'toggle': {
      const on = value === true || value === 'true' || value === 1;
      return (
        <div className={`space-y-1.5 ${field.wide ? 'md:col-span-2' : ''}`}>
          <button
            type="button"
            disabled={disabled}
            className={`ad-toggle ${on ? 'is-on' : ''}`}
            aria-pressed={on}
            onClick={() => set(!on)}
          >
            {on ? (
              <>
                <span className="ad-toggle-label">{t('yes')}</span>
                <span className="ad-toggle-knob" />
              </>
            ) : (
              <>
                <span className="ad-toggle-knob" />
                <span className="ad-toggle-label">{t('no')}</span>
              </>
            )}
          </button>
          <div className={LABEL_CLASS} style={{ color: 'var(--ad-muted)' }}>{label}</div>
          {hint}
        </div>
      );
    }
    case 'select':
      return wrap(
        <select id={id} className="ad-input" value={String(value ?? '')} disabled={disabled} onChange={(e) => set(e.target.value)}>
          <option value="">{field.placeholder || t('defaultValue')}</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>,
      );
    case 'color':
      return wrap(
        <div className="flex items-center gap-2">
          <input
            type="color"
            id={id}
            className="w-10 h-10 rounded-lg border bg-transparent cursor-pointer"
            style={{ borderColor: 'var(--ad-line)' }}
            value={/^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value) : '#169ec9'}
            disabled={disabled}
            onChange={(e) => set(e.target.value)}
          />
          <input
            className="ad-input font-mono text-xs"
            value={String(value ?? '')}
            disabled={disabled}
            placeholder="#169EC9"
            onChange={(e) => set(e.target.value)}
          />
        </div>,
      );
    case 'image':
      return wrap(<ImageValue value={String(value ?? '')} onChange={set} disabled={disabled} />);
    case 'html':
      return wrap(
        <textarea
          id={id}
          className="ad-input font-mono text-xs min-h-[180px]"
          value={String(value ?? '')}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
        />,
      );
    default:
      return wrap(
        <input
          id={id}
          className="ad-input"
          type="text"
          value={String(value ?? '')}
          maxLength={field.max}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
        />,
      );
  }
}

/** Champ image : URL libre + sélection dans la médiathèque, avec aperçu. */
function ImageValue({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useTranslations('admin.home');
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="ad-input flex-1" value={value} disabled={disabled} placeholder="https://… ou /uploads/…" onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="ad-btn ad-btn-ghost whitespace-nowrap" disabled={disabled} onClick={() => setOpen(true)}>
          {t('chooseImage')}
        </button>
      </div>
      {value ? (
        <div className="flex items-center gap-3">
          {/* L'aperçu n'a pas vocation à être interactif : une image simple suffit. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-20 h-14 object-cover rounded-lg border" style={{ borderColor: 'var(--ad-line)' }} />
          <button type="button" className="text-xs underline" style={{ color: 'var(--ad-muted)' }} onClick={() => onChange('')}>
            {t('removeImage')}
          </button>
        </div>
      ) : null}
      {open ? (
        <GedPicker
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function IconChoice({ name }: { name?: string }) {
  const Icon = getLucideIcon(name);
  return <Icon className="w-4 h-4" />;
}
