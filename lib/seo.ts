import { promises as fs } from 'fs';
import path from 'path';

export interface SeoLocale {
  title: string;
  titleTemplate: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitter: string;
  canonical: string;
  robots: string;
  googleSiteVerification: string;
  favicon: string;
}

export type SeoStore = Record<string, SeoLocale>;

export const DEFAULT_SEO: SeoLocale = {
  title: 'SARI Système — Équipements médicaux',
  titleTemplate: '%s | SARI Système',
  description: 'Distribution d’équipements et consommables médicaux depuis plus de 20 ans.',
  keywords: 'équipement médical, échographe, SARI, Algérie, diagnostic',
  ogTitle: 'SARI Système',
  ogDescription: 'L’excellence médicale à votre service.',
  ogImage: '/logo.png',
  twitter: '@sarisysteme',
  canonical: 'https://sarisysteme.com',
  robots: 'index, follow',
  googleSiteVerification: '',
  favicon: '/logo.png',
};

const FILE = path.join(process.cwd(), 'data', 'seo.json');

export async function readSeoStore(): Promise<SeoStore> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as SeoStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeSeoStore(store: SeoStore) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2));
}

export async function getSeo(locale: string): Promise<SeoLocale> {
  const store = await readSeoStore();
  return { ...DEFAULT_SEO, ...(store[locale] || store.fr || {}) };
}
