// lib/data.ts
import type {
  Config,
  Menu,
  Product,
  Event,
  News,
  Author,
  Career,
  Service,
  Testimonial,
  Partner,
  Legal,
  GenericContent,
  VerificationCode,
  HeroSlide,
  SolutionCategory,
} from '@/types';
import { cmsPublicList, cmsPublicOne, cmsPublicTranslations, cmsFetch } from '@/lib/cms';
import { loadFicheLocale } from '@/lib/fiche-i18n';
import { asPublicId, matchesEntity } from '@/lib/ids';
import { findByRouteKey } from '@/lib/entity-url';
import {
  applyAutoMenus,
  usedAutoSources,
  type AutoEntity,
  type AutoSource,
  type MenuNode,
} from '@/lib/menu-auto';

const dataCache = new Map<string, unknown>();

async function loadData<T>(locale: string, key: string, fallback: T): Promise<T> {
  const cacheKey = `${locale}_${key}`;

  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey) as T;
  }

  try {
    const data = await import(`@/data/${locale}/${key}.json`);
    const result = (data.default || fallback) as T;
    dataCache.set(cacheKey, result);
    return result;
  } catch {
    console.warn(`⚠️ Données non trouvées: ${locale}/${key}.json, utilisation du fallback`);
    return fallback;
  }
}

function cacheSet<T>(locale: string, key: string, value: T): T {
  dataCache.set(`${locale}_${key}`, value);
  return value;
}

async function fromCmsOrJson<T>(
  locale: string,
  key: string,
  fallback: T,
  loader: () => Promise<T | null | undefined>,
): Promise<T> {
  const cacheKey = `${locale}_${key}`;
  if (dataCache.has(cacheKey)) return dataCache.get(cacheKey) as T;
  try {
    const remote = await loader();
    if (remote !== null && remote !== undefined) {
      const emptyArray = Array.isArray(remote) && remote.length === 0;
      const emptyObject =
        !Array.isArray(remote) && typeof remote === 'object' && Object.keys(remote as object).length === 0;
      if (!emptyArray && !emptyObject) {
        return cacheSet(locale, key, remote);
      }
    }
  } catch {
    // API down — JSON fallback
  }
  return loadData<T>(locale, key, fallback);
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: asPublicId(row),
    locale: row.locale ? String(row.locale) : undefined,
    legacyId: row.legacyId ? String(row.legacyId) : undefined,
    name: String(row.name ?? ''),
    category: String(row.category ?? ''),
    price: String(row.price ?? ''),
    shortDesc: String(row.shortDesc ?? ''),
    fullDesc: row.fullDesc ? String(row.fullDesc) : undefined,
    image: String(row.image ?? ''),
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : undefined,
    inStock: row.inStock !== false,
    deliveryTime: row.deliveryTime ? String(row.deliveryTime) : undefined,
    features: Array.isArray(row.features) ? (row.features as string[]) : undefined,
    specs: (row.specs as Record<string, string>) || undefined,
    options: Array.isArray(row.options) ? (row.options as Product['options']) : undefined,
    catalogPdf: row.catalogPdf ? String(row.catalogPdf) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
  };
}

function mapNews(row: Record<string, unknown>): News {
  return {
    id: asPublicId(row),
    locale: row.locale ? String(row.locale) : 'fr',
    title: String(row.title ?? ''),
    category: String(row.category ?? ''),
    date: String(row.date ?? row.publishedAt ?? ''),
    author: row.authorName ? String(row.authorName) : row.author ? String(row.author) : undefined,
    authorId: row.authorId !== null && row.authorId !== undefined ? (row.authorId as number | string) : undefined,
    shortDesc: String(row.shortDesc ?? ''),
    fullContent: row.fullContent ? String(row.fullContent) : undefined,
    image: String(row.image ?? ''),
    readTime: row.readTime ? String(row.readTime) : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    sujet: row.sujet ? String(row.sujet) : undefined,
    classification: row.classification ? String(row.classification) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
    legacyId: row.legacyId ? String(row.legacyId) : undefined,
  };
}

