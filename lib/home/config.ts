/**
 * Configuration des blocs de la page d'accueil — types, valeurs par défaut et
 * fusion des couches.
 *
 * Trois couches, de la plus stable à la plus spécifique :
 *   1. `HOME_DEFAULTS`     — ce que le code sait faire sans aucune donnée ;
 *   2. `data/{langue}/home.json` — le fichier livré avec le projet, qui sert de
 *      secours quand l'API du CMS est joignable ni... ni indisponible ;
 *   3. l'API du CMS (`home_sections`) — ce que l'administration vient d'enregistrer.
 *
 * Une langue ne porte que ses TEXTES. La structure d'un bloc (blocs choisis,
 * nombre d'éléments, style, ordre, activation) vit dans la langue de référence
 * `fr` : personne n'a envie de re-sélectionner quatre produits en arabe après
 * l'avoir fait en français. À la lecture, la langue courante est donc fusionnée
 * par-dessus la langue de référence, champ par champ.
 */

import { isExternalLink, stripLocalePrefix } from '@/lib/link-kind.mjs';
import { locales } from '@/lib/i18n';
export const HOME_REF_LOCALE = 'fr';
export const HOME_LANGS = ['fr', 'en', 'ar'] as const;
export type HomeLang = (typeof HOME_LANGS)[number];

/**
 * Ressources que la rampe de sélection du studio sait parcourir, et forme d'une
 * entrée proposée. Ces types vivent ici, et non dans `lib/home/store`, parce
 * que les panneaux d'administration les importent — et que le magasin serveur
 * dépend de `fs`, donc ne peut pas entrer dans un bundle client.
 */
export type HomeOptionResource =
  | 'hero'
  | 'products'
  | 'testimonials'
  | 'events'
  | 'news'
  | 'partners'
  | 'careers'
  | 'pages';

export interface HomeOption {
  id: string;
  title: string;
  meta?: string;
  image?: string;
  status?: string;
  locale?: string;
}

export type HomeSectionKey =
  | 'hero'
  | 'partners-marquee'
  | 'navigation'
  | 'mission'
  | 'products'
  | 'blocks'
  | 'stats'
  | 'testimonials'
  | 'events'
  | 'news'
  | 'newsletter'
  | 'partners'
  | 'cta';

/** Ordre naturel de la page, tel qu'il est livré. */
export const HOME_ORDER: HomeSectionKey[] = [
  'hero',
  'partners-marquee',
  'navigation',
  'mission',
  'products',
  'blocks',
  'stats',
  'testimonials',
  'events',
  'news',
  'newsletter',
  'partners',
  'cta',
];

export type SelectionMode = 'auto' | 'manual';
export type SelectionSort = 'manual' | 'date-desc' | 'date-asc' | 'title-asc' | 'rating-desc' | 'random';

export interface HomeSelection {
  mode: SelectionMode;
  /** Identifiants des fiches, dans l'ordre d'affichage (mode manuel). */
  ids: Array<string | number>;
  /** Nombre maximal d'éléments affichés (les deux modes). */
  limit: number;
  /** Tri appliqué quand `mode` vaut « auto » (et en repli du mode manuel). */
  sort: SelectionSort;
  /** N'afficher que les fiches à venir / en stock, selon le module. */
  upcomingOnly?: boolean;
}

export interface HomeBuilder {
  /** `native` = le composant React de la vitrine ; `html` = sortie du constructeur. */
  mode: 'native' | 'html';
  html?: string;
  css?: string;
}

