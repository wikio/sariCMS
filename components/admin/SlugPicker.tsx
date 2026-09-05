'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Check, CornerDownLeft, FileText, Folder, Globe, Link2 } from 'lucide-react';
import { cmsAdminList } from '@/lib/cms-admin';
import { slugify } from '@/lib/slugify';
import IconMark from '@/components/admin/IconMark';

/* ============================================================
   Sélecteur de slug pour les liens de menu :
   - lien libre
   - page statique (routes fixes de la vitrine)
   - page dynamique (produit, service, solution, actualité,
     événement, offre d'emploi, page générique) avec autocomplete
   ============================================================ */

export type SlugKind =
  | 'free'
  | 'static'
  | 'products'
  | 'services'
  | 'solutions'
  | 'news'
  | 'events'
  | 'careers'
  | 'pages';

const KIND_OPTIONS: Array<{ id: SlugKind; label: string }> = [
  { id: 'free', label: 'Lien libre (URL manuelle)' },
  { id: 'static', label: 'Page statique' },
  { id: 'products', label: 'Produits — liste ou fiche' },
  { id: 'services', label: 'Services — liste ou fiche' },
  { id: 'solutions', label: 'Solutions — liste ou fiche' },
  { id: 'news', label: 'Actualités — liste ou article' },
  { id: 'events', label: 'Événements — liste ou fiche' },
  { id: 'careers', label: 'Carrières — liste ou offre' },
  { id: 'pages', label: 'Page générique' },
];

const STATIC_PATHS: Array<{ path: string; label: string; icon: string }> = [
  { path: '/', label: 'Accueil', icon: 'home' },
  { path: '/about', label: 'À propos', icon: 'info' },
  { path: '/products', label: 'Produits (catalogue)', icon: 'package' },
  { path: '/services', label: 'Services', icon: 'wrench' },
  { path: '/solutions', label: 'Solutions', icon: 'layers' },
  { path: '/news', label: 'Actualités', icon: 'newspaper' },
  { path: '/events', label: 'Événements', icon: 'calendar' },
  { path: '/careers', label: 'Carrières', icon: 'briefcase' },
  { path: '/contact', label: 'Contact', icon: 'mail' },
  // La route légale est /legal/[type] : il n'existe pas de page d'index, donc
  // on référence les trois pages réelles plutôt qu'un /legal qui renvoie 404.
  { path: '/legal/mentions', label: 'Mentions légales', icon: 'scale' },
  { path: '/legal/privacy', label: 'Confidentialité', icon: 'shield' },
  { path: '/legal/conditions', label: 'Conditions générales', icon: 'file-text' },
];

/** Page liste de chaque module, pour pointer la rubrique plutôt qu'une fiche. */
const MODULE_INDEX: Partial<Record<SlugKind, { path: string; label: string }>> = {
  products: { path: '/products', label: 'Tous les produits (page catalogue)' },
  services: { path: '/services', label: 'Tous les services (page liste)' },
  solutions: { path: '/solutions', label: 'Toutes les solutions (page liste)' },
  news: { path: '/news', label: 'Toutes les actualités (page liste)' },
  events: { path: '/events', label: 'Tous les événements (page liste)' },
  careers: { path: '/careers', label: 'Toutes les offres (page carrières)' },
};

