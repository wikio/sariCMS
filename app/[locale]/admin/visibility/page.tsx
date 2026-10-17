'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, Loader2, RotateCcw, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  copyVisibility, fetchAllVisibility, mergeVisibility, resetVisibility,
  setVisibility, setVisibilityGroup, VISIBILITY_GROUPS,
} from '@/lib/site-visibility';
import { useToast } from '@/components/admin/Toast';

const LOCALES = ['fr', 'en', 'ar'] as const;
const LOCALE_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};

export default function VisibilityPage() {
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const t = useTranslations('admin.visibility');
  const tLabels = useTranslations('admin.visibilityLabels');

  /** Langue en cours d'édition — indépendante de la langue de l'admin. */
  const [locale, setLocale] = useState<string>('fr');
  /** Exceptions enregistrées, par langue. */
  const [all, setAll] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setAll(await fetchAllVisibility([...LOCALES]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  /** État complet de la langue affichée : défauts + exceptions. */
  const vis = useMemo(() => mergeVisibility(all[locale]), [all, locale]);

  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => VISIBILITY_GROUPS.map((g) => ({
    ...g,
    items: needle
      ? g.items.filter((i) => `${i.label} ${i.key}`.toLowerCase().includes(needle))
      : g.items,
  })).filter((g) => g.items.length > 0), [needle]);

  const visibleCount = Object.values(vis).filter(Boolean).length;
  const totalCount = Object.values(vis).length;

  /** Nombre de réglages qui s'écartent des valeurs par défaut, par langue. */
  const overrideCount = (l: string) => Object.keys(all[l] || {}).length;

  const guard = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      showToast(success, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Échec de l’enregistrement', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="ad-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="ad-breadcrumb">{t('breadcrumb')}</div>
          <h1 className="text-3xl font-black tracking-tight">{t('title')}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
            {t('description', { visible: visibleCount, total: totalCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ad-btn ad-btn-ghost"
            disabled={busy || loading}
            onClick={() => guard(
              () => copyVisibility(locale),
              `Réglages de ${LOCALE_LABELS[locale]} copiés vers les autres langues`,
            )}
          >
            <Copy className="w-4 h-4" /> Copier vers les autres langues
          </button>
          <button
            type="button"
            className="ad-btn ad-btn-ghost"
            disabled={busy || loading}
            onClick={() => guard(() => resetVisibility(locale), t('resetSuccess'))}
          >
            <RotateCcw className="w-4 h-4" /> {t('reset')}
          </button>
        </div>
      </header>

      {/* Sélecteur de langue : les réglages sont propres à chacune. */}
      <div className="ad-card p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ad-muted)' }}>
          Langue
        </span>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={`ad-btn ${locale === l ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          >
            {LOCALE_LABELS[l]}
            {overrideCount(l) > 0 && (
              <span className="ml-1.5 text-[10px] opacity-70">({overrideCount(l)})</span>
            )}
          </button>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--ad-muted)' }}>
          Enregistré en base — s’applique à tous les visiteurs de cette langue.
        </span>
      </div>

      <div className="ad-card p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
          <input className="ad-input ad-input-icon pl-9" placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="ad-card p-10 text-center flex items-center justify-center gap-2" style={{ color: 'var(--ad-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {groups.map((g) => {
            const allOn = g.items.every((i) => vis[i.key]);
            const groupLabel = g.labelKey ? tLabels(g.labelKey) : g.label;
            return (
              <section key={g.key} className="ad-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black">{groupLabel}</h2>
                    <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('itemsCount', { count: g.items.length })}</p>
                  </div>
                  <button
                    type="button"
                    className={`ad-btn ${allOn ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                    disabled={busy}
                    onClick={() => guard(
                      () => setVisibilityGroup(locale, g.key, !allOn),
                      !allOn ? t('groupShown', { group: groupLabel }) : t('groupHidden', { group: groupLabel }),
                    )}
                  >
                    {allOn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {allOn ? t('hideAll') : t('showAll')}
                  </button>
                </div>
                <div className="space-y-1">
                  {g.items.map((i) => (
                    <div key={i.key} className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--ad-line)' }}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold flex items-center gap-2">
                          {vis[i.key] ? <Eye className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} /> : <EyeOff className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />}
                          {i.labelKey ? tLabels(i.labelKey) : i.label}
                        </div>
                        {i.hint && <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{i.hint}</div>}
                        <div className="text-[10px] font-mono opacity-50">{i.key}</div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => guard(
                          () => setVisibility(locale, i.key, !vis[i.key]),
                          vis[i.key] ? t('hidden') : t('visible'),
                        )}
                        className={`ad-toggle ${vis[i.key] ? 'is-on' : ''}`}
                        aria-pressed={vis[i.key]}
                        role="switch"
                      >
                        {vis[i.key] ? (<><span className="ad-toggle-label">{t('visible')}</span><span className="ad-toggle-knob" /></>) : (<><span className="ad-toggle-knob" /><span className="ad-toggle-label">{t('hidden')}</span></>)}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {groups.length === 0 && (
            <div className="col-span-full ad-card p-10 text-center" style={{ color: 'var(--ad-muted)' }}>{t('noResults', { query: q })}</div>
          )}
        </div>
      )}
    </div>
  );
}