export interface HomeStyle {
  background?: 'inherit' | 'white' | 'gray' | 'sariGray' | 'blue' | 'dark' | 'lime' | 'custom';
  backgroundColor?: string;
  /** Image de fond (bandeau, parallaxe). */
  backgroundImage?: string;
  /** Opacité de l'assombrissement posé sur l'image, en %. */
  overlay?: number;
  paddingY?: number;
  radius?: number;
  gap?: number;
  columns?: number;
  align?: 'start' | 'center' | 'end';
  container?: 'narrow' | 'normal' | 'large' | 'full';
  titleSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** Le titre de section est-il affiché ? */
  showHeader?: boolean;
  /** Texte clair (fonds sombres). */
  invert?: boolean;
  shadow?: boolean;
  /** Motif quadrillé en filigrane, comme sur les bandeaux de la version précédente. */
  pattern?: boolean;
  /** CSS libre, appliqué à l'intérieur du bloc uniquement. */
  customCss?: string;
}

/** Un bloc répétable (chiffre, bloc alterné, argument newsletter, tuile…). */
export type HomeItem = Record<string, unknown> & { id: string };

export interface HomeSectionConfig {
  key: HomeSectionKey;
  /** Activer / masquer le bloc sur la page. */
  enabled: boolean;
  sortOrder: number;
  /** Textes saisis par l'administration ; vides = traductions du site. */
  texts: Record<string, string>;
  selection: HomeSelection;
  /** Réglages propres au bloc (autoplay, colonnes, libellés de bouton…). */
  settings: Record<string, unknown>;
  style: HomeStyle;
  items: HomeItem[];
  builder: HomeBuilder;
  status: 'published' | 'draft';
  updatedAt?: string;
}

export type HomeSections = Partial<Record<HomeSectionKey, HomeSectionConfig>>;

/** Configuration résolue pour une langue, telle que la vitrine la consomme. */
export interface HomeSnapshot {
  locale: string;
  /** Langue qui porte la structure des blocs. */
  ref: string;
  /** L'API du CMS a répondu (sinon : fichiers de secours). */
  api: boolean;
  order: HomeSectionKey[];
  sections: HomeSections;
  /**
   * Blocs dont le contenu vient des fichiers du site (slider, catalogue,
   * chiffres, traductions) et qui n'ont **aucun** enregistrement d'administration :
   * le studio le signale, et « Importer » l'écrit tel quel.
   */
  seeded?: HomeSectionKey[];
}

/** Fichier `data/{langue}/home.json`. */
export interface HomeFile {
  version: number;
  order?: HomeSectionKey[];
  sections?: HomeSections;
}

export const EMPTY_SELECTION: HomeSelection = { mode: 'auto', ids: [], limit: 4, sort: 'manual' };

function section(
  key: HomeSectionKey,
  input: Partial<HomeSectionConfig> = {},
): HomeSectionConfig {
  return {
    key,
    enabled: true,
    sortOrder: HOME_ORDER.indexOf(key),
    texts: {},
    selection: { ...EMPTY_SELECTION },
    settings: {},
    style: {},
    items: [],
    builder: { mode: 'native' },
    status: 'published',
    ...input,
  };
}

/**
 * Valeurs par défaut par bloc.
 *
 * Elles ne portent que les réglages qui changent le rendu (nombre
 * d'éléments, autoplay, colonnes…). Les textes n'y figurent pas : ils vivent
 * dans les traductions du site et l'administration ne fait que les surcharger.
 */
