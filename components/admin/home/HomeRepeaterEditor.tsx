'use client';

/**
 * Éditeur de liste pour les blocs « composés » de la page d'accueil
 * (blocs impairs, chiffres, arguments de la newsletter, tuiles de navigation).
 *
 * Chaque ligne est un élément du bloc : on l'ajoute, on le duplique, on le
 * déplace, on le masque sans le supprimer. Les champs marqués traduits sont
 * saisis pour la langue en cours ; les autres (image, lien, icône) sont communs
 * aux trois langues, comme le reste de la structure.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { HomeRepeater, HomeRepeaterField } from '@/lib/home/catalog';
import type { HomeItem, HomeSectionConfig } from '@/lib/home/config';

const TEXT_FIELD = 'ad-input w-full';

function readItem(item: HomeItem, key: string): unknown {
  return item[key];
}

function writeItem(item: HomeItem, key: string, value: unknown): HomeItem {
  const next: HomeItem = { ...item };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next;
}

export default function HomeRepeaterEditor({
  repeater,
  config,
  onChange,
  disabled,
  withTexts = true,
}: {
  repeater: HomeRepeater;
  config: HomeSectionConfig;
  onChange: (config: HomeSectionConfig) => void;
  disabled?: boolean;
  /** Les langues non références n'éditent que les textes des éléments. */
  withTexts?: boolean;
}) {
  const t = useTranslations('admin.home');
  const [open, setOpen] = useState<number | null>(0);

  const items = Array.isArray(config.items) ? (config.items as HomeItem[]) : [];
  const setItems = (next: HomeItem[]) => onChange({ ...config, items: next });

  const update = (index: number, item: HomeItem) => setItems(items.map((row, i) => (i === index ? item : row)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };
  const remove = (index: number) => setItems(items.filter((_, i) => i !== index));
  const duplicate = (index: number) => {
    const copy = { ...items[index], id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
    setItems([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
    setOpen(index + 1);
  };
  const add = () => {
    const fresh: HomeItem = { id: `item-${Date.now().toString(36)}`, ...repeater.defaults, enabled: true };
    setItems([...items, fresh]);
    setOpen(items.length);
  };

  const editableFields = (field: HomeRepeaterField) =>
    withTexts || field.kind === 'text' || field.kind === 'textarea' ? true : false;

  const titleOf = (item: HomeItem) => {
    const raw = String(item[repeater.titleKey] ?? '').trim();
    return raw || t('untitledElement');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
          {t('elementsCount', { count: items.length })}
          {!withTexts ? ` · ${t('textsOnlyNote')}` : ''}
        </p>
        <button type="button" className="ad-btn ad-btn-primary text-xs" disabled={disabled} onClick={add}>
          <Plus className="w-3.5 h-3.5" /> {t('addElement')}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="ad-card p-6 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>
          {t('emptyList')}
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item, index) => {
          const expanded = open === index;
          const off = item.enabled === false;
          return (
            <li key={String(item.id ?? index)} className="ad-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="w-4 h-4 opacity-40" />
                <button
                  type="button"
                  className="flex-1 text-start text-sm font-bold truncate"
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  {titleOf(item)}
                  {off ? <span className="ad-chip ad-chip-mute ms-2 text-[10px]">{t('hiddenChip')}</span> : null}
                </button>
                <div className="flex items-center gap-0.5">
                  <button type="button" className="ad-btn-icon" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={t('moveUp')}>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="ad-btn-icon" disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)} aria-label={t('moveDown')}>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="ad-btn-icon" disabled={disabled} onClick={() => update(index, writeItem(item, 'enabled', off ? true : false))} aria-label={t('toggleElement')}>
                    {off ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" className="ad-btn-icon" disabled={disabled} onClick={() => duplicate(index)} aria-label={t('duplicateElement')}>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="ad-btn-icon" disabled={disabled} onClick={() => remove(index)} aria-label={t('deleteElement')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="px-3 pb-3 pt-1 grid md:grid-cols-2 gap-3 border-t" style={{ borderColor: 'var(--ad-line)' }}>
                  {repeater.fields.map((field) => {
                    const locked = !editableFields(field);
                    return (
                      <label key={field.key} className={`space-y-1.5 block ${field.wide ? 'md:col-span-2' : ''}`}>
                        <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                          {field.label}
                          {field.i18n ? <span className="ms-2 normal-case tracking-normal opacity-70">· {t('perLanguage')}</span> : null}
                        </span>
                        {locked ? (
                          <p className="text-xs italic" style={{ color: 'var(--ad-muted)' }}>
                            {t('structureInRef', { locale: t('refLocale') })}
                          </p>
                        ) : field.kind === 'textarea' ? (
                          <textarea className={`${TEXT_FIELD} min-h-[80px]`} value={String(readItem(item, field.key) ?? '')} placeholder={field.placeholder} disabled={disabled} onChange={(e) => update(index, writeItem(item, field.key, e.target.value))} />
                        ) : field.kind === 'number' ? (
                          <input
                            className={TEXT_FIELD}
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={String(readItem(item, field.key) ?? '')}
                            disabled={disabled}
                            onChange={(e) => update(index, writeItem(item, field.key, e.target.value === '' ? undefined : Number(e.target.value)))}
                          />
                        ) : field.kind === 'toggle' ? (
                          <button
                            type="button"
                            className={`ad-toggle ${readItem(item, field.key) ? 'is-on' : ''}`}
                            disabled={disabled}
                            onClick={() => update(index, writeItem(item, field.key, !readItem(item, field.key)))}
                          >
                            <span className="ad-toggle-knob" />
                            <span className="ad-toggle-label">{readItem(item, field.key) ? t('yes') : t('no')}</span>
                          </button>
                        ) : field.kind === 'select' ? (
                          <select className={TEXT_FIELD} value={String(readItem(item, field.key) ?? '')} disabled={disabled} onChange={(e) => update(index, writeItem(item, field.key, e.target.value))}>
                            <option value="">{t('defaultValue')}</option>
                            {(field.options || []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : field.kind === 'color' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-10 h-10 rounded-lg border bg-transparent"
                              style={{ borderColor: 'var(--ad-line)' }}
                              value={/^#[0-9a-f]{6}$/i.test(String(readItem(item, field.key) ?? '')) ? String(readItem(item, field.key)) : '#169ec9'}
                              disabled={disabled}
                              onChange={(e) => update(index, writeItem(item, field.key, e.target.value))}
                            />
                            <input className={TEXT_FIELD} value={String(readItem(item, field.key) ?? '')} disabled={disabled} onChange={(e) => update(index, writeItem(item, field.key, e.target.value))} />
                          </div>
                        ) : (
                          <input className={TEXT_FIELD} value={String(readItem(item, field.key) ?? '')} placeholder={field.placeholder} maxLength={field.max} disabled={disabled} onChange={(e) => update(index, writeItem(item, field.key, e.target.value))} />
                        )}
                        {field.kind === 'image' && readItem(item, field.key) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={String(readItem(item, field.key))} alt="" className="w-full max-w-[220px] h-24 object-cover rounded-lg border" style={{ borderColor: 'var(--ad-line)' }} />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
