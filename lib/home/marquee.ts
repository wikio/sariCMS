/**
 * Lignes du bandeau défilant de la page d'accueil.
 *
 * Le bloc « Bandeau partenaires défilant » n'affiche plus seulement des logos de
 * partenaires : il fait défiler des **éléments**, chacun étant soit une fiche
 * d'un module du site (partenaires, actualités, événements, offres d'emploi,
 * produits), soit un bloc libre saisi dans le studio (texte, image, texte +
 * image). Ce fichier décrit la correspondance entre une fiche et un élément, et
 * résout la liste à afficher ; le composant de la vitrine ne fait que la rendre.
 *
 * Tout y est **pur** (aucun `fs`, aucun appel réseau) : la page d'accueil, côté
 * serveur, lit les fiches avec les getters habituels (`getNews`, `getEvents`,
 * `getCareers`, `getProducts`, `getPartners`) et les passe en `pools` ; le studio,
 * côté client, appelle la même fonction pour son aperçu.
 *
 * Ce qui est enregistré dans la configuration du bloc, et rien d'autre :
 * - `selection` — mode automatique ou liste d'identifiants choisie dans le studio ;
 * - `items` — les réglages par fiche (titre ou image d'un élément, sans toucher à
 *   la fiche du module) **et** les blocs libres, marqués `from: 'free'`;
 * - `settings` — ce que le bandeau montre (`source`, `itemKind`, taille des
 *   images, espacements, vitesse…) ; `style` — fond, hauteur verticale, titre.
 *
 * Une fiche supprimée du module n'est pas un drame : elle disparaît du bandeau,
 * comme dans les autres blocs. Une image qui ne charge pas est retirée du rendu
 * par le composant, jamais remplacée par un cadre cassé.
 */
import {
  applySelection,
  boolSetting,
  numberSetting,
  overrideFor,
  selectionFor,
  setting,
  visibleItems,
  type HomeItem,
  type HomeSectionConfig,
} from './config';

export const MARQUEE_SOURCES = ['auto', 'partners', 'news', 'events', 'careers', 'products', 'mixed', 'custom'] as const;
export type MarqueeSource = (typeof MARQUEE_SOURCES)[number];

/** Ce que contient un élément du bandeau. */
export const MARQUEE_KINDS = ['auto', 'image-text', 'image', 'text'] as const;
export type MarqueeKind = (typeof MARQUEE_KINDS)[number];

/** Les ressources de fiches que le bandeau sait lire. */
export const MARQUEE_POOL_KEYS = ['partners', 'news', 'events', 'careers', 'products'] as const;
export type MarqueePool = (typeof MARQUEE_POOL_KEYS)[number];

export interface MarqueeRow {
  id: string;
  /** Ressource d'origine, ou `free` pour un bloc saisi dans le studio. */
  source: MarqueePool | 'free';
  kind: Exclude<MarqueeKind, 'auto'>;
  title: string;
  text: string;
  image: string;
  href: string;
  meta: string;
  /** Date de la fiche, lue pour ordonner le mode « Mixte » (jamais affichée telle quelle). */
  date?: string;
}

export type MarqueePools = Partial<Record<MarqueePool, readonly unknown[]>>;

/** Comment lire une fiche du site pour en faire un élément du bandeau. */
interface PoolShape {
  /** Préfixe de la fiche dans la vitrine (`/news`, `/events`…). */
  path: string;
  kind: Exclude<MarqueeKind, 'auto'>;
  title: string[];
  text: string[];
  image: string[];
  meta: string[];
  date: string[];
}

const POOL_SHAPES: Record<MarqueePool, PoolShape> = {
  partners: {
    path: '',
    // Le logo et son nom, rien d'autre : la catégorie d'un partenaire a sa
    // place dans la grille des partenaires, pas dans un bandeau qui défile.
    kind: 'image-text',
    title: ['name', 'title'],
    text: [],
    image: ['logo', 'image'],
    meta: [],
    date: [],
  },
  news: {
    path: '/news',
    kind: 'image-text',
    title: ['title'],
    text: ['shortDesc'],
    image: ['image'],
    meta: ['category', 'author'],
    date: ['publicationDate', 'date'],
  },
  events: {
    path: '/events',
    kind: 'image-text',
    title: ['title'],
    text: ['shortDesc'],
    image: ['image'],
    meta: ['location', 'type'],
    date: ['startDate', 'date'],
  },
  careers: {
    path: '/jobs',
    kind: 'image-text',
    title: ['title'],
    text: ['shortDesc'],
    image: ['image'],
    meta: ['location', 'type'],
    date: [],
  },
  products: {
    path: '/products',
    kind: 'image-text',
    title: ['name', 'title'],
    text: ['shortDesc'],
    image: ['image'],
    meta: ['category', 'price'],
    date: [],
  },
};