function mapEvent(row: Record<string, unknown>): Event {
  const agenda = Array.isArray(row.agenda)
    ? (row.agenda as Array<string | { title?: string }>).map((item) =>
        typeof item === 'string' ? item : String(item?.title ?? ''),
      )
    : undefined;
  return {
    id: asPublicId(row),
    locale: row.locale ? String(row.locale) : 'fr',
    title: String(row.title ?? ''),
    type: String(row.type ?? ''),
    date: String(row.date ?? ''),
    location: String(row.location ?? ''),
    shortDesc: String(row.shortDesc ?? ''),
    fullContent: row.fullContent ? String(row.fullContent) : undefined,
    image: String(row.image ?? ''),
    agenda,
    slug: row.slug ? String(row.slug) : undefined,
    legacyId: row.legacyId ? String(row.legacyId) : undefined,
  };
}

function mapCareer(row: Record<string, unknown>): Career {
  return {
    id: asPublicId(row),
    title: String(row.title ?? ''),
    type: String(row.type ?? ''),
    location: String(row.location ?? ''),
    salary: String(row.salary ?? ''),
    shortDesc: String(row.shortDesc ?? ''),
    fullDesc: row.fullDesc ? String(row.fullDesc) : undefined,
    image: row.image ? String(row.image) : undefined,
    typeTravail: row.typeTravail ? String(row.typeTravail) : undefined,
    mission: row.mission ? String(row.mission) : undefined,
    objectifs: Array.isArray(row.objectifs) ? (row.objectifs as string[]) : undefined,
    prerequis: Array.isArray(row.prerequis) ? (row.prerequis as string[]) : undefined,
    experience: row.experience ? String(row.experience) : undefined,
    workflow: Array.isArray(row.workflow) ? (row.workflow as string[]) : undefined,
    benefits: Array.isArray(row.benefits) ? (row.benefits as string[]) : undefined,
    contact: row.contact ? String(row.contact) : undefined,
    applyAuth: (row.applyAuth as Career['applyAuth']) || 'inherit',
    slug: row.slug ? String(row.slug) : undefined,
  };
}

function mapService(row: Record<string, unknown>): Service {
  return {
    id: asPublicId(row),
    // locale + legacyId : indispensables au changement de langue, qui relie
    // les versions d'une même fiche par leur legacyId.
    locale: row.locale ? String(row.locale) : undefined,
    legacyId: row.legacyId ? String(row.legacyId) : undefined,
    title: String(row.title ?? ''),
    icon: String(row.icon ?? ''),
    color: row.color ? String(row.color) : undefined,
    image: row.image ? String(row.image) : undefined,
    shortDesc: String(row.shortDesc ?? ''),
    fullDesc: row.fullDesc ? String(row.fullDesc) : undefined,
    features: Array.isArray(row.features) ? (row.features as string[]) : undefined,
    faq: Array.isArray(row.faq) ? (row.faq as Service['faq']) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
  };
}

function mapTestimonial(row: Record<string, unknown>): Testimonial {
  return {
    id: asPublicId(row),
    name: String(row.name ?? ''),
    role: String(row.role ?? ''),
    clinic: String(row.clinic ?? ''),
    text: String(row.text ?? ''),
    image: String(row.image ?? ''),
    rating: Number(row.rating ?? 5),
  };
}

function mapPartner(row: Record<string, unknown>): Partner {
  return {
    id: asPublicId(row),
    name: String(row.name ?? ''),
    logo: String(row.logo ?? ''),
    category: row.category ? String(row.category) : undefined,
  };
}

function mapHero(row: Record<string, unknown>): HeroSlide {
  return {
    id: asPublicId(row),
    title: String(row.title ?? ''),
    subtitle: String(row.subtitle ?? ''),
    description: String(row.description ?? ''),
    image: String(row.image ?? ''),
    cta: String(row.cta ?? ''),
    ctaLink: String(row.ctaLink ?? ''),
  };
}