/** Ressource backend + clés d'affichage par module dynamique. */
const MODULE_DEFS: Record<Exclude<SlugKind, 'free' | 'static'>, {
  resource: string;
  titleKey: string;
  icon: string;
  build: (item: Record<string, unknown>) => string;
}> = {
  products: {
    resource: 'products',
    titleKey: 'name',
    icon: 'package',
    build: (i) => `/products/${pubId(i)}-${slugify(String(i.name || i.title || ''))}`,
  },
  services: {
    resource: 'services',
    titleKey: 'title',
    icon: 'wrench',
    build: (i) => `/services/${pubId(i)}`,
  },
  solutions: {
    resource: 'solutions',
    titleKey: 'title',
    icon: 'layers',
    build: (i) => `/solutions/${String(i.slug || pubId(i))}`,
  },
  news: {
    resource: 'news',
    titleKey: 'title',
    icon: 'newspaper',
    build: (i) => `/news/${pubId(i)}-${slugify(String(i.title || i.name || ''))}`,
  },
  events: {
    resource: 'events',
    titleKey: 'title',
    icon: 'calendar',
    build: (i) => `/events/${pubId(i)}-${slugify(String(i.title || i.name || ''))}`,
  },
  careers: {
    resource: 'careers',
    titleKey: 'title',
    icon: 'briefcase',
    build: (i) => `/jobs/${pubId(i)}-${slugify(String(i.title || i.name || ''))}`,
  },
  pages: {
    resource: 'pages',
    titleKey: 'title',
    icon: 'file-text',
    build: (i) => `/content/${pubId(i)}`,
  },
};

function pubId(item: Record<string, unknown>): string | number {
  if (typeof item.legacyId === 'number') return item.legacyId;
  if (typeof item.id === 'number') return item.id;
  if (typeof item.id === 'string' && /^\d+$/.test(item.id)) return Number(item.id);
  return String(item.id ?? '');
}

/** Devine le type de lien à partir d'un href existant. */
export function inferSlugKind(href: string): SlugKind {
  const h = (href || '').trim();
  if (!h || h === '#') return 'free';
  // Une page liste appartient à son module : on rouvre le bon onglet plutôt
  // que « page statique », sinon modifier le lien obligerait à rechercher le
  // module à la main.
  const idx = (Object.keys(MODULE_INDEX) as SlugKind[]).find((k) => MODULE_INDEX[k]?.path === h);
  if (idx) return idx;
  if (STATIC_PATHS.some((s) => s.path === h)) return 'static';
  if (h.startsWith('/products/')) return 'products';
  if (h.startsWith('/services/')) return 'services';
  if (h.startsWith('/solutions/')) return 'solutions';
  if (h.startsWith('/news/')) return 'news';
  if (h.startsWith('/events/')) return 'events';
  if (h.startsWith('/jobs/') || h.startsWith('/careers/')) return 'careers';
  if (h.startsWith('/content/')) return 'pages';
  return 'free';
}

