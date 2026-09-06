'use client';

/**
 * Panneau « Sélection » d'un bloc de la page d'accueil : quelles fiches du CMS
 * le bloc affiche, et dans quel ordre.
 *
 * - mode automatique : le site prend les N premières fiches selon le tri choisi ;
 * - mode manuel : les fiches sont ajoutées une à une depuis la liste du module
 *   concerné (brouillons inclus, marqués comme tels) et l'ordre obtenu par
 *   glisser-déposer ou par les flèches est celui de la vitrine.
 *
 * Une fiche supprimée côté module n'est pas un drame : elle disparaît
 * simplement de la sélection, sans casser la page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus, Search, Settings2, X } from 'lucide-react';
import { fetchHomeOptions } from '@/lib/home/client';
import type { HomeOption } from '@/lib/home/config';
import type { HomeField, HomePicker } from '@/lib/home/catalog';
import { limitOf, numberSetting, type HomeItem, type HomeSectionConfig } from '@/lib/home/config';
import HomeFieldControl from '@/components/admin/home/HomeField';
import { useToast } from '@/components/admin/Toast';

interface Props {
  picker: HomePicker;
  config: HomeSectionConfig;
  locale: string;
  onChange: (config: HomeSectionConfig) => void;
  /** Réglages affichés sous le sélecteur (nombre, tri, « à venir seulement »…). */
  settingFields?: HomeField[];
  disabled?: boolean;
}

