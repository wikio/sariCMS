'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Globe, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  allTaxonomies, removeTaxonomyTerm, saveTaxonomy, TAXONOMY_LOCALES,
  termLabel, type TaxonomyLocale, type TaxonomyTerm,
} from '@/lib/taxonomies';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';

export default function TaxonomiesPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.taxonomies');
  const tCommon = useTranslations('admin.common');
  const [groups, setGroups] = useState(allTaxonomies());
  const [tab, setTab] = useState(groups[0]?.key || 'products.category');
  const [locale, setLocale] = useState<TaxonomyLocale>('fr');
  const [draft, setDraft] = useState<TaxonomyTerm | null>(null);
  const [original, setOriginal] = useState<TaxonomyTerm | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');

  /** Traduit un label d'onglet de taxonomie via les clés admin.taxonomies.tab_XXX */
  const tabLabel = (key: string) => {
    const k = `tab_${key}` as any;
    try { const r = t(k); if (typeof r === 'string' && r !== k && !r.startsWith('admin.')) return r; } catch {}
    return key;
  };

  /** Traduit un hint de taxonomie via les clés admin.taxonomies.hint_XXX */
  const tabHint = (key: string) => {
    const k = `hint_${key}` as any;
    try { const r = t(k); if (typeof r === 'string' && r !== k && !r.startsWith('admin.')) return r; } catch {}
    return '';
  };

  const langName = (l: string) => {
    if (l === 'fr') return t('french');
    if (l === 'en') return t('english');
    return t('arabic');
  };

  const setTranslation = (l: TaxonomyLocale, v: string) => {
    setDraft((d) => {
      if (!d) return d;
      const next: TaxonomyTerm = { ...d, translations: { ...(d.translations || {}), [l]: v } };
      if (l === 'fr') next.label = v;
      return next;
    });
  };

  const refresh = () => setGroups(allTaxonomies());
  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener('sari-taxonomies', on);
    return () => window.removeEventListener('sari-taxonomies', on);
  }, []);

  const current = useMemo(() => groups.find((g) => g.key === tab) || groups[0], [groups, tab]);

  const persist = (terms: TaxonomyTerm[]) => {
    if (!current) return;
    saveTaxonomy(current.key, terms);
    refresh();
    showToast(t('saved'), 'success');
    setDraft(null);
  };

  const drawerTitle = mode === 'consult'
    ? `${t('consultTermTitle')} · ${draft?.label}`
    : original ? t('editTermTitle') : t('newTermTitle');

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="ad-breadcrumb">{t('breadcrumb')}</div>
        <h1 className="text-3xl font-black tracking-tight">{t('title')}</h1>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t('subtitle')}</p>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {groups.map((g) => (
          <button key={g.key} type="button" className={`ad-btn ${current?.key === g.key ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setTab(g.key)}>
            {tabLabel(g.key)}
          </button>
        ))}
        <span className="flex-1" />
        <div className="flex items-center gap-1 ad-card px-2 py-1">
          <Globe className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />
          {TAXONOMY_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`px-2 py-1 rounded uppercase text-xs font-black ${locale === l ? 'text-white' : 'opacity-50 hover:opacity-100'}`}
              style={{ background: locale === l ? 'var(--ad-accent)' : 'transparent' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {current && (
        <section className="ad-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black">{tabLabel(current.key)}</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{tabHint(current.key)}</p>
            </div>
            <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setOriginal(null); setDraft({ value: '', label: '' }); }}>
              <Plus className="w-4 h-4" /> {t('addTerm')}
            </button>
          </div>
          <table className="ad-table">
            <thead>
              <tr>
                <th>{t('value')}</th>
                <th>{t('labelColumn')} ({locale.toUpperCase()})</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {current.terms.map((term) => (
                <tr key={term.value}>
                  <td className="font-mono text-sm">{term.value}</td>
                  <td>{termLabel(term, locale)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setOriginal(term); setDraft({ ...term }); }}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setOriginal(term); setDraft({ ...term }); }}>
                      <Pencil className="w-4 h-4" /> {t('editTerm')}
                    </button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => { removeTaxonomyTerm(current.key, term.value); refresh(); }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Drawer
        open={!!draft && !!current}
        title={drawerTitle}
        onClose={() => setDraft(null)}
        footer={mode === 'consult' ? (
          <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>{t('close')}</button>
        ) : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>{tCommon('cancel')}</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft || !current || !draft.value.trim()) return;
              const next = original
                ? current.terms.map((t) => (t.value === original.value ? { value: draft.value.trim(), label: draft.label.trim() || draft.value } : t))
                : [...current.terms, { value: draft.value.trim(), label: draft.label.trim() || draft.value }];
              persist(next);
            }}>{t('save')}</button>
          </>
        )}
      >
        {draft && (
          <>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('internalValue')}</span>
              <input className="ad-input" disabled={mode === 'consult'} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="slug-interne" />
            </label>
            <div className="space-y-2">
              {TAXONOMY_LOCALES.map((l) => (
                <label key={l} className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {langName(l)}
                  </span>
                  <input
                    className="ad-input"
                    disabled={mode === 'consult'}
                    value={draft.translations?.[l] ?? ''}
                    onChange={(e) => setTranslation(l, e.target.value)}
                    placeholder={l === 'fr' ? t('sourcePlaceholder') : t('translationPlaceholder')}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
              {t('sourceHint')}
            </p>
          </>
        )}
      </Drawer>
    </div>
  );
}