function mapSolution(row: Record<string, unknown>): SolutionCategory {
  // productIds peut arriver en JSON string depuis MySQL/Prisma (colonne Json).
  let productIds: Array<string | number> = [];
  if (Array.isArray(row.productIds)) {
    productIds = row.productIds as Array<string | number>;
  } else if (typeof row.productIds === 'string' && row.productIds.trim()) {
    try {
      const parsed = JSON.parse(row.productIds);
      if (Array.isArray(parsed)) productIds = parsed;
    } catch {
      productIds = row.productIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const parseJsonArray = <T,>(value: unknown): T[] | undefined => {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed as T[];
      } catch {
        /* valeur non JSON — ignorée */
      }
    }
    return undefined;
  };

  return {
    id: asPublicId(row),
    locale: row.locale ? String(row.locale) : undefined,
    legacyId: row.legacyId ? String(row.legacyId) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
    title: String(row.title ?? ''),
    shortDesc: String(row.shortDesc ?? ''),
    fullDesc: row.fullDesc ? String(row.fullDesc) : undefined,
    icon: String(row.icon ?? ''),
    image: String(row.image ?? ''),
    color: String(row.color || 'sari-blue'),
    productIds,
    features: parseJsonArray<string>(row.features),
    faq: parseJsonArray<{ q: string; a: string }>(row.faq),
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : undefined,
  };
}

/**
 * Applique les traductions depuis localStorage (fiche i18n) sur les données CMS.
 * Les champs traduisibles sont remplacés par leur version traduite si disponible.
 */
function applyFicheTranslation<T extends Record<string, unknown>>(
  row: T,
  resource: string,
  locale: string,
  translatableFields: string[],
): T {
  if (locale === 'fr') return row; // Pas de traduction pour la langue par défaut
  const id = String(row.id ?? '');
  if (!id) return row;
  
  const fiche = loadFicheLocale(resource, id, locale);
  if (Object.keys(fiche).length === 0) return row;
  
  const merged = { ...row };
  for (const field of translatableFields) {
    if (fiche[field] !== undefined && fiche[field] !== '') {
      (merged as Record<string, unknown>)[field] = fiche[field];
    }
  }
  
  return merged;
}

/**
 * Vérifie qu'une ligne CMS correspond à la locale demandée. Les lignes sans
 * `locale` (données héritées) sont conservées pour ne rien casser.
 */
function rowMatchesLocale(row: Record<string, unknown>, locale: string): boolean {
  const rowLocale = String(row.locale ?? '').trim().toLowerCase();
  return !rowLocale || rowLocale === locale.toLowerCase();
}

/**
 * Résout la date de mise à jour d'un document légal : champ `lastUpdate` libre
 * (déjà lisible, ex. « 15 Janvier 2024 ») sinon date technique (`publishedAt`,
 * `updatedAt`) formatée en toutes lettres.
 */