export const HOME_DEFAULTS: Record<HomeSectionKey, HomeSectionConfig> = {
  hero: section('hero', {
    selection: { ...EMPTY_SELECTION, limit: 4 },
    settings: {
      autoplay: true,
      interval: 6000,
      showDots: true,
      showArrows: true,
      height: 'screen',
      overlay: 80,
      align: 'start',
      // Le rendu d'origine : texte centré dans la hauteur du slider. Collé en
      // haut, il passerait sous le bandeau de navigation, qui survole la page.
      vertical: 'middle',
      topGap: 24,
    },
  }),
  'partners-marquee': section('partners-marquee', {
    selection: { ...EMPTY_SELECTION, limit: 12 },
    settings: {
      speed: 30, direction: 'left', showLogos: true, showNames: true,
      // Les clés historiques (`logoHeight`, `logoGap`, `showLogos`, `showNames`)
      // restent les alias des nouvelles : une ligne déjà enregistrée garde son
      // allure, et les nouveaux réglages s'appliquent à celles qui n'ont rien.
      source: 'partners',
      itemKind: 'auto',
      appendFree: true,
      showImage: true,
      showTitle: true,
      showText: true,
      logoHeight: 40,
      itemHeight: 40,
      mediaWidth: 0,
      mediaRadius: 8,
      mediaGap: 12,
      textSize: 'lg',
      textLines: 2,
      logoGap: 32,
      itemGap: 32,
      itemPadding: 0,
      valign: 'middle',
      cardStyle: 'plain',
      edgeFade: true,
      linkItems: true,
      showSeparator: true,
      pauseOnHover: true,
      separator: '•',
    },
    style: { background: 'blue', paddingY: 32, gap: 32, invert: true, showHeader: true },
  }),
  navigation: section('navigation', {
    selection: { ...EMPTY_SELECTION, limit: 6 },
    settings: { columns: 3 },
    style: { columns: 3, gap: 32, showHeader: true, background: 'sariGray', paddingY: 96, align: 'center' },
  }),
  mission: section('mission', {
    settings: { ctaHref: '/about', parallax: true, height: 480, overlay: 88 },
    style: { background: 'dark', paddingY: 128, align: 'center', invert: true, titleSize: 'xl' },
  }),
  products: section('products', {
    selection: { ...EMPTY_SELECTION, limit: 4 },
    settings: { ctaHref: '/products', showPrice: true, showStock: true, cardVariant: 'featured' },
    style: { background: 'white', columns: 4, gap: 32, paddingY: 96, showHeader: true },
  }),
  blocks: section('blocks', {
    settings: { imageHeight: 400, animate: true, startWith: 'image' },
    // Le bloc d'origine n'avait pas de titre au-dessus de la liste : les visées
    // s'enchaînaient directement. L'en-tête reste disponible, mais éteint.
    style: { background: 'gray', paddingY: 96, gap: 48, radius: 16, shadow: true, showHeader: false },
  }),
  stats: section('stats', {
    settings: { animate: true, fromConfig: true, suffixes: {} },
    style: { background: 'blue', paddingY: 96, columns: 4, gap: 32, align: 'center', invert: true, pattern: true },
  }),
  testimonials: section('testimonials', {
    selection: { ...EMPTY_SELECTION, limit: 5, sort: 'rating-desc' },
    settings: { layout: 'slider', autoplay: true, interval: 5000, showRating: true, showAvatar: true, showClinic: true },
    style: { background: 'sariGray', paddingY: 96, columns: 3, gap: 24, showHeader: true, align: 'center' },
  }),
  events: section('events', {
    selection: { ...EMPTY_SELECTION, limit: 3, sort: 'date-asc', upcomingOnly: true },
    settings: { ctaHref: '/events', showDate: true, layout: 'grid' },
    style: { background: 'white', paddingY: 96, columns: 3, gap: 32, showHeader: true },
  }),
  news: section('news', {
    selection: { ...EMPTY_SELECTION, limit: 3, sort: 'date-desc' },
    settings: { ctaHref: '/news', showAuthor: true, layout: 'grid' },
    style: { background: 'gray', paddingY: 96, columns: 3, gap: 32, showHeader: true },
  }),
  newsletter: section('newsletter', {
    settings: { showFeatures: true, required: true, doubleOptIn: false },
    style: { background: 'blue', paddingY: 96, radius: 12, invert: true, align: 'center' },
    items: [],
  }),
  partners: section('partners', {
    selection: { ...EMPTY_SELECTION, limit: 12 },
    settings: { showNames: true, grayscale: true },
    style: { background: 'white', paddingY: 96, columns: 6, gap: 32, showHeader: true, align: 'center' },
  }),
  cta: section('cta', {
    // `default` : l'habillage d'origine — bouton bleu dégradé, second bouton vert SARI.
    settings: { primaryHref: '/contact', secondaryHref: '/products', showSecondary: true, accent: 'default' },
    style: { background: 'dark', paddingY: 96, align: 'center', invert: true, titleSize: 'xl', pattern: true },
  }),
};

