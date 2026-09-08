'use client';

/**
 * L'atelier graphique, hors du constructeur de page.
 *
 * Le besoin tenant en une phrase : pouvoir dessiner une planche, l'enregistrer dans la
 * GED, et la réutiliser ailleurs que dans une page construite. Cet écran est donc le
 * même `CanvasStudio` que celui du bloc GrapesJS, branché sur les mêmes routes — seule
 * la sortie change : ici on copy l'URL, on télécharge, on publie en gabarit ; là-bas on
 * pose le `<img>` dans la page.
 *
 * Deux choses sont volontairement absentes :
 *
 * - aucun état « brouillon » local : la GED est la source de vérité, une planche
 *   non enregistrée est une planche perdue, et l'avertissement de fermeture de
 *   l'atelier le dit mieux qu'un tampon maison ;
 * - aucun onglet « retouche » : `admin/media` l'a déjà (`ImageEditor`), et le lien
 *   se fait dans l'autre sens — la fiche média ouvre cet atelier (voir le bouton
 *   « Atelier » de l'écran média).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Check, Copy, Image as ImageIcon, Layers, LayoutTemplate, Loader2, Palette, PencilLine, Trash2, Wand2 } from 'lucide-react';
import { CanvasStudio } from '@/components/canvas/CanvasStudio';
import { deleteGedAsset, listGedAssets, listGedTemplates, renameGedAsset, type GedAssetSummary, type GedTemplateSummary } from '@/lib/ged/client';
import { useToast } from '@/components/admin/Toast';
import { isRtl } from '@/lib/i18n';

/** Les formats de départ, repris du catalogue — c'est la même table que dans l'atelier. */
const QUICK_FORMATS = [
  { id: 'carré', label: 'Post carré', width: 1080, height: 1080 },
  { id: 'story', label: 'Story', width: 1080, height: 1920 },
  { id: 'banniere', label: 'Bannière web', width: 1600, height: 640 },
  { id: 'a4', label: 'Affiche A4', width: 1240, height: 1754 },
  { id: 'a3', label: 'Affiche A3', width: 1754, height: 2480 },
  { id: 'carte', label: 'Carte de visite', width: 1063, height: 638 },
];