function pickLastUpdate(row?: Record<string, unknown>): string | undefined {
  const raw = row?.lastUpdate ?? row?.publishedAt ?? row?.updatedAt;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = String(raw);
  // Déjà une date lisible en clair (contient des lettres, pas de forme ISO).
  if (/[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/.test(value) && !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function mapMenu(rows: Array<Record<string, unknown>>): Menu | null {
  if (!rows.length) return null;
  const byLocation = (loc: string) => rows.find((r) => r.location === loc);
  const itemsOf = (loc: string): unknown => {
    const row = byLocation(loc);
    return row?.items ?? [];
  };
  const main = itemsOf('main');
  const footerNav = itemsOf('footer-nav');
  const footerLegal = itemsOf('footer-legal');
  const social = itemsOf('social');
  if (!byLocation('main') && !byLocation('footer-nav') && rows.length === 1) {
    const only = rows[0];
    if (only.items && typeof only.items === 'object' && !Array.isArray(only.items)) {
      return only.items as Menu;
    }
  }
  if (!byLocation('main') && !byLocation('footer-nav') && !byLocation('footer-legal')) return null;
  return {
    mainMenu: Array.isArray(main) ? (main as Menu['mainMenu']) : [],
    footerMenu: {
      navigation: Array.isArray(footerNav) ? (footerNav as Menu['footerMenu']['navigation']) : [],
      legal: Array.isArray(footerLegal) ? (footerLegal as Menu['footerMenu']['legal']) : [],
    },
    socialLinks: social && !Array.isArray(social) ? (social as Record<string, string>) : {},
  };
}

export async function getConfig(locale: string): Promise<Config> {
  const fallback: Config = {
    meta: {
      companyName: 'SARI Système',
      tagline: 'Équipements Médicaux',
      description: "Distribution d'équipements médicaux depuis plus de 20 ans",
      logo: '/logo.png',
      phone: '+213 21 23 45 67',
      email: 'contact@sari-systeme.dz',
      address: 'Alger, Algérie',
      social: {
        facebook: 'https://facebook.com/sarisysteme',
        linkedin: 'https://linkedin.com/company/sari-systeme',
        twitter: 'https://twitter.com/sarisysteme',
        youtube: 'https://youtube.com/sarisysteme',
      },
    },
    stats: {
      clients: '500',
      experience: '20',
      support: '24/7',
      satisfaction: '98',
    },
  };

  return fromCmsOrJson(locale, 'config', fallback, async () => {
    try {
      const info = (await cmsFetch<Record<string, unknown>>(`/public/contact?locale=${encodeURIComponent(locale)}`)) || {};
      if (!info || (!info.company && !info.email && !info.phone)) return null;
      const extras = (info.extras && typeof info.extras === 'object' ? info.extras : {}) as Record<string, unknown>;
      const social = (info.social && typeof info.social === 'object' ? info.social : {}) as Config['meta']['social'];
      const stats = (extras.stats && typeof extras.stats === 'object' ? extras.stats : fallback.stats) as Config['stats'];
      return {
        meta: {
          companyName: String(info.company || fallback.meta.companyName),
          tagline: String(info.tagline || fallback.meta.tagline),
          description: String(extras.description || fallback.meta.description),
          logo: String(info.logo || fallback.meta.logo),
          phone: String(info.phone || fallback.meta.phone),
          email: String(info.email || fallback.meta.email),
          address: String(info.address || fallback.meta.address),
          social: { ...fallback.meta.social, ...social },
        },
        stats,
      };
    } catch {
      return null;
    }
  });
}

/**
 * Charge les listes nécessaires aux sous-menus générés.
 *
 * Seuls les modules réellement référencés par une règle sont chargés, et en
 * parallèle : un menu sans sous-menu automatique ne coûte aucune requête
 * supplémentaire.
 */
async function loadAutoDatasets(
  sources: AutoSource[],
  locale: string,
): Promise<Partial<Record<AutoSource, AutoEntity[]>>> {
  if (!sources.length) return {};
  const loaders: Record<AutoSource, (l: string) => Promise<unknown[]>> = {
    solutions: getSolutionCategories,
    services: getServices,
    products: getProducts,
    news: getNews,
    events: getEvents,
  };
  const entries = await Promise.all(
    sources.map(async (source) => {
      try {
        return [source, (await loaders[source](locale)) as AutoEntity[]] as const;
      } catch {
        // Un module indisponible ne doit pas faire disparaître tout le menu :
        // le lien parent reste, simplement sans sous-menu.
        return [source, [] as AutoEntity[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Partial<Record<AutoSource, AutoEntity[]>>;
}

/**
 * Développe les sous-menus générés d'un menu déjà chargé.
 *
 * Exporté pour que l'aperçu de l'administration applique exactement la même
 * résolution que la vitrine.
 */
export async function expandAutoMenus(menu: Menu, locale: string): Promise<Menu> {
  const main = (menu.mainMenu || []) as MenuNode[];
  const nav = (menu.footerMenu?.navigation || []) as MenuNode[];
  const sources = [...new Set([...usedAutoSources(main), ...usedAutoSources(nav)])];
  if (!sources.length) return menu;

  const datasets = await loadAutoDatasets(sources, locale);
  return {
    ...menu,
    mainMenu: applyAutoMenus(main, datasets, locale) as Menu['mainMenu'],
    footerMenu: {
      ...menu.footerMenu,
      navigation: applyAutoMenus(nav, datasets, locale) as Menu['footerMenu']['navigation'],
    },
  };
}

export async function getMenu(locale: string): Promise<Menu> {
  const fallback: Menu = {
    mainMenu: [],
    footerMenu: { navigation: [], legal: [] },
    socialLinks: {},
  };
  const menu = await fromCmsOrJson(locale, 'menu', fallback, async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('menus', locale);
    return mapMenu(rows);
  });
  // Résolution après la mise en cache du menu brut : les règles sont ainsi
  // réévaluées à chaque appel, sans quoi une fiche archivée resterait affichée
  // tant que le cache du menu n'a pas expiré.
  return expandAutoMenus(menu, locale);
}

export async function getHero(locale: string): Promise<HeroSlide[]> {
  return fromCmsOrJson(locale, 'hero', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('hero', locale);
    return rows.length ? rows.map(mapHero) : null;
  });
}

export async function getProducts(locale: string): Promise<Product[]> {
  return fromCmsOrJson(locale, 'products', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('products', locale);
    return rows.length ? rows.map(mapProduct) : null;
  });
}

export async function getNews(locale: string): Promise<News[]> {
  return fromCmsOrJson(locale, 'news', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('news', locale);
    
    // Si pas de résultats et locale != 'fr', essayer avec le français (fallback)
    if (rows.length === 0 && locale !== 'fr') {
      console.warn(`[getNews] Aucun article trouvé pour locale=${locale}, fallback sur fr`);
      const frRows = await cmsPublicList<Record<string, unknown>>('news', 'fr');
      return frRows.length ? frRows.map(mapNews) : [];
    }
    
    return rows.length ? rows.map(mapNews) : [];
  });
}

/**
 * Fiches auteurs. Le repli JSON (`data/{locale}/authors.json`) permet à la
 * vitrine de rester complète tant que l'API n'est pas alimentée.
 */
function mapAuthor(row: Record<string, unknown>): Author {
  return {
    id: asPublicId(row),
    locale: row.locale ? String(row.locale) : 'fr',
    legacyId: row.legacyId ? String(row.legacyId) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
    name: String(row.name ?? ''),
    role: row.role ? String(row.role) : undefined,
    bio: row.bio ? String(row.bio) : undefined,
    photo: row.photo ? String(row.photo) : undefined,
    email: row.email ? String(row.email) : undefined,
    isFallback: Boolean(row.isFallback),
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : undefined,
  };
}

export async function getAuthors(locale: string): Promise<Author[]> {
  return fromCmsOrJson(locale, 'authors', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('authors', locale);
    if (rows.length === 0 && locale !== 'fr') {
      const frRows = await cmsPublicList<Record<string, unknown>>('authors', 'fr');
      return frRows.length ? frRows.map(mapAuthor) : [];
    }
    return rows.length ? rows.map(mapAuthor) : [];
  });
}

/**
 * Auteur d'un article : par identifiant, sinon par nom (articles repris qui ne
 * portent qu'un `authorName`). Retourne `null` si aucune fiche ne correspond,
 * afin que la page puisse basculer sur l'auteur par défaut.
 */
export async function getArticleAuthor(locale: string, item: News): Promise<Author | null> {
  const authors = await getAuthors(locale);
  if (item.authorId !== undefined && item.authorId !== null) {
    const byId = authors.find((a) => String(a.id) === String(item.authorId));
    if (byId) return byId;
  }
  if (item.author) {
    const name = item.author.trim().toLowerCase();
    const byName = authors.find((a) => a.name.trim().toLowerCase() === name);
    if (byName) return byName;
  }
  return null;
}

/** Auteur par défaut configuré dans la liste des auteurs. */
export async function getDefaultAuthor(locale: string): Promise<Author | null> {
  const authors = await getAuthors(locale);
  return authors.find((a) => a.isFallback) ?? null;
}

export async function getEvents(locale: string): Promise<Event[]> {
  return fromCmsOrJson(locale, 'events', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('events', locale);
    
    // Si pas de résultats et locale != 'fr', essayer avec le français (fallback)
    if (rows.length === 0 && locale !== 'fr') {
      console.warn(`[getEvents] Aucun événement trouvé pour locale=${locale}, fallback sur fr`);
      const frRows = await cmsPublicList<Record<string, unknown>>('events', 'fr');
      return frRows.length ? frRows.map(mapEvent) : [];
    }
    
    return rows.length ? rows.map(mapEvent) : [];
  });
}

export async function getCareers(locale: string): Promise<Career[]> {
  return fromCmsOrJson(locale, 'careers', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('careers', locale);
    return rows.length ? rows.map(mapCareer) : null;
  });
}

export async function getServices(locale: string): Promise<Service[]> {
  return fromCmsOrJson(locale, 'services', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('services', locale);
    if (!rows.length) return null;
    
    // Appliquer les traductions depuis localStorage pour chaque service
    const translatedRows = rows.map(row => 
      applyFicheTranslation(row, 'services', locale, [
        'title', 'slug', 'icon', 'color', 'shortDesc', 'fullDesc', 'features', 'faq', 'image'
      ])
    );
    
    return translatedRows.map(mapService);
  });
}

export async function getTestimonials(locale: string): Promise<Testimonial[]> {
  return fromCmsOrJson(locale, 'testimonials', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('testimonials', locale);
    return rows.length ? rows.map(mapTestimonial) : null;
  });
}