/* ------------------------------------------------------------------ helpers */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Texte saisi ? Une chaîne vide ou blanche laisse la main à la couche du dessous. */
function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null && value !== '';
}

/** Fusion « la couche haute gagne champ par champ », tableaux inclus. */
export function mergeSection(
  base: HomeSectionConfig | undefined,
  patch: Partial<HomeSectionConfig> | undefined,
): HomeSectionConfig {
  const out: HomeSectionConfig = {
    ...(base ?? section('hero')),
  };
  if (!patch) return out;

  if (patch.enabled !== undefined) out.enabled = patch.enabled;
  if (patch.sortOrder !== undefined) out.sortOrder = patch.sortOrder;
  if (patch.status) out.status = patch.status;
  if (patch.updatedAt) out.updatedAt = patch.updatedAt;

  out.texts = { ...out.texts };
  for (const [k, v] of Object.entries(patch.texts || {})) {
    if (hasText(v)) out.texts[k] = String(v);
  }

  out.settings = { ...out.settings, ...(isPlainObject(patch.settings) ? patch.settings : {}) };
  out.style = { ...out.style, ...(isPlainObject(patch.style) ? (patch.style as HomeStyle) : {}) };
  out.selection = { ...out.selection, ...(isPlainObject(patch.selection) ? (patch.selection as HomeSelection) : {}) };
  if (Array.isArray(patch.items) && patch.items.length) out.items = patch.items as HomeItem[];
  out.builder = { ...out.builder, ...(isPlainObject(patch.builder) ? (patch.builder as HomeBuilder) : {}) };
  return out;
}

/**
 * Fusionne la langue courante par-dessus la langue de référence.
 *
 * La structure (`selection`, `enabled`, `sortOrder`) vient toujours de la
 * référence : un bloc choisi en français reste le même bloc en arabe. Les
 * textes, les `items` (blocs répétables), le HTML du constructeur, le style et
 * les réglages sont relus dans la langue courante quand ils y ont été saisis.
 */
export function mergeLocale(
  ref: HomeSectionConfig | undefined,
  current: HomeSectionConfig | undefined,
  sameLocale: boolean,
): HomeSectionConfig {
  const base = section(current?.key || ref?.key || 'hero');
  const merged = mergeSection(mergeSection(base, ref), current);
  if (sameLocale || !ref) return merged;

  // Structure : on reprend la référence, sans exception.
  merged.enabled = ref.enabled ?? merged.enabled;
  merged.sortOrder = ref.sortOrder ?? merged.sortOrder;
  merged.selection = ref.selection ?? merged.selection;

  // Les textes, jamais : une langue qui n'a rien saisi doit reprendre les
  // traductions du site, et non le texte français de la langue de référence.
  // C'est ce qui rend l'édition « langue par langue » réelle (titre du CTA,
  // accroche du slider…), plutôt qu'une page française traduite à moitié.
  merged.texts = { ...(current?.texts || {}) };

  // Les `items` de la langue courante ne portent que leurs textes : on les
  // recolle sur la structure de la référence, bloc par bloc, par `id`.
  if (current?.items?.length) {
    const overrides = new Map(current.items.map((item) => [String(item.id ?? ''), item]));
    merged.items = (ref.items || []).map((item) => {
      const patch = overrides.get(String(item.id ?? ''));
      if (!patch) return item;
      const next: HomeItem = { ...item };
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id') continue;
        if (typeof v === 'string' ? v.trim() : v !== undefined && v !== null) next[k] = v;
      }
      return next;
    });
    // Blocs ajoutés dans la langue courante uniquement : conservés à la fin.
    for (const item of current.items) {
      if (!merged.items.some((x) => String(x.id ?? '') === String(item.id ?? ''))) merged.items.push(item);
    }
  } else {
    merged.items = ref.items ?? [];
  }
  return merged;
}

