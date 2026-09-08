'use client';

/**
 * Éditeur d'un bloc de la page d'accueil.
 *
 * Cinq onglets, les mêmes pour tous les blocs, peuplés par le catalogue
 * (`lib/home/catalog.ts`) : Textes (traduits), Réglages, Sélection (fiches du
 * CMS ou éléments composés par le bloc), Apparence, Constructeur de page.
 *
 * En langue non référencée (tout sauf le français), l'onglet Apparence, les
 * Réglages et la Sélection sont verrouillés : la mise en page est commune aux
 * trois langues, seule la traduction change. C'est ce qui empêche une saisie
 * anglaise de retirer un produit de la version arabe.
 */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Eye, Monitor, Paintbrush, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { HomeCatalogEntry, HomeField } from '@/lib/home/catalog';
import { HOME_LAYOUT_FIELDS } from '@/lib/home/catalog';
import type { HomeSectionConfig } from '@/lib/home/config';
import HomeFieldControl from '@/components/admin/home/HomeField';
import HomePickerPanel from '@/components/admin/home/HomePickerPanel';
import HomeRepeaterEditor from '@/components/admin/home/HomeRepeaterEditor';

/**
 * Réglages rangés dans l'onglet « Sélection », à côté du panneau qui parcourt
 * les fiches : ceux qui décident *quoi* afficher plutôt que *comment* le poser.
 * `source` y figure parce que le module parcouru en dépend — les deux réglages
 * doivent se toucher dans le même écran.
 */
const SELECTION_SETTING_KEYS = ['limit', 'count', 'upcomingOnly', 'sort', 'source', 'mixedSources', 'itemKind'];

type TabId = 'texts' | 'options' | 'selection' | 'style' | 'builder';

const builderCss = (html: string) => `
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #333; }
  .sari-btn { display:inline-block; padding:.75rem 1.5rem; border-radius:.5rem; background:#169EC9; color:#fff; font-weight:600; }
  h2 { font-size: 1.75rem; margin: 0 0 .75rem; }
  p { line-height: 1.6; }
`;