export async function getPartners(locale: string): Promise<Partner[]> {
  return fromCmsOrJson(locale, 'partners', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('partners', locale);
    return rows.length ? rows.map(mapPartner) : null;
  });
}

export async function getLegal(locale: string): Promise<Legal> {
  const fallback: Legal = {
    mentions: { title: '', content: '' },
    privacy: { title: '', content: '' },
    conditions: { title: '', content: '' },
    about: { title: '', content: '' },
  };
  return fromCmsOrJson(locale, 'legal', fallback, async () => {
    const rows = (await cmsPublicList<Record<string, unknown>>('pages', locale)).filter(
      (r) => String(r.kind ?? '') === 'legal' && rowMatchesLocale(r, locale),
    );
    if (!rows.length) return null;
    const pick = (...slugParts: string[]) => {
      const row = rows.find((r) => {
        const slug = String(r.slug ?? '').toLowerCase();
        const subtype = String(r.subtype ?? '').toLowerCase();
        const category = String(r.category ?? '').toLowerCase();
        return slugParts.some(
          (part) => slug.includes(part) || subtype === part || category === part,
        );
      });
      return {
        title: String(row?.title ?? ''),
        content: String(row?.content ?? ''),
        lastUpdate: pickLastUpdate(row),
      };
    };
    const mapped: Legal = {
      mentions: pick('mention', 'legal-notice', 'mentions'),
      privacy: pick('privacy', 'confidential'),
      conditions: pick('condition', 'cgv', 'conditions', 'terms'),
      about: pick('about'),
    };
    if (!mapped.mentions.title && !mapped.privacy.title && !mapped.conditions.title && !mapped.about.title) {
      return null;
    }
    return mapped;
  });
}