/** Reconstruit un dictionnaire de blocs complet, trois couches fusionnées. */
/**
 * Morceaux de configuration repris des fichiers du site (voir `lib/home/legacy.ts`) :
 * les seuls champs que la reprise connaît, fusionnés par-dessus les défauts du
 * bloc — jamais au-dessus d'un enregistrement de l'administration.
 */
export type HomeLegacySections = Partial<Record<HomeSectionKey, Partial<HomeSectionConfig>>>;

export function resolveHomeSections(input: {
  locale: string;
  ref?: HomeFile | null;
  current?: HomeFile | null;
  apiRows?: Array<Partial<HomeSectionConfig> & { key: string; locale?: string }>;
  /**
   * Contenu repris des fichiers du site (`lib/home/legacy.ts`), pour la langue
   * demandée et pour la langue de référence. Plus bas que les fichiers `home.json`
   * et que les lignes de l'API : ce n'est qu'un point de départ, jamais une
   * valeur qui écrase un enregistrement de l'administration.
   */
  legacy?: HomeLegacySections | null;
  legacyRef?: HomeLegacySections | null;
}): { order: HomeSectionKey[]; sections: HomeSections } {
  const { locale, ref, current, apiRows = [], legacy = null, legacyRef = null } = input;
  const sameLocale = locale === HOME_REF_LOCALE;

  const fileLayer = (file?: HomeFile | null): HomeSections => file?.sections || {};
  const apiLayer = (target: string): HomeSections => {
    const out: HomeSections = {};
    for (const row of apiRows) {
      if ((row.locale || HOME_REF_LOCALE) !== target) continue;
      const key = row.key as HomeSectionKey;
      if (!HOME_ORDER.includes(key) && !(key in HOME_DEFAULTS)) continue;
      out[key] = normalizeRow(key, row);
    }
    return out;
  };

  const refApi = apiLayer(HOME_REF_LOCALE);
  const curApi = apiLayer(locale);
  const refFile = fileLayer(ref);
  const curFile = fileLayer(current);

  const sections: HomeSections = {};
  for (const key of Object.keys(HOME_DEFAULTS) as HomeSectionKey[]) {
    const baseRef = mergeSection(HOME_DEFAULTS[key], legacyRef?.[key] || legacy?.[key]);
    const baseCur = mergeSection(HOME_DEFAULTS[key], legacy?.[key]);
    const refLayer = mergeSection(mergeSection(baseRef, refFile[key]), refApi[key]);
    const curLayer = mergeSection(mergeSection(baseCur, curFile[key]), curApi[key]);
    sections[key] = mergeLocale(refLayer, sameLocale ? undefined : curLayer, sameLocale);
  }

  // L'ordre enregistré (fichier) sert de base ; celui de l'administration est
  // porté par `sortOrder`. À rang égal on garde la base, pour que deux blocs
  // non enregistrés ne s'inversent pas au gré des écritures.
  const base = [...(current?.order || ref?.order || HOME_ORDER)] as HomeSectionKey[];
  for (const key of Object.keys(sections) as HomeSectionKey[]) {
    if (!base.includes(key)) base.push(key);
  }
  const baseIndex = new Map(base.map((key, index) => [key, index]));
  const order = base.slice().sort((a, b) => {
    const diff = (sections[a]?.sortOrder ?? 0) - (sections[b]?.sortOrder ?? 0);
    if (diff !== 0) return diff;
    return (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0);
  });
  return { order, sections };
}