function pick(row: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function firstOf(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const value = pick(row, keys);
  return value || undefined;
}

/** Identifiant d'une fiche, tel que le studio le range dans `selection.ids`. */
function rowId(row: Record<string, unknown>): string {
  return String(row.id ?? row.legacyId ?? row.slug ?? '');
}

/** Lien interne de la fiche : `slug` quand la page le prend, sinon l'identifiant. */
function rowHref(shape: PoolShape, row: Record<string, unknown>): string {
  if (!shape.path) return pick(row, ['website', 'url', 'link']);
  const target = pick(row, ['slug']) || rowId(row);
  return target ? `${shape.path}/${target}` : '';
}

/** Une fiche du site → un élément du bandeau. */
function shapeRow(pool: MarqueePool, row: unknown): MarqueeRow | null {
  const raw = (row || {}) as Record<string, unknown>;
  const shape = POOL_SHAPES[pool];
  const id = rowId(raw);
  const title = pick(raw, shape.title);
  const text = pick(raw, shape.text);
  const image = pick(raw, shape.image);
  if (!id && !title && !image) return null;
  return {
    id: id || title.slice(0, 24),
    source: pool,
    kind: shape.kind,
    title,
    text,
    image,
    href: rowHref(shape, raw),
    meta: pick(raw, shape.meta),
    date: firstOf(raw, shape.date),
  };
}

/** Un bloc libre enregistré dans le bloc → un élément du bandeau. */
function freeRow(item: HomeItem): MarqueeRow | null {
  const title = String(item.title ?? item.label ?? item.name ?? '').trim();
  const text = String(item.text ?? item.description ?? '').trim();
  const image = String(item.image ?? item.logo ?? item.photo ?? '').trim();
  if (!title && !text && !image) return null;
  const declared = String(item.kind ?? '').trim();
  const kind: MarqueeRow['kind'] =
    declared === 'image' || declared === 'text' || declared === 'image-text'
      ? declared
      : image && (title || text)
        ? 'image-text'
        : image
          ? 'image'
          : 'text';
  return {
    id: `free-${String(item.id ?? title ?? image)}`,
    source: 'free',
    kind,
    // Le texte n'est gardé que s'il a quelque chose à côté de lui : un bloc
    // « image seule » dont on a rempli le texte affiche l'image et son titre,
    // pas un paragraphe que l'administrateur n'a pas demandé à voir défiler.
    title,
    text: kind === 'image-text' || kind === 'text' ? text : '',
    image: kind === 'text' ? '' : image,
    href: String(item.href ?? item.link ?? '').trim(),
    meta: String(item.meta ?? '').trim(),
  };
}

/** Un bloc libre est marqué `from: 'free'` ; une surcharge de fiche ne l'est pas. */
function isFreeItem(item: HomeItem): boolean {
  return String(item.from ?? '') === 'free';
}

/**
 * Éléments proposés en mode « Mixte » : les ressources citées dans
 * `mixedSources` (défaut : actualités, événements, produits, partenaires),
 * mises bout à bout puis triées par date quand elles en portent une.
 */
function mixedPools(config: HomeSectionConfig | undefined, pools: MarqueePools): MarqueePool[] {
  const raw = String(config?.settings?.mixedSources ?? '').trim();
  const wanted = (raw ? raw.split(/[,;]/).map((value) => value.trim().toLowerCase()) : ['news', 'events', 'products', 'partners'])
    .filter((value): value is MarqueePool => (MARQUEE_POOL_KEYS as readonly string[]).includes(value));
  const seen = new Set<MarqueePool>();
  const out: MarqueePool[] = [];
  for (const pool of wanted) {
    if (!seen.has(pool) && (pools[pool]?.length ?? 0)) out.push(pool);
  }
  return out;
}

export interface MarqueeOptions {
  /** Nombre maximal de fiches du module (les blocs libres ne comptent pas). */
  limit?: number;
}

/**
 * Liste des éléments à faire défiler.
 *
 * Ordre de priorité, celui de tous les blocs de la page d'accueil : ce que
 * l'administration a choisi (`selection.ids`, dans l'ordre choisi), sinon les
 * premières fiches du module selon le tri enregistré, et jamais les deux à la
 * fois. Les blocs libres du studio viennent ensuite, sauf si `source` vaut
 * `custom` — auquel cas ils sont la seule source.
 */
export function marqueeRows(
  config: HomeSectionConfig | undefined,
  pools: MarqueePools = {},
  options: MarqueeOptions = {},
): MarqueeRow[] {
  // `auto` = le comportement historique du bloc : les partenaires.
  const declared = String(setting<string>(config, 'source', 'auto')) as MarqueeSource;
  const source: MarqueeSource = declared === 'auto' ? 'partners' : declared;
  const free = visibleItems(config).filter(isFreeItem).map(freeRow).filter((row): row is MarqueeRow => Boolean(row));

  // Des blocs libres seuls si c'est ce qui a été choisi, ou si le module visé
  // n'a rien à montrer et que le studio a malgré tout rempli le bloc.
  if (source === 'custom' || (source === 'partners' && !(pools.partners?.length ?? 0) && free.length)) {
    return free;
  }

  const wanted: MarqueePool[] = source === 'mixed' ? mixedPools(config, pools) : [source as MarqueePool];

  const selection = selectionFor(config, options.limit ?? numberSetting(config, 'limit', 8));
  const manual = selection.mode === 'manual' && (selection.ids?.length ?? 0) > 0;

  const rows: MarqueeRow[] = [];
  if (manual) {
    // En sélection manuelle, l'administrateur a pu mélanger les ressources (mode
    // mixte) : chaque identifiant est cherché dans toutes les fiches chargées.
    const index = new Map<string, { pool: MarqueePool; row: unknown }>();
    for (const pool of MARQUEE_POOL_KEYS) {
      for (const row of pools[pool] || []) {
        const raw = (row || {}) as Record<string, unknown>;
        const id = rowId(raw);
        if (id && !index.has(id)) index.set(id, { pool, row });
        const slug = String(raw.slug ?? '');
        if (slug && !index.has(slug)) index.set(slug, { pool, row });
        const legacy = String(raw.legacyId ?? '');
        if (legacy && !index.has(legacy)) index.set(legacy, { pool, row });
      }
    }
    for (const id of selection.ids || []) {
      const hit = index.get(String(id));
      if (!hit) continue;
      const row = shapeRow(hit.pool, hit.row);
      if (row) rows.push(applyOverride(row, overrideFor(config, id)));
    }
  } else {
    const perPool = Math.max(1, Math.round((options.limit ?? selection.limit ?? 8) / Math.max(1, wanted.length)));
    for (const pool of wanted) {
      const shape = POOL_SHAPES[pool];
      const list = applySelection(
        // Les pools arrivent typés (`News[]`, `Partner[]`…) : `applySelection` a
        // seulement besoin de savoir lire un `id`.
        (Array.isArray(pools[pool]) ? (pools[pool] as unknown[]) : []) as Array<{ id: string | number }>,
        { ...selection, limit: wanted.length > 1 ? perPool : selection.limit },
        {
          titleKey: shape.title[0],
          dateKey: shape.date[0],
          dateOf: (row) => firstOf(row as Record<string, unknown>, shape.date),
        },
      );
      for (const row of list) {
        const shaped = shapeRow(pool, row);
        if (shaped) rows.push(applyOverride(shaped, overrideFor(config, rowId(row as Record<string, unknown>))));
      }
    }
    if (wanted.length > 1) {
      // Mixte : les plus récentes d'abord ; les fiches sans date (partenaires,
      // produits) gardent leur ordre et passent après, pour ne pas disparaître.
      rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }
  }

  if (!free.length) return dedupe(rows);
  // « Après la liste » ou « avant », au choix : un bandeau qui annonce les
  // prochaines actualités veut ses blocs libres en tête, un mur de marques les
  // veut à la fin.
  return dedupe(boolSetting(config, 'appendFree', true) ? [...rows, ...free] : [...free, ...rows]);
}

/** Ce que l'administrateur a saisi sur une fiche sélectionnée passe avant elle. */
function applyOverride(row: MarqueeRow, overrides: Record<string, unknown>): MarqueeRow {
  const str = (...keys: string[]) => {
    for (const key of keys) {
      const value = overrides[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };
  // `label` est la clé posée par la reprise des anciennes données ; le studio,
  // lui, écrit `title`. Les deux se lisent, pour qu'aucun des deux ne se taise.
  const kind = str('kind');
  return {
    ...row,
    title: str('title', 'label') ?? row.title,
    text: str('text') ?? row.text,
    image: str('image') ?? row.image,
    href: str('href') ?? row.href,
    meta: str('meta') ?? row.meta,
    kind: kind === 'image' || kind === 'text' || kind === 'image-text' ? kind : row.kind,
  };
}

/** Deux fois la même fiche, ce n'est pas deux marques : on garde la première. */
function dedupe(rows: MarqueeRow[]): MarqueeRow[] {
  const seen = new Set<string>();
  const out: MarqueeRow[] = [];
  for (const row of rows) {
    const key = `${row.source}:${row.id || row.title || row.image}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Le genre réel d'un élément, une fois le réglage du bloc appliqué. */
export function resolveKind(row: MarqueeRow, preferred: MarqueeKind = 'auto'): Exclude<MarqueeKind, 'auto'> {
  const forced = preferred !== 'auto' ? preferred : null;
  if (forced === 'text') return 'text';
  if (forced === 'image') return row.image ? 'image' : row.title || row.text ? 'text' : 'image';
  if (forced === 'image-text') return 'image-text';
  // `auto` : ce que l'élément a déjà dit de lui-même — la nature du module d'où
  // il vient (un partenaire est un logo, une actualité est un titre et son
  // chapeau), ou le choix posé fiche par fiche dans le studio.
  return row.kind;
}