export async function getGenericContent(locale: string): Promise<GenericContent[]> {
  return fromCmsOrJson(locale, 'genericContent', [], async () => {
    const rows = (await cmsPublicList<Record<string, unknown>>('pages', locale)).filter(
      (r) => String(r.kind ?? '') === 'generic' && rowMatchesLocale(r, locale),
    );
    if (!rows.length) return null;
    return rows.map((row) => ({
      id: asPublicId(row),
      title: String(row.title ?? ''),
      subtitle: row.subtitle ? String(row.subtitle) : undefined,
      category: row.category ? String(row.category) : undefined,
      type: (row.subtype as GenericContent['type']) || 'simple',
      content: row.content ? String(row.content) : undefined,
      media: (row.media as GenericContent['media']) || undefined,
      slides: (row.slides as GenericContent['slides']) || undefined,
      sections: (row.sections as GenericContent['sections']) || undefined,
    }));
  });
}

export async function getVerificationCodes(locale: string): Promise<VerificationCode[]> {
  return loadData<VerificationCode[]>(locale, 'verification-codes', []);
}

/** Champs d'une solution qui peuvent être traduits fiche par fiche. */
const SOLUTION_TRANSLATABLE_FIELDS = [
  'title',
  'slug',
  'icon',
  'color',
  'shortDesc',
  'fullDesc',
  'features',
  'faq',
  'image',
];