export default function SlugPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const locale = useLocale();
  const [kind, setKind] = useState<SlugKind>(() => inferSlugKind(value));
  const [free, setFree] = useState(value);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const def = MODULE_DEFS[kind as Exclude<SlugKind, 'free' | 'static'>];

  // Ferme le panneau au clic extérieur.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  /** Entrée « page liste » du module courant, si elle correspond à la saisie. */
  const indexHit = (query: string): Record<string, unknown>[] => {
    const idx = MODULE_INDEX[kind];
    if (!idx) return [];
    const needle = query.trim().toLowerCase();
    if (needle && !idx.label.toLowerCase().includes(needle) && !idx.path.includes(needle)) return [];
    return [{ __path: idx.path, __label: idx.label, __icon: def?.icon || 'list', __index: true }];
  };

  const search = async (query: string) => {
    if (kind === 'static') {
      const needle = query.trim().toLowerCase();
      setHits(
        (needle ? STATIC_PATHS.filter((s) => s.label.toLowerCase().includes(needle) || s.path.includes(needle)) : STATIC_PATHS)
          .map((s) => ({ __path: s.path, __label: s.label, __icon: s.icon })) as unknown as Record<string, unknown>[],
      );
      return;
    }
    if (!def) return;
    setBusy(true);
    try {
      const rows = await cmsAdminList<Record<string, unknown>>(def.resource, {
        search: query,
        filter: JSON.stringify({ locale }),
        limit: '20',
      });
      setHits([...indexHit(query), ...rows.slice(0, 20)]);
    } catch {
      // Même si les fiches sont inaccessibles (session expirée, API muette),
      // la page liste reste sélectionnable : le champ n'est jamais vide.
      setHits(indexHit(query));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => { search(q); setOpen(true); }, 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind, locale]);

  const selectStatic = (item: Record<string, unknown>) => {
    const path = String(item.__path || '/');
    setFree(path);
    onChange(path);
    setQ('');
    setOpen(false);
  };

  const selectEntity = (item: Record<string, unknown>) => {
    const path = def ? def.build(item) : '/';
    setFree(path);
    onChange(path);
    setQ('');
    setOpen(false);
  };

  const titleOf = (item: Record<string, unknown>) => {
    if (kind === 'static' || item.__index) return String(item.__label || '');
    return String(item[def?.titleKey || 'title'] || item.name || item.title || '—');
  };

  return (
    <div className="space-y-1.5" ref={boxRef}>
      {label && (
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{label}</span>
      )}
      <div className="relative flex flex-col sm:flex-row gap-2">
        <select className="ad-select sm:w-1/2 sm:min-w-0 shrink-0" value={kind} onChange={(e) => {
          const k = e.target.value as SlugKind;
          setKind(k);
          setQ('');
          setHits([]);
          if (k === 'free') { setOpen(false); }
          else { setOpen(true); search(''); }
        }}>
          {KIND_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        {kind === 'free' ? (
          <div className="ad-search sm:w-1/2 min-w-0">
            <Link2 className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
            <input
              className="ad-input"
              placeholder="/chemin-ou-url"
              value={free}
              onChange={(e) => { setFree(e.target.value); onChange(e.target.value); }}
            />
          </div>
        ) : (
          <div className="sm:w-1/2 min-w-0">
            <div className="ad-search">
              {kind === 'static' ? <Globe className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} /> : <FileText className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />}
              <input
                className="ad-input"
                placeholder={kind === 'static' ? 'Rechercher une page statique…' : `Rechercher par titre, id, code, module…`}
                value={q}
                onFocus={() => setOpen(true)}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {open && (
              <div className="ad-combo-list ad-scroll max-h-64">
                {busy && <div className="ad-combo-item text-xs" style={{ color: 'var(--ad-muted)' }}>Recherche…</div>}
                {!busy && hits.length === 0 && <div className="ad-combo-item text-xs" style={{ color: 'var(--ad-muted)' }}>Aucun résultat</div>}
                {hits.map((item, i) => {
                  const isIndex = Boolean(item.__index);
                  const isStatic = kind === 'static' || isIndex;
                  const title = titleOf(item);
                  const path = isStatic ? String(item.__path || '') : def ? def.build(item) : '';
                  const id = isStatic ? '' : String(pubId(item));
                  return (
                    <button
                      key={i}
                      type="button"
                      className="ad-combo-item items-center gap-2"
                      style={isIndex ? { borderBottom: '1px solid var(--ad-line)' } : undefined}
                      onClick={() => (isStatic ? selectStatic(item) : selectEntity(item))}
                    >
                      {isStatic ? (
                        <IconMark name={String(item.__icon || '')} className="w-4 h-4 shrink-0" />
                      ) : (
                        <IconMark name={def?.icon || ''} className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate flex-1 text-start">{title}</span>
                      {isIndex && (
                        <span className="text-[10px] font-black uppercase tracking-wider shrink-0" style={{ color: 'var(--ad-accent)' }}>
                          rubrique
                        </span>
                      )}
                      {id && <span className="font-mono text-[10px] opacity-60">#{id}</span>}
                      <span className="font-mono text-[10px] opacity-60 max-w-[45%] truncate">{path}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aperçu du lien sélectionné */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ad-muted)' }}>
        <Folder className="w-3.5 h-3.5" />
        <span className="font-mono">{value || '/'}</span>
        {value && <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" style={{ color: 'var(--ad-ok)' }} /> <span style={{ color: 'var(--ad-muted)' }}>sera préfixé par <code>/{locale}</code> sur la vitrine</span></span>}
      </div>
      <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ad-muted)' }}>
        <CornerDownLeft className="w-3 h-3" /> Le slug est enregistré sans la locale ; la vitrine ajoute la langue courante automatiquement.
      </p>
    </div>
  );
}
