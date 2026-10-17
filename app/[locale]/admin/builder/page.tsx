// app/[locale]/admin/builder/page.tsx
'use client';

/**
 * Le constructeur de page, branché sur les pages du site.
 *
 * Ce que l'écran fait, dans l'ordre :
 *
 * - il ne propose à la sélection **que les pages génériques de type
 *   « Constructeur »** de la langue en cours (`kind=generic`, `subtype=constructor`) :
 *   l'accueil, les services, les produits et le reste du catalogue ne sont pas
 *   des pages que l'on dessine, ce sont des pages que le site compose à partir de
 *   blocs — les mélanger ici serait promettre un éditeur qui ne s'applique pas à
 *   elles. La sélection se fait sur la liste déjà filtrée par langue ; le filtre
 *   `subtype` est relu côté client parce que la vue de liste est allégée.
 * - les **composants déjà existants de la vitrine** restent dans la palette, à
 *   côté des blocs du kit (galerie, carrousel, slider, flyer, page d'atterrissage,
 *   boutons d'action…) : rien n'a été remplacé, c'est la même liste enrichie.
 * - il écrit dans la fiche : le HTML et le CSS de la page sont rangés dans le
 *   champ `content` (`lib/builder-doc.ts`) et enregistrés par la voie ordinaire du
 *   module Pages. La page se visite alors à `/fr/p/{slug}`, sans menu ni pied de
 *   page, et elle se retravaille ici autant de fois qu'on veut.
 * - le canevas charge les **feuilles de style réelles du site** : ce que l'on voit
 *   pendant la construction est ce que le visiteur verra. L'ancienne version
 *   pointait sur un `/globals.css` qui n'existe pas, l'aperçu était donc nu.
 *
 * Un brouillon est gardé en mémoire locale (`builderKey`) pendant le travail : une
 * page se construit par à-coups, et une page qui se ferme avant l'enregistrement
 * ne doit pas être perdue. Le brouillon est relu à l'ouverture, avec sa date, et
 * jeté dès que la fiche est enregistrée.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Code,
  ExternalLink,
  FilePlus2,
  Layers,
  Loader2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminGet, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import { decodeBuilderDoc, encodeBuilderDoc, hasBuilderDoc, type BuilderDoc } from '@/lib/builder-doc';
import {
  BUILDER_COMPONENTS,
  type BuilderComponent,
  STARTER_CSS,
  STARTER_TEMPLATES,
  starterTemplate,
} from '@/lib/builder-components';
import { builderKey } from '@/lib/page-templates';
import { registerSariCanvas, setSariCanvasOptions } from '@/lib/builder/sari-canvas';
import { CanvasStudioHost } from '@/components/builder/CanvasStudioHost';
import { standaloneHref } from '@/lib/standalone-page';
import { isRtl } from '@/lib/i18n';

/** La partie de GrapesJS que cet écran utilise (le paquet n'exporte pas de types). */
interface GrapesEditor {
  getHtml: () => string;
  getCss: () => string;
  setComponents: (html: string) => unknown;
  setStyle: (css: string) => unknown;
  addComponents: (html: string) => unknown;
  runCommand: (name: string) => unknown;
  on: (name: string, handler: () => void) => void;
  off: (name: string, handler: () => void) => void;
  destroy?: () => void;
  Canvas: {
    getDocument: () => Document | undefined;
    getBody: () => HTMLElement | undefined;
  };
  BlockManager: {
    get: (id: string) => unknown;
    add: (id: string, def: { label: string; content: string; category?: string; media?: string }) => unknown;
  };
}

interface PageOption {
  id: string;
  slug: string;
  title: string;
  status: string;
}

interface DraftStamp extends BuilderDoc {
  savedAt: string;
}

/** Le HTML régurgité par GrapesJS peut traîner ses marqueurs internes. */
function clean(html: string): string {
  return String(html || '')
    .replace(/\s(?:data-gjs-[a-z-]+|data-gjs-type)="[^"]*"/gi, '')
    .replace(/<!--\s*gjs[^>]*-->/gi, '')
    .trim();
}

