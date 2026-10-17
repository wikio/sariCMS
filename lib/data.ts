// lib/data.ts
import type {
  Config,
  Menu,
  Product,
  Event,
  News,
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
import { cmsPublicList, cmsPublicOne, cmsFetch } from '@/lib/cms';
import { asPublicId, matchesEntity } from '@/lib/ids';

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
    title: String(row.title ?? ''),
    category: String(row.category ?? ''),
    date: String(row.date ?? row.publishedAt ?? ''),
    author: row.authorName ? String(row.authorName) : row.author ? String(row.author) : undefined,
    shortDesc: String(row.shortDesc ?? ''),
    fullContent: row.fullContent ? String(row.fullContent) : undefined,
    image: String(row.image ?? ''),
    readTime: row.readTime ? String(row.readTime) : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    sujet: row.sujet ? String(row.sujet) : undefined,
    classification: row.classification ? String(row.classification) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
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
    title: String(row.title ?? ''),
    type: String(row.type ?? ''),
    date: String(row.date ?? ''),
    location: String(row.location ?? ''),
    shortDesc: String(row.shortDesc ?? ''),
    fullContent: row.fullContent ? String(row.fullContent) : undefined,
    image: String(row.image ?? ''),
    agenda,
    slug: row.slug ? String(row.slug) : undefined,
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
    slug: row.slug ? String(row.slug) : undefined,
  };
}

function mapService(row: Record<string, unknown>): Service {
  return {
    id: asPublicId(row),
    title: String(row.title ?? ''),
    icon: String(row.icon ?? ''),
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
  return {
    id: String(row.slug ?? row.id ?? ''),
    title: String(row.title ?? ''),
    shortDesc: String(row.shortDesc ?? ''),
    fullDesc: row.fullDesc ? String(row.fullDesc) : undefined,
    icon: String(row.icon ?? ''),
    image: String(row.image ?? ''),
    color: String(row.color ?? 'sari-blue'),
    productIds: Array.isArray(row.productIds) ? (row.productIds as Array<string | number>) : [],
    features: Array.isArray(row.features) ? (row.features as string[]) : undefined,
    faq: Array.isArray(row.faq) ? (row.faq as SolutionCategory['faq']) : undefined,
  };
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

export async function getMenu(locale: string): Promise<Menu> {
  const fallback: Menu = {
    mainMenu: [],
    footerMenu: { navigation: [], legal: [] },
    socialLinks: {},
  };
  return fromCmsOrJson(locale, 'menu', fallback, async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('menus', locale);
    return mapMenu(rows);
  });
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
    return rows.length ? rows.map(mapNews) : null;
  });
}

export async function getEvents(locale: string): Promise<Event[]> {
  return fromCmsOrJson(locale, 'events', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('events', locale);
    return rows.length ? rows.map(mapEvent) : null;
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
    return rows.length ? rows.map(mapService) : null;
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
    cgv: { title: '', content: '' },
    about: { title: '', content: '' },
  };
  return fromCmsOrJson(locale, 'legal', fallback, async () => {
    const rows = (await cmsPublicList<Record<string, unknown>>('pages', locale)).filter(
      (r) => String(r.kind ?? '') === 'legal',
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
      };
    };
    const mapped: Legal = {
      mentions: pick('mention', 'legal-notice', 'mentions'),
      privacy: pick('privacy', 'confidential'),
      cgv: pick('cgv', 'condition'),
      about: pick('about'),
    };
    if (!mapped.mentions.title && !mapped.privacy.title && !mapped.cgv.title && !mapped.about.title) {
      return null;
    }
    return mapped;
  });
}

export async function getGenericContent(locale: string): Promise<GenericContent[]> {
  return fromCmsOrJson(locale, 'genericContent', [], async () => {
    const rows = (await cmsPublicList<Record<string, unknown>>('pages', locale)).filter(
      (r) => String(r.kind ?? '') === 'generic',
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

export async function getSolutionCategories(locale: string): Promise<SolutionCategory[]> {
  return fromCmsOrJson(locale, 'solution-categories', [], async () => {
    const rows = await cmsPublicList<Record<string, unknown>>('solutions', locale);
    return rows.length ? rows.map(mapSolution) : null;
  });
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
  const remote = await cmsPublicOne<Record<string, unknown>>('news', String(id), locale);
  if (remote) return mapNews(remote);
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
