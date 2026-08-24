'use client';

import { useMessages, useTranslations } from 'next-intl';
import type { FieldSpec } from '@/lib/cms-modules';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import IconMark from '@/components/admin/IconMark';
import ProcessFlow, { normalizeSteps } from '@/components/admin/ProcessFlow';

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item : formatObject(item)));
  if (typeof value === 'string' && value) return value.split(',').map((s) => s.trim());
  return [];
}

function formatObject(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatObject).join(', ');
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if (row.q || row.a) return `${row.q || 'Question'} — ${row.a || ''}`;
    if (row.name && row.choices) return `${row.name} : ${asList(row.choices).join(', ')}`;
    if (row.time || row.title) return [row.time, row.title].filter(Boolean).join(' · ');
    if (row.label || row.title) return String(row.label || row.title);
    return Object.entries(row)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k} : ${formatObject(v)}`)
      .join(' · ');
  }
  return String(value);
}

export default function ConsultValue({ spec, value }: { spec: FieldSpec; value: unknown }) {
  const t = useTranslations('admin.editor');
  const tCommon = useTranslations('admin.common');
  const messages = useMessages() as Record<string, any>;
  
  if (value == null || value === '') return <div className="text-sm" style={{ color: 'var(--ad-muted)' }}>—</div>;

  // Traduire les valeurs select (CDI, Salon, etc.) — silencieux si clé absente
  if (spec.kind === 'select') {
    const strValue = String(value);
    const option = spec.options?.find(o => o.value === strValue);
    const fallbackLabel = option?.label || strValue;
    
    // 1. Essayer depuis les traductions de taxonomie (localStorage)
    if (spec.taxonomy) {
      try {
        const { listTaxonomy } = require('@/lib/taxonomies');
        const terms = listTaxonomy(spec.taxonomy);
        const term = terms.find((t: any) => t.value === strValue);
        if (term?.translations) {
          const currentLocale = (messages as any)?._locale || 'fr';
          const fromTax = term.translations[currentLocale];
          if (fromTax) return <div className="text-sm font-semibold break-words">{fromTax}</div>;
        }
      } catch {}
    }
    
    // 2. Fallback: lookup dans messages JSON (option_ keys)
    try {
      const editor = messages?.admin?.editor;
      const key = `option_${strValue}`;
      if (editor && typeof editor === 'object' && key in editor) {
        const translated = editor[key];
        if (typeof translated === 'string' && translated.length > 0) {
          return <div className="text-sm font-semibold break-words">{translated}</div>;
        }
      }
    } catch {}
    
    return <div className="text-sm font-semibold break-words">{fallbackLabel}</div>;
  }

  if (spec.kind === 'html') {
    return <HtmlEditor value={String(value || '')} onChange={() => undefined} readOnly />;
  }
  if (spec.kind === 'icon') {
    return <IconMark name={String(value)} className="w-6 h-6" showLabel />;
  }
  if (spec.kind === 'image' || spec.kind === 'file') {
    const src = String(value);
    if (src.match(/\.(png|jpe?g|webp|gif|svg)$/i)) {
      return <img src={src} alt="" className="max-h-40 object-contain" />;
    }
    return <a className="underline text-sm" href={src} target="_blank" rel="noreferrer">{src}</a>;
  }
  if (spec.kind === 'gallery') {
    const items = asList(value).filter((src) => src.startsWith('/') || src.startsWith('http'));
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((src) => <img key={src} src={src} alt="" className="h-16 w-16 object-contain" style={{ border: '1px solid var(--ad-line)' }} />)}
      </div>
    );
  }
  if (spec.kind === 'faq') {
    const items = Array.isArray(value) ? value : [];
    return (
      <ol className="space-y-2">
        {items.map((item, i) => {
          const row = typeof item === 'string' ? { q: item, a: '' } : item as { q?: string; a?: string };
          return (
            <li key={i} className="ad-card p-3">
              <div className="text-xs font-black" style={{ color: 'var(--ad-accent)' }}>Q{i + 1}. {row.q || '—'}</div>
              <p className="text-sm mt-1">{row.a || '—'}</p>
            </li>
          );
        })}
      </ol>
    );
  }
  if (spec.kind === 'specs') {
    const entries = value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : [];
    return (
      <dl className="space-y-1 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="font-bold min-w-32">{k}</dt><dd>{formatObject(v)}</dd></div>
        ))}
      </dl>
    );
  }
  if (spec.kind === 'options') {
    const items = Array.isArray(value) ? value : [];
    return (
      <ul className="space-y-2">
        {items.map((item, i) => {
          const row = item as { name?: string; choices?: string[] };
          return (
            <li key={i} className="ad-card p-3 text-sm">
              <div className="font-black">{row.name || `Option ${i + 1}`}</div>
              <div style={{ color: 'var(--ad-muted)' }}>{asList(row.choices).join(' · ') || '—'}</div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (spec.kind === 'agenda') {
    const items = Array.isArray(value) ? value : [];
    return (
      <ul className="space-y-1 text-sm">
        {items.map((item, i) => {
          const row = typeof item === 'string' ? { time: '', title: item } : item as { time?: string; title?: string };
          return <li key={i}><b>{row.time || '—'}</b> · {row.title || '—'}</li>;
        })}
      </ul>
    );
  }
  if (spec.kind === 'process' || spec.key === 'workflow') {
    return <ProcessFlow steps={normalizeSteps(value)} />;
  }
  if (spec.kind === 'list' || spec.kind === 'tags') {
    const items = asList(value);
    if (spec.key === 'workflow') return <ProcessFlow steps={normalizeSteps(value)} />;
    return (
      <ul className="flex flex-wrap gap-1">
        {items.map((item, i) => <li key={i} className="ad-chip ad-chip-acc">{item}</li>)}
      </ul>
    );
  }
  if (spec.kind === 'slides' || spec.kind === 'sections') {
    const items = Array.isArray(value) ? value : [];
    return (
      <ul className="space-y-2">
        {items.map((item, i) => {
          const row = item as Record<string, unknown>;
          return (
            <li key={i} className="ad-card p-3 text-sm">
              <div className="font-black">{String(row.title || `Bloc ${i + 1}`)}</div>
              {row.subtitle ? <div style={{ color: 'var(--ad-muted)' }}>{String(row.subtitle)}</div> : null}
              {row.description ? <p className="mt-1">{String(row.description)}</p> : null}
            </li>
          );
        })}
      </ul>
    );
  }
  if (spec.kind === 'rating') {
    return <div className="text-sm font-black">{'★'.repeat(Number(value) || 0)}{'☆'.repeat(Math.max(0, 5 - Number(value || 0)))}</div>;
  }
  if (spec.kind === 'toggle') {
    return <span className={`ad-chip ${value ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{value ? tCommon('yes') : tCommon('no')}</span>;
  }
  // Traduire les valeurs radio (options statiques comme langue, statut)
  if (spec.kind === 'radio') {
    const strValue = String(value);
    const option = spec.options?.find(o => o.value === strValue);
    return <div className="text-sm font-semibold break-words">{option?.label || strValue}</div>;
  }
  if (typeof value === 'object') {
    return <div className="text-sm">{formatObject(value)}</div>;
  }
  return <div className="text-sm font-semibold break-words">{String(value)}</div>;
}