/** Une ligne de l'API peut arriver en JSON string (colonnes JSON de MySQL). */
function normalizeRow(
  key: HomeSectionKey,
  row: Partial<Record<keyof HomeSectionConfig, unknown>> & { key: string; locale?: string },
): HomeSectionConfig {
  const parse = <T,>(value: unknown, fallback: T): T => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value as T;
  };
  const status = String(row.status ?? 'published');
  const enabled = row.enabled;
  const builder = parse<Partial<HomeBuilder>>(row.builder, {});
  return {
    ...HOME_DEFAULTS[key],
    key,
    // `enabled` peut arriver en chaîne ("false") selon le pilote de base.
    enabled: enabled === undefined || enabled === null ? true : !(enabled === false || enabled === 'false' || enabled === '0'),
    sortOrder: Number(row.sortOrder ?? HOME_ORDER.indexOf(key)) || 0,
    status: status === 'draft' || status === 'archived' ? 'draft' : 'published',
    texts: parse<Record<string, string>>(row.texts, {}),
    selection: { ...EMPTY_SELECTION, ...parse<Partial<HomeSelection>>(row.selection, {}) } as HomeSelection,
    settings: parse<Record<string, unknown>>(row.settings, {}),
    style: parse<HomeStyle>(row.style, {}),
    items: parse<HomeItem[]>(row.items, []),
    builder: { html: builder.html, css: builder.css, mode: builder.mode === 'html' && builder.html ? 'html' : 'native' },
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

/* ------------------------------------------------------------------ lecture */

/**
 * Un texte du bloc, ou le texte par défaut du site.
 *
 * L'administration peut laisser le champ vide : on retombe alors sur la
 * traduction `messages/*.json`, ce qui garde le site cohérent sans ressaisir
 * ce qui est déjà traduit.
 */
export function txt(config: HomeSectionConfig | undefined, key: string, fallback = ''): string {
  const value = config?.texts?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function setting<T>(config: HomeSectionConfig | undefined, key: string, fallback: T): T {
  const value = config?.settings?.[key];
  if (value === undefined || value === null || value === '') return fallback;
  return value as T;
}

export function numberSetting(config: HomeSectionConfig | undefined, key: string, fallback: number): number {
  const raw = config?.settings?.[key];
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Limite affichée : le réglage du bloc, sinon celle de la sélection. */
/**
 * Lignes d'un bloc répétable, dans l'ordre enregistré, sans celles que
 * l'administrateur a décochées. C'est ce que lit la vitrine.
 */
export function visibleItems(config: HomeSectionConfig | undefined): HomeItem[] {
  const items = Array.isArray(config?.items) ? (config.items as HomeItem[]) : [];
  return items.filter((item) => item && item.enabled !== false && item.enabled !== 'false');
}

/**
 * Réglages enregistrés dans le bloc pour une fiche sélectionnée.
 *
 * Le studio range ces réglages dans `items`, sous l'identifiant de la fiche :
 * la vitrine peut donc surcharger le titre ou le bouton d'un slide sans que
 * l'administrateur ait à modifier la fiche du module, qui sert aussi ailleurs.
 * Une valeur vide laisse la fiche parler.
 */
export function overrideFor(config: HomeSectionConfig | undefined, id: unknown): Record<string, unknown> {
  if (!id && id !== 0) return {};
  const key = String(id);
  const items = Array.isArray(config?.items) ? (config.items as HomeItem[]) : [];
  return items.find((item) => String(item.id) === key) || {};
}

/** Valeur surchargée si elle est remplie, sinon valeur de la fiche. */
export function orOverride(overrides: Record<string, unknown>, key: string, fallback: string): string {
  const raw = overrides[key];
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || fallback;
}

/** Le bloc répétable est-il vide (il faut donc retomber sur l'automatisme) ? */
export function hasItems(config: HomeSectionConfig | undefined): boolean {
  return visibleItems(config).length > 0;
}

export function limitOf(config: HomeSectionConfig | undefined, fallback = 4): number {
  for (const raw of [config?.settings?.limit, config?.settings?.count, config?.selection?.limit]) {
    const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

export function boolSetting(config: HomeSectionConfig | undefined, key: string, fallback = false): boolean {
  const value = config?.settings?.[key];
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return Boolean(value);
}

/**
 * Sélection effective du bloc : le nombre d'éléments et le filtre « à venir »
 * règlent aussi la sélection, ils sont donc recomposés ici pour que les
 * composants n'aient qu'un objet à appliquer.
 */
export function selectionFor(config: HomeSectionConfig | undefined, fallbackLimit = 4): HomeSelection {
  const base = { ...EMPTY_SELECTION, ...(config?.selection || {}) };
  const upcoming = config?.settings?.upcomingOnly;
  return {
    ...base,
    limit: limitOf(config, fallbackLimit),
    upcomingOnly:
      upcoming === undefined ? Boolean(base.upcomingOnly) : boolSetting(config, 'upcomingOnly', false),
  };
}

type Identifiable = { id: string | number };

/**
 * applique la sélection du bloc à une liste de fiches.
 *
 * Mode manuel : on prend les identifiants enregistrés, dans l'ordre choisi, et
 * une fiche qui a disparu du catalogue est simplement ignorée. Mode auto : on
 * trie puis on coupe à `limit`, pour que le nombre affiché se règle d'un
 * champ plutôt qu'en empilant les identifiants.
 */
export function applySelection<T extends Identifiable>(
  rows: T[],
  selection: HomeSelection | undefined,
  options: {
    dateKey?: string;
    titleKey?: string;
    ratingKey?: string;
    /** Filtre appliqué avant la sélection (événements à venir, produits en stock…). */
    where?: (row: T) => boolean;
    /** Comment lire la date d'une fiche quand elle est portée par plusieurs champs. */
    dateOf?: (row: T) => string | undefined;
  } = {},
): T[] {
  const sel = selection || EMPTY_SELECTION;
  const limit = Number.isFinite(sel.limit) && sel.limit > 0 ? sel.limit : rows.length;
  const dateKey = options.dateKey;
  const readDate = options.dateOf
    || ((row: T) => String((row as Record<string, unknown>)[dateKey || 'date'] ?? ''));
  const at = (row: T) => {
    const parsed = new Date(String(readDate(row) || ''));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };
  const pool = sel.upcomingOnly && (dateKey || options.dateOf)
    // Un repère de date absent (`0`) n'écarte pas la fiche : mieux vaut une
    // carte sans date qu'un bloc vide parce qu'un champ n'est pas rempli.
    ? rows.filter((row) => at(row) === 0 || at(row) >= Date.now() - 86_400_000)
    : options.where
      ? rows.filter(options.where)
      : rows;

  if (sel.mode === 'manual' && sel.ids?.length) {
    const byId = new Map<string, T>();
    for (const row of pool) byId.set(String(row.id), row);
    const picked: T[] = [];
    for (const id of sel.ids) {
      const found = byId.get(String(id));
      if (found) picked.push(found);
    }
    // Une sélection plus longue que la limite reste bornée : le champ
    // « nombre d'éléments » garde la main.
    if (picked.length) return picked.slice(0, limit);
    // Les fiches choisies ont pu être supprimées entre-temps (ou porter un autre
    // identifiant depuis que l'API fait foi). Un bloc dont la sélection ne pointe
    // sur rien retombe sur le choix automatique plutôt que de disparaître.
  }

  const sorted = [...pool];
  switch (sel.sort) {
    case 'date-desc':
    case 'date-asc': {
      sorted.sort((a, b) => (sel.sort === 'date-asc' ? at(a) - at(b) : at(b) - at(a)));
      break;
    }
    case 'title-asc': {
      const key = options.titleKey || 'title';
      sorted.sort((a, b) =>
        String((a as Record<string, unknown>)[key] || '').localeCompare(String((b as Record<string, unknown>)[key] || '')),
      );
      break;
    }
    case 'rating-desc': {
      const key = options.ratingKey || 'rating';
      sorted.sort(
        (a, b) =>
          Number((b as Record<string, unknown>)[key] || 0) - Number((a as Record<string, unknown>)[key] || 0),
      );
      break;
    }
    case 'random':
      for (let i = sorted.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
      break;
    default:
      break;
  }
  return sorted.slice(0, limit);
}

/**
 * Lien saisi dans le studio → lien exploitable par la vitrine.
 *
 * L'administration écrit `/contact` (chemin interne) ou une URL complète
 * (campagne, partenaire externe). Le premier doit être préfixé par la langue
 * courante, la seconde doit rester intacte ; un `#ancre` est toléré parce que
 * d'anciens réglages en contenaient.
 */
export function localizeHref(link: unknown, locale: string, fallback = ''): string {
  const raw = String(link ?? '').trim();
  if (!raw) return fallback;
  if (isExternalLink(raw)) return raw;
  const clean = raw.replace(/^#/, '/').replace(/^\/+/, '/');
  // Une valeur déjà préfixée par une langue (un lien repris d'un export, d'une reprise
  // de données) se range sur la langue courante au lieu de doubler le préfixe.
  const path = clean.startsWith('/') ? stripLocalePrefix(clean, locales).path : `/${clean}`;
  return `/${locale}${path === '/' ? '' : path}`;
}

/** Classes/attributs du conteneur selon le style choisi. */
export function styleVars(config: HomeSectionConfig | undefined): Record<string, string> {
  const s = config?.style || {};
  const vars: Record<string, string> = {};
  if (s.paddingY !== undefined) vars['--hs-pad'] = `${s.paddingY}px`;
  if (s.gap !== undefined) vars['--hs-gap'] = `${s.gap}px`;
  if (s.radius !== undefined) vars['--hs-radius'] = `${s.radius}px`;
  if (s.columns) vars['--hs-cols'] = String(s.columns);
  return vars;
}

export const BACKGROUND_CLASS: Record<NonNullable<HomeStyle['background']>, string> = {
  inherit: '',
  white: 'bg-white dark:bg-[#1a1a1a]',
  gray: 'bg-gray-50 dark:bg-[#111111]',
  /** Le gris du corps de page, plus soutenu que `gray-50` — celui des blocs hérités. */
  sariGray: 'bg-sari-gray dark:bg-[#111111]',
  blue: 'bg-sari-blue text-white',
  lime: 'bg-sari-lime',
  dark: 'bg-sari-dark text-white',
  custom: '',
};

export const CONTAINER_CLASS: Record<NonNullable<HomeStyle['container']>, string> = {
  narrow: 'container mx-auto px-6 max-w-4xl',
  normal: 'container mx-auto px-6',
  large: 'container mx-auto px-6 max-w-[1400px]',
  full: 'px-6 max-w-none',
};

export const TITLE_SIZE_CLASS: Record<NonNullable<HomeStyle['titleSize']>, string> = {
  sm: 'text-2xl md:text-3xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl',
  xl: 'text-4xl md:text-6xl',
};

/** Nettoie le HTML produit par le constructeur : pas de script, pas d'inline handler. */
export function sanitizeBuilderHtml(html: string): string {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Échappe une portée CSS : le style saisi par l'administration s'applique à un
 * seul bloc, préfixé par une classe générée, pour ne pas fuiter sur la page.
 */
export function scopeCss(css: string, scope: string): string {
  if (!css) return '';
  const clean = String(css).replace(/<\/style>/gi, '');
  return clean.replace(/(^|\})\s*([^{}@/]+)\{/g, (_m, brace: string, head: string) => {
    const selector = head.trim();
    if (!selector || selector.startsWith('@') || selector.startsWith(':root')) return `${brace}${selector}{`;
    const scoped = selector
      .split(',')
      .map((s) => `${scope} ${s.trim()}`.trim())
      .join(', ');
    return `${brace}${scoped}{`;
  });
}