export default function HomePickerPanel({ picker, config, locale, onChange, settingFields = [], disabled }: Props) {
  const t = useTranslations('admin.home');
  const { showToast } = useToast();
  const [options, setOptions] = useState<HomeOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const [tuning, setTuning] = useState<string | null>(null);

  /**
   * Réglage d'une fiche sélectionnée (titre d'un slide, par exemple) : il est
   * range dans `items` sous l'identifiant de la fiche, donc la fiche du module
   * n'est pas modifiée — seule la page d'accueil change.
   */
  const patchItem = useCallback(
    (id: string, key: string, value: unknown) => {
      const items: HomeItem[] = Array.isArray(config.items) ? [...config.items] : [];
      const index = items.findIndex((item) => String(item.id) === id);
      const next: HomeItem = { ...(index >= 0 ? items[index] : { id }) };
      if (value === undefined || value === '' || value === null) delete next[key];
      else next[key] = value;
      if (index >= 0) items[index] = next;
      else items.push(next);
      onChange({ ...config, items });
    },
    [config, onChange],
  );

  const overridesOf = (id: string): HomeItem =>
    (Array.isArray(config.items) ? config.items : []).find((item) => String(item.id) === id) || ({ id } as HomeItem);

  const ids = useMemo(() => (config.selection?.ids || []).map(String), [config.selection]);
  const manual = config.selection?.mode === 'manual';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHomeOptions(picker.resource, locale)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setOptions([]);
          showToast(err.message, 'warning');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [picker.resource, locale, showToast]);

  const byId = useMemo(() => new Map((options || []).map((option) => [String(option.id), option])), [options]);

  const patchSelection = (next: Partial<HomeSectionConfig['selection']>) =>
    onChange({ ...config, selection: { ...config.selection, ...next } as HomeSectionConfig['selection'] });

  const add = (id: string) => {
    if (ids.includes(id)) return;
    patchSelection({ mode: 'manual', ids: [...ids, id] });
  };
  const remove = (id: string) => patchSelection({ ids: ids.filter((value) => value !== id) });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    patchSelection({ ids: next });
  };

  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as HomeOption[];
  // Une fiche choisie peut avoir été retirée du catalogue depuis : on la liste
  // quand même (sinon l'administrateur ne peut pas la enlever proprement).
  const orphans = ids.filter((id) => !byId.has(id));

  const available = (options || []).filter(
    (option) =>
      !ids.includes(String(option.id)) &&
      (!query.trim() ||
        String(option.title || '').toLowerCase().includes(query.trim().toLowerCase()) ||
        String(option.meta || '').toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--ad-line)' }}>
          {[
            { value: 'auto', label: t('autoMode') },
            { value: 'manual', label: t('manualMode') },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              disabled={disabled || (mode.value === 'auto' && !picker.allowAuto)}
              className={`px-3 py-1.5 text-xs font-bold transition ${manual === (mode.value === 'manual') ? 'text-white' : ''}`}
              style={{
                background: manual === (mode.value === 'manual') ? 'var(--ad-accent)' : 'transparent',
                color: manual === (mode.value === 'manual') ? 'var(--ad-accent-ink)' : 'inherit',
              }}
              onClick={() => patchSelection({ mode: mode.value as 'auto' | 'manual' })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--ad-muted)' }}>
          {manual ? t('manualHint', { count: ids.length }) : t('autoHint', { count: limitOf(config, picker.defaultLimit) })}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {settingFields.map((field) => (
          <HomeFieldControl key={field.key} field={field} config={config} onChange={onChange} disabled={disabled} />
        ))}
      </div>

      {manual ? (
        <div className="ad-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
              {t('orderedSelection')}
            </h4>
            <button type="button" className="ad-btn ad-btn-ghost text-xs" disabled={disabled || loading} onClick={() => setDialog(true)}>
              <Plus className="w-3.5 h-3.5" /> {t('addCards')}
            </button>
          </div>
          {ordered.length === 0 && orphans.length === 0 ? (
            <p className="text-sm py-3 text-center" style={{ color: 'var(--ad-muted)' }}>
              {t('nothingSelected')}
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {ids.map((id, index) => {
              const option = byId.get(id);
              const title = option?.title || `${t('deletedCard')} · ${id}`;
              return (
                <li
                  key={id}
                  draggable={!disabled}
                  onDragStart={() => setDrag(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag !== null) move(drag, index);
                    setDrag(null);
                  }}
                  onDragEnd={() => setDrag(null)}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 bg-transparent ${drag === index ? 'opacity-50' : ''}`}
                  style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface)' }}
                >
                  <GripVertical className="w-3.5 h-3.5 opacity-50 cursor-grab" />
                  <span className="w-5 text-xs tabular-nums text-center opacity-60">{index + 1}</span>
                  {option?.image ? (
                    // Aperçu de fiche : contenu dynamique, non optimisé par Next.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.image} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded" style={{ background: 'var(--ad-line)' }} />
                  )}
                  {picker.overrideFields?.length ? (
                    <button
                      type="button"
                      className={`ad-btn-icon ${tuning === id ? 'is-active' : ''}`}
                      title={picker.overrideLabel || t('tuneCard')}
                      aria-label={picker.overrideLabel || t('tuneCard')}
                      onClick={() => setTuning(tuning === id ? null : id)}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  <span className="flex-1 text-sm font-semibold truncate">{title}</span>
                  {option?.status && option.status !== 'published' ? <span className="ad-chip ad-chip-warn text-[10px]">{option.status}</span> : null}
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="ad-btn-icon" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={t('moveUp')}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="ad-btn-icon" disabled={disabled || index === ids.length - 1} onClick={() => move(index, index + 1)} aria-label={t('moveDown')}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="ad-btn-icon" disabled={disabled} onClick={() => remove(id)} aria-label={t('removeFromBlock')}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {tuning === id && picker.overrideFields?.length ? (
                    <div className="w-full md:max-w-[420px] grid grid-cols-2 gap-2 px-2 pb-1 border-t" style={{ borderColor: 'var(--ad-line)' }}>
                      <div className="col-span-2 flex items-center gap-1.5 pt-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                        {picker.overrideLabel || t('tuneCard')}
                      </div>
                      {picker.overrideFields.map((field) => {
                        const raw = overridesOf(id)[field.key];
                        const locked = Boolean(disabled) && field.kind !== 'text' && field.kind !== 'textarea';
                        const control =
                          field.kind === 'textarea' ? (
                            <textarea className="ad-input min-h-[70px]" disabled={locked} value={String(raw ?? '')} placeholder={field.placeholder} onChange={(e) => patchItem(id, field.key, e.target.value)} />
                          ) : field.kind === 'toggle' ? (
                            <button
                              type="button"
                              className={`ad-toggle ${raw === false ? '' : 'is-on'}`}
                              disabled={locked}
                              onClick={() => patchItem(id, field.key, raw === false)}
                            >
                              <span className="ad-toggle-knob" />
                              <span className="ad-toggle-label">{raw === false ? t('no') : t('yes')}</span>
                            </button>
                          ) : field.kind === 'image' ? (
                            <input className="ad-input" disabled={locked} value={String(raw ?? '')} placeholder="https://…" onChange={(e) => patchItem(id, field.key, e.target.value)} />
                          ) : (
                            <input className="ad-input" disabled={locked} value={String(raw ?? '')} maxLength={field.max} placeholder={field.placeholder} onChange={(e) => patchItem(id, field.key, e.target.value)} />
                          );
                        return (
                          <label key={field.key} className={`space-y-1 block ${field.wide ? 'col-span-2' : ''}`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                              {field.label}
                              {field.i18n ? ` · ${t('perLanguage')}` : ''}
                            </span>
                            {locked ? (
                              <p className="text-[11px] italic" style={{ color: 'var(--ad-muted)' }}>
                                {t('structureInRef', { locale: t('refLocale') })}
                              </p>
                            ) : (
                              control
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {Number.isFinite(numberSetting(config, 'limit', 0)) && numberSetting(config, 'limit', 0) > 0 && ids.length > numberSetting(config, 'limit', 0) ? (
            <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
              {t('selectionOverLimit', { shown: numberSetting(config, 'limit', 0), selected: ids.length })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm ad-card p-3" style={{ color: 'var(--ad-muted)' }}>
          {t('autoPreview', { count: limitOf(config, picker.defaultLimit) })}
          {options ? ` · ${options.length} ${t('cardsAvailable')}` : ''}
        </p>
      )}

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0" style={{ background: 'rgba(8,12,20,.6)' }} onClick={() => setDialog(false)} />
          <div className="ad-modal-card relative w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--ad-line)' }}>
              <h3 className="font-black">{picker.label}</h3>
              <div className="ms-auto relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
                <input autoFocus className="ad-input ad-input-icon ps-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchCards')} />
              </div>
              <button type="button" className="ad-btn-icon" onClick={() => setDialog(false)} aria-label={t('close')}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="ad-scroll overflow-y-auto p-3 space-y-1.5">
              {loading ? <p className="text-sm py-6 text-center" style={{ color: 'var(--ad-muted)' }}>{t('loading')}</p> : null}
              {!loading && !available.length ? <p className="text-sm py-6 text-center" style={{ color: 'var(--ad-muted)' }}>{t('noCards')}</p> : null}
              {available.map((option) => (
                <button
                  key={String(option.id)}
                  type="button"
                  className="w-full flex items-center gap-3 text-start rounded-lg border px-3 py-2 hover:border-sari-blue transition"
                  style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface)' }}
                  onClick={() => {
                    add(String(option.id));
                    showToast(t('added', { title: option.title }), 'success');
                  }}
                >
                  {option.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.image} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded" style={{ background: 'var(--ad-line)' }} />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate">{option.title}</span>
                    <span className="block text-xs truncate" style={{ color: 'var(--ad-muted)' }}>
                      {[option.meta, option.locale].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {option.status && option.status !== 'published' ? <span className="ad-chip ad-chip-warn text-[10px]">{option.status}</span> : null}
                  <Plus className="w-4 h-4" />
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--ad-line)' }}>
              <span className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                {t('selectedCount', { count: ids.length })}
              </span>
              <button type="button" className="ad-btn ad-btn-primary" onClick={() => setDialog(false)}>
                {t('done')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
