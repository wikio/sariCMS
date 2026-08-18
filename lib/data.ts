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
  SolutionCategory
} from '@/types';

// Cache en mémoire pour éviter de recharger les mêmes fichiers
const dataCache = new Map<string, any>();

/**
 * Fonction générique pour charger les données JSON
 */
async function loadData<T>(locale: string, key: string, fallback: T): Promise<T> {
  const cacheKey = `${locale}_${key}`;

  // Vérifier le cache
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  try {
    // Import dynamique du fichier JSON
    const data = await import(`@/data/${locale}/${key}.json`);
    const result = data.default || fallback;
    
    // Mettre en cache
    dataCache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.warn(`⚠️ Données non trouvées: ${locale}/${key}.json, utilisation du fallback`);
    return fallback;
  }
}

// ==========================================
// MÉTHODES PUBLIQUES
// ==========================================

export async function getConfig(locale: string): Promise<Config> {
  return loadData<Config>(locale, 'config', {
    meta: {
      companyName: 'SARI Système',
      tagline: 'Équipements Médicaux',
      description: 'Distribution d\'équipements médicaux depuis plus de 20 ans',
      logo: '/logo.png',
      phone: '+213 21 23 45 67',
      email: 'contact@sari-systeme.dz',
      address: 'Alger, Algérie',
      social: {
        facebook: 'https://facebook.com/sarisysteme',
        linkedin: 'https://linkedin.com/company/sari-systeme',
        twitter: 'https://twitter.com/sarisysteme',
        youtube: 'https://youtube.com/sarisysteme'
      }
    },
    stats: {
      clients: '500',
      experience: '20',
      support: '24/7',
      satisfaction: '98'
    }
  });
}

export async function getMenu(locale: string): Promise<Menu> {
  return loadData<Menu>(locale, 'menu', {
    mainMenu: [],
    footerMenu: { navigation: [], legal: [] },
    socialLinks: {}
  });
}

export async function getHero(locale: string): Promise<HeroSlide[]> {
  return loadData<HeroSlide[]>(locale, 'hero', []);
}

export async function getProducts(locale: string): Promise<Product[]> {
  return loadData<Product[]>(locale, 'products', []);
}

export async function getNews(locale: string): Promise<News[]> {
  return loadData<News[]>(locale, 'news', []);
}

export async function getEvents(locale: string): Promise<Event[]> {
  return loadData<Event[]>(locale, 'events', []);
}

export async function getCareers(locale: string): Promise<Career[]> {
  return loadData<Career[]>(locale, 'careers', []);
}

export async function getServices(locale: string): Promise<Service[]> {
  return loadData<Service[]>(locale, 'services', []);
}

export async function getTestimonials(locale: string): Promise<Testimonial[]> {
  return loadData<Testimonial[]>(locale, 'testimonials', []);
}

export async function getPartners(locale: string): Promise<Partner[]> {
  return loadData<Partner[]>(locale, 'partners', []);
}

export async function getLegal(locale: string): Promise<Legal> {
  return loadData<Legal>(locale, 'legal', {
    mentions: { title: '', content: '' },
    privacy: { title: '', content: '' },
    conditions: { title: '', content: '' },
    about: { title: '', content: '' }
  });
}

export async function getGenericContent(locale: string): Promise<GenericContent[]> {
  return loadData<GenericContent[]>(locale, 'genericContent', []);
}

export async function getVerificationCodes(locale: string): Promise<VerificationCode[]> {
  return loadData<VerificationCode[]>(locale, 'verification-codes', []);
}

export async function getSolutionCategories(locale: string): Promise<SolutionCategory[]> {
  return loadData<SolutionCategory[]>(locale, 'solution-categories', []);
}

// ==========================================
// MÉTHODES UTILITAIRES
// ==========================================

export function clearCache(): void {
  dataCache.clear();
}

export function invalidateCache(locale: string, key?: string): void {
  if (key) {
    dataCache.delete(`${locale}_${key}`);
  } else {
    Array.from(dataCache.keys()).forEach(cacheKey => {
      if (cacheKey.startsWith(`${locale}_`)) {
        dataCache.delete(cacheKey);
      }
    });
  }
}

// ==========================================
// FONCTIONS HELPER POUR LES PAGES
// ==========================================

export async function getProductById(locale: string, id: number): Promise<Product | null> {
  const products = await getProducts(locale);
  return products.find(p => p.id === id) || null;
}

export async function getEventById(locale: string, id: number): Promise<Event | null> {
  const events = await getEvents(locale);
  return events.find(e => e.id === id) || null;
}

export async function getNewsById(locale: string, id: number): Promise<News | null> {
  const news = await getNews(locale);
  return news.find(n => n.id === id) || null;
}

export async function getCareerById(locale: string, id: number): Promise<Career | null> {
  const careers = await getCareers(locale);
  return careers.find(c => c.id === id) || null;
}

export async function getServiceById(locale: string, id: number): Promise<Service | null> {
  const services = await getServices(locale);
  return services.find(s => s.id === id) || null;
}

export async function getGenericContentById(locale: string, id: number): Promise<GenericContent | null> {
  const contents = await getGenericContent(locale);
  return contents.find(c => c.id === id) || null;
}