export default function CanvasStudioPage() {
  const locale = useLocale();
  const t = useTranslations('admin.canvas');
  const { showToast } = useToast();

  const [plans, setPlans] = useState<GedAssetSummary[]>([]);
  const [templates, setTemplates] = useState<GedTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ file: string | null; templateId: string | null; width: number; height: number } | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assets, catalog] = await Promise.all([listGedAssets({ kind: 'canvas', limit: 60 }), listGedTemplates().catch(() => ({ templates: [] as GedTemplateSummary[] }))]);
      setPlans(assets.items);
      setTemplates(catalog.templates);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void (async () => {
      await load();
      // Le lien « Ouvrir dans l’atelier » de la médiathèque arrive avec `?file=` : une
      // image de la GED doit pouvoir devenir une planche sans que l'utilisateur ait à
      // la chercher dans la liste. Lu dans l'URL, pas dans `useSearchParams`, pour
      // qu'une page client n'exige pas de Suspense au rendu statique.
      const wanted = new URLSearchParams(window.location.search).get('file');
      if (wanted) {
        setOpen({ file: wanted, templateId: null, width: 0, height: 0 });
        window.history.replaceState(null, '', window.location.pathname);
      }
    })();
  }, [load]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      showToast(t('copyError'), 'error');
    }
  };

  const remove = async (asset: GedAssetSummary) => {
    if (!window.confirm(t('confirmDelete', { name: asset.title || asset.name }))) return;
    try {
      await deleteGedAsset(asset.file, { purgeHistory: true });
      setPlans((items) => items.filter((item) => item.file !== asset.file));
      showToast(t('deleted'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('deleteError'), 'error');
    }
  };

  const rename = async (asset: GedAssetSummary) => {
    const base = asset.name.replace(/\.[^.]+$/, '');
    const next = window.prompt(t('renamePrompt'), base);
    if (!next || next === base) return;
    try {
      await renameGedAsset(asset.file, `${next}${asset.name.slice(base.length)}`);
      await load();
      showToast(t('renamed'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('renameError'), 'error');
    }
  };

  const counts = useMemo(() => {
    const kinds = new Map<string, number>();
    for (const plan of plans) kinds.set(plan.kind, (kinds.get(plan.kind) || 0) + 1);
    return Array.from(kinds.entries());
  }, [plans]);

  return (
    <div dir={isRtl(locale) ? 'rtl' : 'ltr'} className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2 ad-rise">
        <div className="min-w-0">
          <div className="ad-breadcrumb">{t('breadcrumb')}</div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Palette className="w-6 h-6" style={{ color: 'var(--ad-accent)' }} /> {t('title')}
          </h1>
          <p className="text-sm max-w-[76ch]" style={{ color: 'var(--ad-muted)' }}>
            {t('hint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="ad-btn ad-btn-ghost" href={`/${locale}/admin/media`}>
            <ImageIcon className="w-4 h-4" /> {t('media')}
          </Link>
          <Link className="ad-btn ad-btn-ghost" href={`/${locale}/admin/builder`}>
            <Wand2 className="w-4 h-4" /> {t('builder')}
          </Link>
          <button className="ad-btn ad-btn-lime" onClick={() => setOpen({ file: null, templateId: null, width: 1080, height: 1080 })}>
            <Layers className="w-4 h-4" /> {t('newPlan')}
          </button>
        </div>
      </header>

      <section className="ad-card ad-pane p-4 ad-rise-2">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
            {t('startFrom')}
          </span>
          {QUICK_FORMATS.map((format) => (
            <button key={format.id} className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setOpen({ file: null, templateId: null, width: format.width, height: format.height })} title={`${format.width}×${format.height}`}>
              {format.label}
            </button>
          ))}
        </div>
        {templates.length ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {templates.map((template) => (
              <button key={template.id} className="ad-card ad-pane p-2 text-start hover:opacity-90" onClick={() => setOpen({ file: null, templateId: template.id, width: template.format.width, height: template.format.height })}>
                <span className="block aspect-square rounded-md overflow-hidden mb-2" style={{ background: 'var(--ad-bg-2)', border: '1px solid var(--ad-line)' }}>
                  {template.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={template.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="w-full h-full grid place-items-center">
                      <LayoutTemplate className="w-6 h-6" style={{ color: 'var(--ad-muted)' }} />
                    </span>
                  )}
                </span>
                <span className="block text-sm font-bold truncate">{template.title}</span>
                <span className="block text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                  {template.format.width}×{template.format.height} · {template.category}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm m-0" style={{ color: 'var(--ad-muted)' }}>
            {t('noTemplates')}
          </p>
        )}
      </section>

      <section className="ad-card ad-pane p-4 ad-rise-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-black m-0">{t('plans')}</h2>
          <span className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            {loading ? t('loading') : `${plans.length} · ${counts.map(([kind, count]) => `${kind} ${count}`).join(' · ')}`}
          </span>
        </div>
        {loading && !plans.length ? (
          <p className="text-sm flex items-center gap-2 m-0" style={{ color: 'var(--ad-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
          </p>
        ) : !plans.length ? (
          <p className="text-sm m-0" style={{ color: 'var(--ad-muted)' }}>
            {t('noPlans')}
          </p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {plans.map((plan) => (
              <article key={plan.file} className="ad-card p-2">
                <button className="block w-full text-start" onClick={() => setOpen({ file: plan.file, templateId: null, width: plan.width, height: plan.height })} title={t('openInStudio')}>
                  <span className="block aspect-square rounded-md overflow-hidden mb-2" style={{ background: 'var(--ad-bg-2)', border: '1px solid var(--ad-line)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={plan.url} alt={plan.alt || plan.title || plan.name} className="w-full h-full object-contain" loading="lazy" />
                  </span>
                  <span className="block text-sm font-bold truncate">{plan.title || plan.name}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                    {plan.width}×{plan.height} · {plan.prefix}
                    {plan.version > 1 ? ` · v${plan.version}` : ''}
                    {plan.editable ? ` · ${t('editable')}` : ''}
                  </span>
                </button>
                <div className="flex items-center gap-1 mt-2">
                  <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => void copy(plan.url)} title={t('copyUrl')}>
                    {copied === plan.url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => void rename(plan)} title={t('rename')}>
                    <PencilLine className="w-3.5 h-3.5" />
                  </button>
                  <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => void remove(plan)} title={t('delete')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <a className="ad-btn ad-btn-ghost ad-btn-sm ms-auto" href={plan.url} download title={t('download')}>
                    PNG
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {open ? (
        <CanvasStudio
          open
          asset={open.file}
          templateId={open.templateId}
          artboard={open.width && open.height ? { width: open.width, height: open.height } : undefined}
          allowInsert={false}
          onClose={() => {
            setOpen(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