export async function getSolutionCategories(locale: string): Promise<SolutionCategory[]> {
  return fromCmsOrJson(locale, 'solution-categories', [], async () => {
    let rows = await cmsPublicList<Record<string, unknown>>('solutions', locale);

    // Fallback FR : une solution non encore traduite doit rester accessible,
    // ses champs traduits seront appliqués depuis la fiche i18n ci-dessous.
    if (!rows.length && locale !== 'fr') {
      rows = await cmsPublicList<Record<string, unknown>>('solutions', 'fr');
    }
    if (!rows.length) return null;

    // Appliquer les traductions (fiches i18n) pour chaque catégorie
    const translatedRows = rows.map((row) =>
      applyFicheTranslation(row, 'solutions', locale, SOLUTION_TRANSLATABLE_FIELDS),
    );

    const mapped = translatedRows.map(mapSolution);
    mapped.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return mapped;
  });
}

/**
 * Résout une solution depuis un segment d'URL `id-slug` (ou juste `id`/`slug`).
 * Voir `lib/entity-url.ts` pour la construction des URLs.
 */
export async function getSolutionByKey(
  locale: string,
  key: string,
): Promise<SolutionCategory | null> {
  const categories = await getSolutionCategories(locale);
  return findByRouteKey(categories, key);
}

/**
 * Versions linguistiques d'une solution, indexées par langue.
 *
 * Source de vérité : l'API (`/public/solutions/{key}/translations`), qui relie
 * les fiches par `legacyId`. En cas d'indisponibilité, on retombe sur les
 * données locales de la langue cible (rapprochement par legacyId puis par id).
 */
export async function getSolutionTranslations(
  key: string,
): Promise<Record<string, SolutionCategory>> {
  const rows = await cmsPublicTranslations<Record<string, unknown>>('solutions', key);
  const out: Record<string, SolutionCategory> = {};
  for (const row of rows) {
    const mapped = mapSolution(row);
    if (mapped.locale) out[mapped.locale] = mapped;
  }
  return out;
}

/**
 * Versions linguistiques d'une fiche, quel que soit le module.
 *
 * Interroge `/public/{resource}/{key}/translations`, qui relie les fiches par
 * `legacyId`. Le résultat est indexé par langue, sous une forme minimale
 * (`id` / `slug` / `legacyId` / `locale`) suffisante pour reconstruire l'URL —
 * inutile de connaître la forme complète de chaque module.
 *
 * Renvoie un objet vide si l'API est indisponible : l'appelant retombe alors
 * sur ses propres données locales.
 */
export async function getEntityTranslations(
  resource: string,
  key: string,
): Promise<Record<string, { id: string; slug?: string; legacyId?: string; locale?: string }>> {
  const rows = await cmsPublicTranslations<Record<string, unknown>>(resource, key);
  const out: Record<string, { id: string; slug?: string; legacyId?: string; locale?: string }> = {};
  for (const row of rows) {
    const locale = row.locale ? String(row.locale) : '';
    if (!locale) continue;
    out[locale] = {
      id: String(asPublicId(row)),
      slug: row.slug ? String(row.slug) : undefined,
      legacyId: row.legacyId ? String(row.legacyId) : undefined,
      locale,
    };
  }
  return out;
}

