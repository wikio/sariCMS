'use client';

/**
 * Configuration d'un sous-menu généré depuis le contenu.
 *
 * Contrairement aux sous-liens saisis à la main, on n'enregistre pas la liste
 * mais la règle qui la produit (`lib/menu-auto.ts`). La vitrine la résout à
 * l'affichage : une fiche publiée ensuite apparaît d'elle-même, une fiche
 * archivée disparaît.
 *
 * L'aperçu affiché ici applique exactement la même fonction de résolution que
 * la vitrine, pour qu'il n'y ait pas d'écart entre ce que voit l'éditeur et ce
 * que verra le visiteur.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Eye, Layers, Loader2, X } from 'lucide-react';
import { cmsAdminList } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import {
  AUTO_SOURCES,
  entityLabel,
  isPublished,
  resolveAutoSubmenu,
  type AutoEntity,
  type AutoRule,
  type AutoSource,
} from '@/lib/menu-auto';

const SOURCES: AutoSource[] = ['solutions', 'services', 'products', 'news', 'events'];

export default function AutoSubmenuPicker({
  value,
  onChange,
}: {
  value?: AutoRule | null;
  onChange: (rule: AutoRule | null) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('admin.menus');
  const [entities, setEntities] = useState<AutoEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rule = value || null;
  const source = rule?.source;

  useEffect(() => {
    if (!source) { setEntities([]); return; }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        // L'administration liste tous les statuts : on filtre ensuite avec la
        // même règle que la vitrine, ce qui permet d'indiquer à l'éditeur
        // combien de fiches sont masquées parce qu'archivées.
        const rows: AutoEntity[] = [];
        for (let page = 1; page <= 20; page += 1) {
          const chunk = await cmsAdminList<AutoEntity>(source, {
            limit: '100',
            page: String(page),
            filter: JSON.stringify({ locale }),
          });
          rows.push(...chunk);
          if (chunk.length < 100) break;
        }
        if (!cancelled) setEntities(rows);
      } catch (err) {
        if (!cancelled) {
          setEntities([]);
          setError(err instanceof CmsError ? err.message : t('autoLoadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [source, locale, t]);

  const published = useMemo(() => entities.filter(isPublished), [entities]);
  const hiddenCount = entities.length - published.length;

  // Aperçu : exactement la résolution utilisée par la vitrine.
  const preview = useMemo(
    () => (rule ? resolveAutoSubmenu(rule, entities, locale) : []),
    [rule, entities, locale],
  );

  const setRule = (patch: Partial<AutoRule>) => {
    if (!rule) return;
    onChange({ ...rule, ...patch });
  };

  const toggleId = (id: string) => {
    if (!rule) return;
    const ids = (rule.ids || []).map(String);
    onChange({
      ...rule,
      ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    });
  };

  if (!rule) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
          {t('autoTitle')}
        </span>
        {SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            className="ad-btn ad-btn-ghost"
            onClick={() => onChange({ source: s, mode: 'all', ids: [], limit: 0 })}
          >
            <Layers className="w-4 h-4" /> {t(`source_${s}`)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="ad-card p-3 space-y-3" style={{ background: 'var(--ad-surface-2)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-accent)' }}>
          <Layers className="w-4 h-4 inline me-1" />
          {t('autoActive', { source: t(`source_${rule.source}`) })}
        </div>
        <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" title={t('autoRemove')} onClick={() => onChange(null)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('autoHint')}</p>

      {/* Module source */}
      <div className="flex flex-wrap gap-1">
        {SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            className={`ad-btn ${rule.source === s ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
            onClick={() => onChange({ source: s, mode: 'all', ids: [], limit: rule.limit || 0 })}
          >
            {t(`source_${s}`)}
          </button>
        ))}
      </div>

      {/* Tout ou sélection */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`ad-btn ${rule.mode === 'all' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          onClick={() => setRule({ mode: 'all' })}
        >
          {t('modeAll')}
        </button>
        <button
          type="button"
          className={`ad-btn ${rule.mode === 'pick' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          onClick={() => setRule({ mode: 'pick' })}
        >
          {t('modePick')}
        </button>

        <label className="flex items-center gap-2 text-xs ms-auto" style={{ color: 'var(--ad-muted)' }}>
          {t('limitLabel')}
          <input
            type="number"
            min={0}
            className="ad-input w-20"
            value={rule.limit || 0}
            onChange={(e) => setRule({ limit: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
      </div>

      {loading && (
        <div className="text-xs flex items-center gap-2" style={{ color: 'var(--ad-muted)' }}>
          <Loader2 className="w-3 h-3 animate-spin" /> {t('autoLoading')}
        </div>
      )}
      {error && <div className="text-xs" style={{ color: 'var(--ad-danger, #e11d48)' }}>{error}</div>}

      {/* Sélection manuelle */}
      {rule.mode === 'pick' && !loading && (
        <div className="max-h-52 overflow-auto space-y-1 pe-1">
          {published.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('autoEmpty')}</p>
          ) : (
            published.map((entity) => {
              const id = String(entity.id ?? '');
              const checked = (rule.ids || []).map(String).includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className="w-full text-start px-2 py-1.5 rounded flex items-center gap-2 hover:opacity-80"
                  style={{ background: checked ? 'var(--ad-bg)' : 'transparent' }}
                  onClick={() => toggleId(id)}
                >
                  <span
                    className="w-4 h-4 shrink-0 rounded flex items-center justify-center"
                    style={{ border: '1px solid var(--ad-line)', background: checked ? 'var(--ad-accent)' : 'transparent' }}
                  >
                    {checked && <Check className="w-3 h-3" style={{ color: '#fff' }} />}
                  </span>
                  <span className="text-sm truncate">{entityLabel(entity, rule.source)}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Aperçu du rendu vitrine */}
      {!loading && (
        <div className="space-y-1">
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
            <Eye className="w-3 h-3 inline me-1" />
            {t('previewTitle', { count: preview.length })}
          </div>
          {preview.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('previewEmpty')}</p>
          ) : (
            <ul className="text-xs space-y-0.5">
              {preview.slice(0, 8).map((node) => (
                <li key={node.id} className="truncate" style={{ color: 'var(--ad-muted)' }}>
                  · {node.label} <span className="opacity-60">{node.href}</span>
                </li>
              ))}
              {preview.length > 8 && (
                <li style={{ color: 'var(--ad-muted)' }}>… +{preview.length - 8}</li>
              )}
            </ul>
          )}
          {hiddenCount > 0 && (
            <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
              {t('hiddenNotice', { count: hiddenCount })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