export default function BuilderPage() {
  const locale = useLocale();
  const t = useTranslations('admin.builder');
  const { showToast } = useToast();

  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<GrapesEditor | null>(null);
  // Le plugin est monté une fois, la page sélectionnée change souvent : le contexte
  // d'enregistrement passe par des refs relues à l'ouverture de l'atelier.
  const pageIdRef = useRef<string>('');
  const slugRef = useRef<string>('');
  const draftTimer = useRef<number | null>(null);

  const [pages, setPages] = useState<PageOption[]>([]);
  const [pageId, setPageId] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('published');
  const [slug, setSlug] = useState('');
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [draftAt, setDraftAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [templateId, setTemplateId] = useState('landing');
  // Le point de départ choisi est lu à l'ouverture d'une page vierge. Un `ref`
  // plutôt que la valeur : sinon changer ce bouton recréerait la fonction de
  // chargement, qui recréerait l'effet, qui rechargerait la fiche par-dessus le
  // travail en cours dans le canevas.
  const templateRef = useRef(templateId);
  templateRef.current = templateId;

  const current = useMemo(() => pages.find((p) => p.id === pageId) || null, [pages, pageId]);
  const key = slug ? builderKey(slug, locale) : '';

  const refreshList = useCallback(async () => {
    setListLoading(true);
    try {
      // Le filtre passe par le paramètre `filter` (JSON) : c'est la seule voie que
      // la liste accepte — `?kind=…` en paramètre nu est refusé par la validation
      // du serveur. La langue suit l'administration, le type reste relu ici : la
      // projection de liste est censée porter `subtype`, on ne s'y fie pas à l'aveugle.
      const rows = await cmsAdminList('pages', {
        filter: JSON.stringify({ locale, kind: 'generic', subtype: 'constructor' }),
      });
      const list: PageOption[] = rows
        .filter((row) => String(row.subtype || '') === 'constructor')
        .map((row) => ({
          id: String(row.id ?? ''),
          slug: String(row.slug ?? ''),
          title: String(row.title ?? '') || String(row.slug ?? ''),
          status: String(row.status ?? 'published'),
        }))
        .filter((row) => row.id);
      setPages(list);
      // Le lien « Construire » de la liste apporte `?page={id}` : c'est la fiche
      // cliquée qu'il faut ouvrir. `useSearchParams` est lu ici plutôt que par le
      // hook, pour ne pas imposer une frontière de Suspense à toute la page.
      const wanted =
        typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('page') || '';
      setPageId((previous) => {
        if (wanted && list.some((p) => p.id === wanted)) return wanted;
        return previous && list.some((p) => p.id === previous) ? previous : list[0]?.id || '';
      });
    } catch {
      showToast(t('listError'), 'error');
    } finally {
      setListLoading(false);
    }
  }, [locale, showToast, t]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    pageIdRef.current = pageId;
    slugRef.current = current?.slug || '';
    setSariCanvasOptions({ pageId: pageId || undefined, pageSlug: current?.slug || undefined });
  }, [pageId, current?.slug]);

  // ——— L'éditeur, une seule fois ———
  useEffect(() => {
    let cancelled = false;
    let instance: GrapesEditor | null = null;
    (async () => {
      const grapes = (await import('grapesjs')) as unknown as {
        default?: { init: (options: Record<string, unknown>) => GrapesEditor };
        init?: (options: Record<string, unknown>) => GrapesEditor;
      };
      await import('grapesjs/dist/css/grapes.min.css');
      if (cancelled || !host.current) return;
      const init = grapes.default?.init || grapes.init;
      if (!init) return;
      // Les feuilles réelles du site, reprises du document de l'administration :
      // le kit du constructeur et les utilitaires du site sont déjà là, il n'y a
      // rien à recopier dans la page.
      const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
        .map((link) => link.href)
        .filter((href) => Boolean(href));
      instance = init({
        container: host.current,
        height: '72vh',
        fromElement: false,
        storageManager: false,
        noticeOnUnload: false,
        showOffsets: true,
        canvas: { styles: sheets },
        deviceManager: {
          devices: [
            { name: 'Ordinateur', width: '' },
            { name: 'Tablette', width: '768px' },
            { name: 'Téléphone', width: '390px' },
          ],
        },
      });
      // Le conteneur de la page porte les classes du rendu de la vitrine : sans
      // elles, l'échelle (couleurs, espacements, typographie) manquerait à
      // l'aperçu alors qu'elle est présente à l'écran.
      const decorate = () => {
        const doc = instance?.Canvas.getDocument();
        if (doc) doc.documentElement.setAttribute('dir', isRtl(locale) ? 'rtl' : 'ltr');
        const body = instance?.Canvas.getBody();
        body?.classList.add('sari-page', 'sari-shell');
      };
      decorate();
      instance.on('canvas:frame:load', decorate);
      editor.current = instance;
      // Le bloc « Planche graphique », le sélecteur d'actifs branché sur la GED et le
      // double-clic qui ouvre l'atelier. Une greffe, pas une réécriture : `registerSariCanvas`
      // étend le type `image` de GrapesJS et ne remplace aucun composant existant.
      registerSariCanvas(instance as unknown as Parameters<typeof registerSariCanvas>[0], {
        pageId: pageIdRef.current || undefined,
        pageSlug: slugRef.current || undefined,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
      try {
        instance?.destroy?.();
      } catch {
        /* le cadre est déjà parti */
      }
      editor.current = null;
      setReady(false);
    };
  }, [locale]);

  const doc = useCallback((): BuilderDoc => {
    const ed = editor.current;
    if (!ed) return { html: '', css: '' };
    return { html: clean(ed.getHtml()), css: String(ed.getCss() || '').trim() };
  }, []);

  // ——— Le brouillon local, posé derrière chaque modification ———
  const holdDraft = useCallback(() => {
    if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify({ ...doc(), savedAt: new Date().toISOString() } satisfies DraftStamp));
      } catch {
        /* quota dépassé : le travail reste dans l'éditeur, seulement */
      }
      setDirty(true);
    }, 1200);
  }, [doc, key]);

  useEffect(() => {
    const ed = editor.current;
    if (!ed || !ready) return;
    ed.on('update', holdDraft);
    ed.on('component:update', holdDraft);
    return () => {
      try {
        ed.off('update', holdDraft);
        ed.off('component:update', holdDraft);
      } catch {
        /* l'éditeur est en train de se démonter */
      }
    };
  }, [ready, holdDraft]);

  // ——— La fiche, à l'ouverture et à chaque changement de page ———
  const loadPage = useCallback(
    async (id: string) => {
      const ed = editor.current;
      if (!ed || !id) return;
      try {
        const record = await cmsAdminGet('pages', id);
        setSlug(String(record.slug || ''));
        setTitle(String(record.title || ''));
        setStatus(String(record.status || 'published'));
        const stored = decodeBuilderDoc(record.content);
        let next = stored;
        let stamp = '';
        const rawKey = builderKey(String(record.slug || ''), locale);
        const localRaw = typeof window !== 'undefined' ? localStorage.getItem(rawKey) : null;
        if (localRaw) {
          try {
            const local = JSON.parse(localRaw) as Partial<DraftStamp>;
            const localDoc: BuilderDoc = { html: String(local.html || ''), css: String(local.css || '') };
            if (hasBuilderDoc(localDoc) && String(local.savedAt || '') && localDoc.html !== stored.html) {
              next = localDoc;
              stamp = String(local.savedAt);
            }
          } catch {
            next = { html: localRaw, css: stored.css };
          }
        }
        setDraftAt(stamp);
        if (hasBuilderDoc(next)) {
          ed.setComponents(next.html);
          ed.setStyle(next.css || STARTER_CSS);
        } else {
          const start = starterTemplate(templateRef.current) || STARTER_TEMPLATES[0];
          ed.setComponents(start ? start.html(locale) : '<section class="sari-band"><div class="sari-wrap"><h1>Titre</h1></div></section>');
          ed.setStyle(STARTER_CSS);
        }
        setDirty(false);
      } catch {
        showToast(t('loadError'), 'error');
      }
    },
    [locale, showToast, t],
  );

  useEffect(() => {
    if (ready && pageId) void loadPage(pageId);
  }, [ready, pageId, loadPage]);

  // ——— Enregistrer dans la fiche ———
  const save = useCallback(async () => {
    const ed = editor.current;
    if (!ed || !pageId) return;
    setSaving(true);
    try {
      const content = encodeBuilderDoc(doc());
      // Un slug ou un titre vidé à la main ne doit pas partir en base : la page
      // serait alors introuvable, dans la liste comme à son adresse publique.
      const patch: Record<string, unknown> = { content, status };
      if (title.trim()) patch.title = title.trim();
      if (slug.trim()) patch.slug = slug.trim();
      await cmsAdminUpdate('pages', pageId, patch);
      if (key) localStorage.removeItem(key);
      setDraftAt('');
      setDirty(false);
      showToast(t('saved', { slug: standaloneHref(locale, slug) }), 'success');
    } catch {
      showToast(t('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  }, [doc, key, locale, pageId, slug, status, title, showToast, t]);

  const toggleCode = () => {
    if (showCode) {
      setShowCode(false);
      return;
    }
    const built = doc();
    // Le code montré est celui qui sera enregistré, pas la copie de travail de
    // GrapesJS : l'administrateur peut ainsi vérifier ce que la page contient.
    setCode(`<!-- HTML -->\n${built.html}\n\n/* CSS */\n${built.css}`);
    setShowCode(true);
  };

  // Le bloc en main, pas son identifiant : le panneau et la bibliothèque portent
  // les mêmes fiches, les retrouver par `id` ne faisait que prêter le flanc à une
  // doublure silencieuse (deux blocs du même nom, et `find` rend toujours la première).
  const addComponent = (block: BuilderComponent) => {
    const ed = editor.current;
    if (!block || !ed) return;
    ed.addComponents(block.html);
    showToast(t('added', { label: block.label }), 'success');
  };

  const applyTemplate = (id: string) => {
    const tpl = starterTemplate(id);
    const ed = editor.current;
    if (!tpl || !ed) return;
    if (!window.confirm(t('templateConfirm'))) return;
    ed.setComponents(tpl.html(locale));
    ed.setStyle(STARTER_CSS);
    setTemplateId(id);
    holdDraft();
  };

  const createPage = async () => {
    const cleanSlug = newSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug || !newTitle.trim()) {
      showToast(t('createNeeded'), 'error');
      return;
    }
    try {
      const start = starterTemplate(templateRef.current) || STARTER_TEMPLATES[0];
      const created = await cmsAdminCreate('pages', {
        kind: 'generic',
        subtype: 'constructor',
        locale,
        slug: cleanSlug,
        title: newTitle.trim(),
        status: 'draft',
        content: encodeBuilderDoc({ html: start ? start.html(locale) : '', css: STARTER_CSS }),
      });
      const id = String((created as { id?: string }).id || '');
      setCreating(false);
      setNewSlug('');
      setNewTitle('');
      await refreshList();
      if (id) setPageId(id);
      showToast(t('created', { slug: cleanSlug }), 'success');
    } catch {
      showToast(t('createError'), 'error');
    }
  };

  const dropDraft = () => {
    if (key) localStorage.removeItem(key);
    setDraftAt('');
    if (pageId) void loadPage(pageId);
  };

  const categories = useMemo(() => {
    const map = new Map<string, typeof BUILDER_COMPONENTS>();
    for (const block of BUILDER_COMPONENTS) {
      if (!map.has(block.category)) map.set(block.category, []);
      map.get(block.category)?.push(block);
    }
    const needle = query.trim().toLowerCase();
    const wanted = (block: (typeof BUILDER_COMPONENTS)[number]) =>
      !needle ||
      block.label.toLowerCase().includes(needle) ||
      block.category.toLowerCase().includes(needle) ||
      block.description.toLowerCase().includes(needle) ||
      (block.classes || []).some((selector) => selector.toLowerCase().includes(needle));
    return Array.from(map.entries())
      .map(([category, items]) => [category, items.filter(wanted)] as const)
      .filter(([, items]) => items.length > 0);
  }, [query]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2 ad-rise">
        <div className="min-w-0">
          <div className="ad-breadcrumb">{t('breadcrumb')}</div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Wand2 className="w-6 h-6" style={{ color: 'var(--ad-accent)' }} /> {t('title')}
          </h1>
          <p className="text-sm max-w-[70ch]" style={{ color: 'var(--ad-muted)' }}>
            {t('hint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pages.length > 0 && (
            <select
              className="ad-select w-56"
              value={pageId}
              onChange={(event) => {
                setPageId(event.target.value);
                setShowCode(false);
              }}
              aria-label={t('pickPage')}
            >
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} — /{page.slug}
                </option>
              ))}
            </select>
          )}
          <button className="ad-btn ad-btn-ghost" onClick={() => setCreating((value) => !value)}>
            <FilePlus2 className="w-4 h-4" /> {t('newPage')}
          </button>
          <Link
            className="ad-btn ad-btn-ghost"
            href={`/${locale}/admin/pages`}
            title={t('backToList')}
          >
            <Layers className="w-4 h-4" /> {t('back')}
          </Link>
          {current && (
            <a
              className="ad-btn ad-btn-ghost"
              href={standaloneHref(locale, current.slug)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="w-4 h-4" /> {t('seePage')}
            </a>
          )}
          <Link
            className="ad-btn ad-btn-ghost"
            href={`/${locale}/admin/canvas`}
            target="_blank"
            rel="noreferrer"
            title="Ouvrir l’atelier graphique — planches PNG, SVG et HTML prêtes à publier"
          >
            <Palette className="w-4 h-4" /> {t('studio')}
          </Link>
          <button className="ad-btn ad-btn-ghost" disabled={!ready} onClick={toggleCode}>
            <Code className="w-4 h-4" /> {showCode ? t('editor') : t('code')}
          </button>
          <button className="ad-btn ad-btn-lime" disabled={!ready || saving || !pageId} onClick={() => void save()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {dirty ? t('saveDraft') : t('save')}
          </button>
        </div>
      </header>

      {creating && (
        <section className="ad-card ad-pane p-4 ad-rise grid md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <label className="block text-sm">
            <span className="font-bold">{t('slugLabel')}</span>
            <input
              className="ad-input mt-1"
              value={newSlug}
              onChange={(event) => setNewSlug(event.target.value)}
              placeholder="offre-echographie"
            />
            <span className="block text-[11px] mt-1" style={{ color: 'var(--ad-muted)' }}>
              {standaloneHref(locale, newSlug || '…')}
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-bold">{t('titleLabel')}</span>
            <input className="ad-input mt-1" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-bold">{t('starter')}</span>
            <select className="ad-select mt-1" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {STARTER_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </label>
          <button className="ad-btn ad-btn-primary" onClick={() => void createPage()}>
            <Plus className="w-4 h-4" /> {t('create')}
          </button>
        </section>
      )}

      {pages.length === 0 && !listLoading && !creating && (
        <section className="ad-card ad-pane p-6 text-center ad-rise">
          <Sparkles className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--ad-accent)' }} />
          <p className="font-bold">{t('noPageTitle')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>
            {t('noPageText')}
          </p>
          <button className="ad-btn ad-btn-primary mt-3" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> {t('newPage')}
          </button>
        </section>
      )}

      {pageId && (
        <div className="ad-card ad-pane p-3 flex flex-wrap items-end gap-3 ad-rise-2">
          <label className="block text-sm min-w-[16rem] grow">
            <span className="font-bold">{t('titleLabel')}</span>
            <input className="ad-input mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block text-sm w-40">
            <span className="font-bold">{t('pageSlug')}</span>
            <input className="ad-input mt-1" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
          <label className="block text-sm w-40">
            <span className="font-bold">{t('pageStatus')}</span>
            <select className="ad-select mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="published">{t('statusPublished')}</option>
              <option value="draft">{t('statusDraft')}</option>
            </select>
          </label>
          <p className="text-xs grow basis-[18rem] pb-2" style={{ color: 'var(--ad-muted)' }}>
            {t('slugHint', { href: standaloneHref(locale, slug || '…') })}
          </p>
        </div>
      )}

      {(dirty || draftAt) && (
        <p className="text-xs flex flex-wrap items-center gap-2" style={{ color: 'var(--ad-muted)' }}>
          {draftAt ? (
            <span>
              {t('draftKept', { when: new Date(draftAt).toLocaleString(locale) })}
              <button className="ad-btn ad-btn-ghost ad-btn-sm ml-2" onClick={dropDraft}>
                <Trash2 className="w-3.5 h-3.5" /> {t('draftDrop')}
              </button>
            </span>
          ) : null}
          {dirty ? <span>{t('unsaved')}</span> : null}
        </p>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <aside className="ad-card ad-pane ad-scroll p-3 ad-rise-2 max-h-[74dvh] min-w-0 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--ad-muted)' }}>
              <Layers className="w-4 h-4" /> {t('components')}
            </div>
            <input className="ad-input" placeholder={t('filter')} value={query} onChange={(event) => setQuery(event.target.value)} />
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--ad-muted)' }}>
              {t('componentsHint')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                className="ad-btn ad-btn-ghost"
                title={tpl.description}
                onClick={() => applyTemplate(tpl.id)}
              >
                <Sparkles className="w-3.5 h-3.5" /> {tpl.label}
              </button>
            ))}
          </div>
          {categories.map(([category, items]) => (
            <div key={category} className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] font-black" style={{ color: 'var(--ad-accent)' }}>
                {category}
              </div>
              {items.map((block) => (
                <button
                  key={block.id}
                  className="ad-card ad-card-hover w-full p-3 text-left"
                  onClick={() => addComponent(block)}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate">{block.label}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                        {block.description}
                      </span>
                    </span>
                    <Plus className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--ad-accent)' }} />
                  </span>
                  {block.classes && block.classes.length > 0 && (
                    <span className="flex flex-wrap gap-1 mt-2">
                      {block.classes.map((selector) => (
                        <code key={selector} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(15,23,42,.06)' }}>
                          {selector}
                        </code>
                      ))}
                    </span>
                  )}
                  {block.needs && block.needs.length > 0 && (
                    <span className="block text-[10px] mt-1.5" style={{ color: 'var(--ad-accent)' }}>
                      {t('interactive')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
          {categories.length === 0 && <div className="text-sm py-4" style={{ color: 'var(--ad-muted)' }}>{t('noComponents')}</div>}
        </aside>

      <CanvasStudioHost
        getEditor={() => editor.current as unknown as { getSelected: () => unknown } | null}
        pageId={pageId || undefined}
        pageSlug={current?.slug}
      />

      <div className="min-w-0">
          {/* Le canevas reste monté : l'échangeur Vue/Code ne doit pas démonter
              GrapesJS, qui perdrait son état. */}
          <div className="ad-card overflow-hidden ad-rise-3" ref={host} style={showCode ? { display: 'none' } : undefined} />
          {showCode && (
            <pre className="ad-card ad-pane ad-scroll p-4 text-xs max-h-[74dvh] whitespace-pre-wrap" style={{ color: 'var(--ad-ink)' }}>
              {code}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