export default function HomeSectionEditor({
  entry,
  config,
  locale,
  refLocale,
  structureLocked,
  dirty,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  entry: HomeCatalogEntry;
  config: HomeSectionConfig;
  locale: string;
  refLocale: string;
  structureLocked: boolean;
  dirty: boolean;
  saving: boolean;
  onChange: (config: HomeSectionConfig) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const t = useTranslations('admin.home');
  const [tab, setTab] = useState<TabId>('texts');
  const [preview, setPreview] = useState(false);

  const byScope = (scope: HomeField['scope']) => entry.fields.filter((field) => field.scope === scope);
  const optionFields = useMemo(() => byScope('settings').filter((field) => !SELECTION_SETTING_KEYS.includes(field.key)), [entry]);
  const selectionFields = useMemo(() => byScope('settings').filter((field) => SELECTION_SETTING_KEYS.includes(field.key)), [entry]);
  const styleFields = useMemo(() => {
    const custom = byScope('style');
    const base = HOME_LAYOUT_FIELDS.filter((field) => !custom.some((own) => own.key === field.key));
    return [...base, ...custom];
  }, [entry]);

  const tabs: Array<{ id: TabId; label: string; show: boolean }> = [
    { id: 'texts', label: t('tabTexts'), show: byScope('texts').length > 0 },
    { id: 'options', label: t('tabOptions'), show: optionFields.length > 0 },
    { id: 'selection', label: t('tabSelection'), show: Boolean(entry.picker || entry.repeater) },
    { id: 'style', label: t('tabStyle'), show: true },
    { id: 'builder', label: t('tabBuilder'), show: Boolean(entry.builder) },
  ];

  const visible = (field: HomeField) => {
    if (!field.showIf) return true;
    const source = field.showIf.key;
    const current =
      config.settings?.[source] ?? config.style?.[source as keyof HomeSectionConfig['style']] ?? config.texts?.[source];
    // « truthy » : le champ doit être rempli (ou coché, ou supérieur à zéro) —
    // c'est ce qu'on veut pour faire apparaître un réglage dépendant d'une
    // case ou d'une largeur, sans avoir à énumérer les valeurs possibles.
    if (field.showIf.truthy) {
      if (typeof current === 'boolean') return current;
      if (typeof current === 'number') return current > 0;
      return String(current ?? '').trim() !== '' && String(current) !== 'false';
    }
    return String(current ?? '') === String(field.showIf.equals ?? '');
  };

  const renderFields = (fields: HomeField[], disabled = false) => (
    <div className="grid md:grid-cols-2 gap-3">
      {fields.filter(visible).map((field) => (
        <HomeFieldControl key={field.key} field={field} config={config} onChange={onChange} disabled={disabled} />
      ))}
    </div>
  );

  const showLockedNote = structureLocked && (tab === 'options' || tab === 'style' || (tab === 'selection' && !entry.repeater));

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b flex items-start gap-3" style={{ borderColor: 'var(--ad-line)' }}>
        <div className="min-w-0 flex-1">
          <h2 className="font-black leading-tight">{t.has(`blocks.${entry.labelKey}`) ? t(`blocks.${entry.labelKey}`) : entry.label}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
            {t.has(`hints.${entry.descriptionKey}`) ? t(`hints.${entry.descriptionKey}`) : entry.description}
          </p>
        </div>
        <a
          className="ad-btn ad-btn-ghost text-xs whitespace-nowrap"
          href={`/${locale}#home-${entry.key}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="w-3.5 h-3.5" /> {t('openPage')}
        </a>
      </header>

      <nav className="px-4 pt-3 flex flex-wrap gap-1">
        {tabs.filter((item) => item.show).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className="px-3 py-1.5 rounded-t-lg text-xs font-bold border-b-2 transition"
            style={{
              borderColor: tab === item.id ? 'var(--ad-accent)' : 'transparent',
              color: tab === item.id ? 'var(--ad-ink)' : 'var(--ad-muted)',
              background: tab === item.id ? 'var(--ad-surface)' : 'transparent',
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="ad-scroll flex-1 overflow-y-auto p-4 space-y-4">
        {showLockedNote ? (
          <p className="ad-chip ad-chip-warn text-[11px] py-1 px-2 inline-flex">
            {t('structureInRef', { locale: t('refLocale') })}
          </p>
        ) : null}

        {tab === 'texts' ? (
          <div className="space-y-3">
            {renderFields(byScope('texts'))}
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ad-muted)' }}>
              {t('textsFallbackHint')}
            </p>
          </div>
        ) : null}

        {tab === 'options' ? renderFields(optionFields, structureLocked) : null}

        {tab === 'selection' ? (
          <div className="space-y-5">
            {entry.picker ? (
              <HomePickerPanel
                picker={entry.picker}
                config={config}
                locale={locale}
                onChange={onChange}
                settingFields={selectionFields}
                disabled={structureLocked}
              />
            ) : null}
            {entry.repeater ? (
              <div className="space-y-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                  {entry.repeater.labelKey && t.has(`lists.${entry.repeater.labelKey}`)
                    ? t(`lists.${entry.repeater.labelKey}`)
                    : entry.repeater.label}
                </h3>
                <HomeRepeaterEditor repeater={entry.repeater} config={config} onChange={onChange} disabled={false} withTexts={!structureLocked} />
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'style' ? (
          <div className="space-y-3">
            {renderFields(styleFields, structureLocked)}
            <label className="space-y-1.5 block md:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                {t('customCss')}
              </span>
              <textarea
                className="ad-input font-mono text-xs min-h-[120px]"
                value={config.style?.customCss || ''}
                disabled={structureLocked}
                placeholder=".carte { padding: 2rem; }"
                onChange={(e) => onChange({ ...config, style: { ...config.style, customCss: e.target.value } })}
              />
              <p className="text-[11px] leading-snug" style={{ color: 'var(--ad-muted)' }}>
                {t('customCssHint')}
              </p>
            </label>
          </div>
        ) : null}

        {tab === 'builder' && entry.builder ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                {t('builderHint')}
              </p>
              <a className="ad-btn ad-btn-ghost text-xs whitespace-nowrap" href={`/${locale}/admin/builder?section=${entry.key}&locale=${locale}`} target="_blank" rel="noreferrer">
                <Paintbrush className="w-3.5 h-3.5" /> {t('openBuilder')}
              </a>
            </div>
            <div className="inline-flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--ad-line)' }}>
              {([
                { value: 'native', label: t('builderNative') },
                { value: 'html', label: t('builderHtml') },
              ] as const).map((mode) => {
                const on = (config.builder?.mode || 'native') === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    disabled={structureLocked}
                    className="px-3 py-1.5 text-xs font-bold"
                    style={{
                      background: on ? 'var(--ad-accent)' : 'transparent',
                      color: on ? 'var(--ad-accent-ink)' : 'inherit',
                    }}
                    onClick={() => onChange({ ...config, builder: { ...config.builder, mode: mode.value } })}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            {config.builder?.mode === 'html' ? (
              <>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                    HTML
                  </span>
                  <textarea
                    className="ad-input font-mono text-xs min-h-[160px]"
                    value={config.builder?.html || ''}
                    onChange={(e) => onChange({ ...config, builder: { ...config.builder, html: e.target.value } })}
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                    CSS
                  </span>
                  <textarea
                    className="ad-input font-mono text-xs min-h-[120px]"
                    value={config.builder?.css || ''}
                    onChange={(e) => onChange({ ...config, builder: { ...config.builder, css: e.target.value } })}
                  />
                </label>
                <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => setPreview((v) => !v)}>
                  {preview ? <Eye className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />} {t('togglePreview')}
                </button>
                {preview ? (
                  <iframe
                    title={t('previewTitle')}
                    className="w-full h-64 rounded-lg border bg-white"
                    style={{ borderColor: 'var(--ad-line)' }}
                    sandbox=""
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${builderCss(config.builder?.css || '')}${config.builder?.css || ''}</style></head><body>${config.builder?.html || ''}</body></html>`}
                  />
                ) : null}
                <p className="text-[11px] leading-relaxed flex gap-1.5" style={{ color: 'var(--ad-muted)' }}>
                  <Sparkles className="w-3.5 h-3.5 mt-0.5" />
                  {t('builderSafety')}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--ad-line)' }}>
        <span className="text-[11px] me-auto" style={{ color: dirty ? 'var(--ad-warn, #eab616)' : 'var(--ad-muted)' }}>
          {dirty ? t('unsaved') : t('allSaved')}
        </span>
        <button type="button" className="ad-btn ad-btn-ghost text-xs" disabled={saving} onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5" /> {t('resetBlock')}
        </button>
        <button type="button" className="ad-btn ad-btn-primary text-xs" disabled={!dirty || saving} onClick={onSave}>
          <Save className="w-3.5 h-3.5" /> {saving ? t('saving') : t('saveBlock')}
        </button>
      </footer>
    </div>
  );
}
