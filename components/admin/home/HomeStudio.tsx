'use client';

/**
 * Studio « Page d'accueil » : l'écran qui pilote les 13 blocs de la vitrine.
 *
 * À gauche, la liste des blocs dans l'ordre d'affichage (poignée pour déplacer,
 * interrupteur pour afficher/masquer) ; à droite, l'éditeur du bloc sélectionné.
 * Les écritures passent par `/api/admin/home`, qui privilégie l'API CMS et ne
 * se rabat sur les fichiers du projet que si l'API est injoignable — le bandeau
 * indique toujours où le bloc a réellement été enregistré.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDown, ArrowUp, Check, Copy, Database, Download, FileJson, GripVertical, Loader2,
  RefreshCcw, Save, TriangleAlert,
} from 'lucide-react';
import IconMark from '@/components/admin/IconMark';
import { useToast } from '@/components/admin/Toast';
import {
  copyHome,
  fetchHome,
  type HomeSnapshot,
  importHomeLegacy,
  invalidateHomeOptions,
  reorderHome,
  resetHome,
  saveHomeSection,
} from '@/lib/home/client';
import { HOME_ORDER, type HomeSectionConfig, type HomeSectionKey, type HomeSections } from '@/lib/home/config';
import { catalogEntry } from '@/lib/home/catalog';
import HomeSectionEditor from '@/components/admin/home/HomeSectionEditor';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export default function HomeStudio() {
  const locale = useLocale();
  const t = useTranslations('admin.home');
  const { showToast } = useToast();

  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [draft, setDraft] = useState<HomeSections>({});
  const [dirty, setDirty] = useState<HomeSectionKey[]>([]);
  const [selected, setSelected] = useState<HomeSectionKey>('hero');
  const [order, setOrder] = useState<HomeSectionKey[]>(HOME_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyTexts, setCopyTexts] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  const apply = useCallback((next: HomeSnapshot) => {
    setSnapshot(next);
    setDraft(clone(next.sections || {}));
    setOrder(next.order?.length ? next.order : HOME_ORDER);
    setDirty([]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      apply(await fetchHome(locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [locale, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const ref = snapshot?.ref || 'fr';
  const structureLocked = locale !== ref;
  const entry = catalogEntry(selected);
  const config = draft[selected] || snapshot?.sections?.[selected];

  const patch = useCallback(
    (next: HomeSectionConfig) => {
      setDraft((prev) => ({ ...prev, [selected]: next }));
      setDirty((prev) => (prev.includes(selected) ? prev : [...prev, selected]));
    },
    [selected],
  );

  const persist = useCallback(
    async (keys: HomeSectionKey[]) => {
      if (!keys.length) return true;
      setSaving(true);
      try {
        for (const key of keys) {
          const section = draft[key];
          if (!section) continue;
          await saveHomeSection({ key, locale, config: section });
        }
        setDirty((prev) => prev.filter((key) => !keys.includes(key)));
        showToast(t('saved', { count: keys.length }), 'success');
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draft, locale, showToast, t],
  );

  const toggleEnabled = useCallback(
    async (key: HomeSectionKey) => {
      const section = draft[key] || snapshot?.sections?.[key];
      if (!section) return;
      const next: HomeSectionConfig = { ...clone(section), enabled: !section.enabled };
      setDraft((prev) => ({ ...prev, [key]: next }));
      try {
        await saveHomeSection({ key, locale, config: next });
        setDirty((prev) => prev.filter((value) => value !== key));
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [draft, locale, snapshot, showToast],
  );

  const move = useCallback(
    async (index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= order.length) return;
      const next = [...order];
      [next[index], next[target]] = [next[target], next[index]];
      setOrder(next);
      if (structureLocked) return;
      try {
        await reorderHome(locale, next);
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'warning');
      }
    },
    [order, locale, structureLocked, showToast],
  );

  const drop = useCallback(
    async (from: number, to: number) => {
      if (from === to || to < 0 || to >= order.length) return;
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setOrder(next);
      if (structureLocked) return;
      try {
        await reorderHome(locale, next);
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'warning');
      }
    },
    [order, locale, structureLocked, showToast],
  );

  /**
   * Blocs dont le contenu est lu dans les fichiers du site (slider, catalogue,
   * chiffres, traductions) faute d'enregistrement : le studio le signale et
   * propose de le reprendre tels quels dans la configuration.
   */
  const seededKeys = useMemo(() => snapshot?.seeded || [], [snapshot]);

  const importBlocks = useCallback(
    async (keys?: HomeSectionKey[]) => {
      const targets = keys?.length ? keys : seededKeys;
      if (!targets.length) {
        showToast(t('importNone'), 'warning');
        return;
      }
      if (!window.confirm(t('confirmImport', { count: targets.length }))) return;
      setImporting(true);
      try {
        const result = await importHomeLegacy({ locale, keys: targets });
        invalidateHomeOptions();
        await load();
        showToast(t('importDone', { count: result.imported.length }), 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setImporting(false);
      }
    },
    [seededKeys, locale, load, showToast, t],
  );

  const resetBlock = useCallback(
    async (key: HomeSectionKey) => {
      if (!window.confirm(t('confirmReset'))) return;
      try {
        await resetHome(key, locale);
        setDraft((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setDirty((prev) => prev.filter((value) => value !== key));
        await load();
        showToast(t('resetDone'), 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [load, locale, showToast, t],
  );

  const runCopy = useCallback(async () => {
    if (!copyTargets.length) return;
    try {
      // On copie depuis la langue en cours vers les langues cochées ; la
      // passerelle ne fait passer que la structure vers les non-références.
      await copyHome({ from: locale, to: copyTargets, withTexts: copyTexts });
      setCopyOpen(false);
      showToast(t('copyDone', { locales: copyTargets.join(', ') }), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }, [copyTargets, copyTexts, locale, selected, showToast, t]);

  const otherLocales = useMemo(() => ['fr', 'en', 'ar'].filter((value) => value !== locale), [locale]);

  if (loading && !snapshot) {
    return (
      <div className="ad-card p-10 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--ad-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="ad-card p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black leading-tight">{t('title')}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
            {t('subtitle')}
          </p>
        </div>
        <span className={`ad-chip ${snapshot?.stored === 'api' ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
          {snapshot?.stored === 'api' ? <Database className="w-3 h-3" /> : <FileJson className="w-3 h-3" />}
          {snapshot?.stored === 'api' ? t('storedApi') : t('storedFile')}
        </span>
        <span className="ad-chip ad-chip-mute">{t('language', { locale })}</span>
        {structureLocked ? (
          <span className="ad-chip ad-chip-warn" title={t('structureInRef', { locale: t('refLocale') })}>
            <TriangleAlert className="w-3 h-3" /> {t('textsOnly')}
          </span>
        ) : null}
        <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('reload')}
        </button>
        <button
          type="button"
          className="ad-btn ad-btn-ghost text-xs"
          onClick={() => void importBlocks()}
          disabled={importing}
          title={t('importHint')}
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {t('importAction', { count: seededKeys.length })}
        </button>
        <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => setCopyOpen(true)}>
          <Copy className="w-3.5 h-3.5" /> {t('copyStructure')}
        </button>
        <button type="button" className="ad-btn ad-btn-primary text-xs" disabled={!dirty.length || saving} onClick={() => void persist(dirty)}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {t('saveAll', { count: dirty.length })}
        </button>
      </div>

      {error ? (
        <div className="ad-card p-3 text-sm flex items-center gap-2" style={{ color: 'var(--ad-danger, #ef4444)' }}>
          <TriangleAlert className="w-4 h-4" /> {error}
          <button type="button" className="ad-btn-icon ms-auto" onClick={() => void load()}>
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start">
        <div className="ad-card p-2 lg:sticky lg:top-4 space-y-1">
          {order.map((key, index) => {
            const item = catalogEntry(key);
            const section = draft[key] || snapshot?.sections?.[key];
            const off = section?.enabled === false;
            const isDirty = dirty.includes(key);
            return (
              <div
                key={key}
                draggable={!structureLocked}
                onDragStart={() => setDrag(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag !== null) void drop(drag, index);
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer border transition ${
                  selected === key ? 'shadow-sm' : 'border-transparent'
                } ${drag === index ? 'opacity-50' : ''}`}
                style={{
                  background: selected === key ? 'var(--ad-surface)' : 'transparent',
                  borderColor: selected === key ? 'var(--ad-accent)' : 'var(--ad-line)',
                }}
                onClick={() => setSelected(key)}
              >
                <GripVertical className={`w-3.5 h-3.5 ${structureLocked ? 'opacity-20' : 'opacity-50 cursor-grab'}`} />
                <IconMark name={item?.icon || 'square'} className="w-4 h-4" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">
                    {item?.labelKey && t.has(`blocks.${item.labelKey}`) ? t(`blocks.${item.labelKey}`) : item?.label || key}
                  </span>
                  <span className="block text-[10px] truncate" style={{ color: 'var(--ad-muted)' }}>
                    {off ? t('hiddenChip') : t('shownChip')}
                    {isDirty ? ` · ${t('modifiedChip')}` : ''}
                    {seededKeys.includes(key) ? ` · ${t('seededChip')}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="ad-btn-icon"
                  disabled={structureLocked || index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void move(index, -1);
                  }}
                  aria-label={t('moveUp')}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="ad-btn-icon"
                  disabled={structureLocked || index === order.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    void move(index, 1);
                  }}
                  aria-label={t('moveDown')}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className={`ad-toggle ${off ? '' : 'is-on'}`}
                  disabled={structureLocked}
                  aria-pressed={!off}
                  title={t('toggleBlock')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleEnabled(key);
                  }}
                >
                  <span className="ad-toggle-knob" />
                  <span className="ad-toggle-label">{off ? t('no') : t('yes')}</span>
                </button>
              </div>
            );
          })}
          <p className="text-[11px] px-2 py-1.5 leading-relaxed" style={{ color: 'var(--ad-muted)' }}>
            {t('orderHint')}
          </p>
        </div>

        <div className="ad-card min-h-[560px] flex flex-col overflow-hidden">
          {entry && config && seededKeys.includes(selected) ? (
            <div
              className="px-4 py-2.5 text-[11px] leading-relaxed flex flex-wrap items-center gap-2 border-b"
              style={{ color: 'var(--ad-muted)', borderColor: 'var(--ad-line)', background: 'rgba(59,130,246,.06)' }}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{t('importBanner')}</span>
              <button
                type="button"
                className="ad-btn ad-btn-ghost text-[11px]"
                disabled={importing}
                onClick={() => void importBlocks([selected])}
              >
                {t('importAction', { count: 1 })}
              </button>
            </div>
          ) : null}
          {entry && config ? (
            <HomeSectionEditor
              entry={entry}
              config={config}
              locale={locale}
              refLocale={ref}
              structureLocked={structureLocked}
              dirty={dirty.includes(selected)}
              saving={saving}
              onChange={patch}
              onSave={() => void persist([selected])}
              onReset={() => void resetBlock(selected)}
            />
          ) : (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>
              {t('noBlockSelected')}
            </div>
          )}
        </div>
      </div>

      {copyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0" style={{ background: 'rgba(8,12,20,.6)' }} onClick={() => setCopyOpen(false)} />
          <div className="ad-modal-card relative w-full max-w-lg">
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--ad-line)' }}>
              <h3 className="font-black">{t('copyTitle')}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                {t('copySubtitle')}
              </p>
            </div>
            <div className="p-4 space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                  {t('copyTargets')}
                </legend>
                {otherLocales.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={copyTargets.includes(value)}
                      onChange={(e) => setCopyTargets((prev) => (e.target.checked ? [...prev, value] : prev.filter((x) => x !== value)))}
                    />
                    <span className="font-semibold">{value}</span>
                    <span className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                      {value === ref ? t('copyTargetRef') : t('copyTargetTexts')}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={copyTexts} onChange={(e) => setCopyTexts(e.target.checked)} />
                <span>{t('copyWithTexts')}</span>
              </label>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ad-muted)' }}>
                {t('copyNote')}
              </p>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--ad-line)' }}>
              <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => setCopyOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="ad-btn ad-btn-primary text-xs" disabled={!copyTargets.length} onClick={() => void runCopy()}>
                <Check className="w-3.5 h-3.5" /> {t('copyRun')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