/**
 * Liste d'un module dans une langue donnée, sous forme d'entités routables.
 *
 * Sert de repli au sélecteur de langue quand l'endpoint `/translations` est
 * indisponible : on compare alors les listes des deux langues (legacyId, puis
 * id). Une seule fonction évite d'aiguiller vers `getNews`, `getEvents`, etc.
 */
export async function getRoutableList(
  resource: string,
  locale: string,
): Promise<Array<{ id: string; slug?: string; legacyId?: string; locale?: string; title?: string; name?: string }>> {
  const loaders: Record<string, (l: string) => Promise<unknown[]>> = {
    news: getNews,
    events: getEvents,
    services: getServices,
    products: getProducts,
    careers: getCareers,
    partners: getPartners,
    solutions: getSolutionCategories,
    pages: getGenericContent,
  };
  const loader = loaders[resource];
  if (!loader) return [];
  try {
    const rows = (await loader(locale)) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id ?? ''),
      slug: row.slug ? String(row.slug) : undefined,
      legacyId: row.legacyId ? String(row.legacyId) : undefined,
      locale: row.locale ? String(row.locale) : undefined,
      title: row.title ? String(row.title) : undefined,
      name: row.name ? String(row.name) : undefined,
    }));
  } catch {
    return [];
  }
}

export function clearCache(): void {
  dataCache.clear();
}

export function invalidateCache(locale: string, key?: string): void {
  if (key) {
    dataCache.delete(`${locale}_${key}`);
  } else {
    Array.from(dataCache.keys()).forEach((cacheKey) => {
      if (cacheKey.startsWith(`${locale}_`)) {
        dataCache.delete(cacheKey);
      }
    });
  }
}

export async function getProductById(locale: string, id: number | string): Promise<Product | null> {
  const remote = await cmsPublicOne<Record<string, unknown>>('products', String(id), locale);
  if (remote) return mapProduct(remote);
  const products = await getProducts(locale);
  return products.find((p) => matchesEntity(p, id)) || null;
}

export async function getEventById(locale: string, id: number | string): Promise<Event | null> {
  const remote = await cmsPublicOne<Record<string, unknown>>('events', String(id), locale);
  if (remote) return mapEvent(remote);
  const events = await getEvents(locale);
  return events.find((e) => matchesEntity(e, id)) || null;
}

export async function getNewsById(locale: string, id: number | string): Promise<News | null> {
  // Essayer d'abord dans la langue demandée
  let remote = await cmsPublicOne<Record<string, unknown>>('news', String(id), locale);
  
  // Fallback sur le français si non trouvé et locale != 'fr'
  if (!remote && locale !== 'fr') {
    console.warn(`[getNewsById] Article ${id} non trouvé pour locale=${locale}, fallback sur fr`);
    remote = await cmsPublicOne<Record<string, unknown>>('news', String(id), 'fr');
  }
  
  if (remote) return mapNews(remote);
  
  // Fallback sur la recherche locale
  const news = await getNews(locale);
  return news.find((n) => matchesEntity(n, id)) || null;
}

export async function getCareerById(locale: string, id: number | string): Promise<Career | null> {
  const remote = await cmsPublicOne<Record<string, unknown>>('careers', String(id), locale);
  if (remote) return mapCareer(remote);
  const careers = await getCareers(locale);
  return careers.find((c) => matchesEntity(c, id)) || null;
}

export async function getServiceById(locale: string, id: number | string): Promise<Service | null> {
  const remote = await cmsPublicOne<Record<string, unknown>>('services', String(id), locale);
  if (remote) return mapService(remote);
  const services = await getServices(locale);
  return services.find((s) => matchesEntity(s, id)) || null;
}

export async function getGenericContentById(locale: string, id: number | string): Promise<GenericContent | null> {
  const contents = await getGenericContent(locale);
  return contents.find((c) => matchesEntity(c, id)) || null;
}
