'use client';

import { cmsFetch, CmsError, unwrapList, type CmsRequestOptions } from '@/lib/cms';
import {
  ADMIN_REFRESH_KEY,
  clearAdminSession,
  persistAdminSession,
  readAdminAccess,
} from '@/lib/admin-session';

export const RESOURCE_BY_TYPE: Record<string, string> = {
  products: 'products',
  services: 'services',
  careers: 'careers',
  news: 'news',
  authors: 'authors',
  events: 'events',
  testimonials: 'testimonials',
  partners: 'partners',
  'solution-categories': 'solutions',
  hero: 'hero',
  genericContent: 'pages',
  legal: 'pages',
  menu: 'menus',
  navigation: 'menus',
  users: 'users',
  pages: 'pages',
};

export const WRITABLE_FIELDS: Record<string, string[]> = {
  products: [
    'name', 'slug', 'locale', 'category', 'sku', 'price', 'shortDesc', 'fullDesc',
    'image', 'gallery', 'inStock', 'stockQty', 'stockFinal', 'currency', 'deliveryTime', 'features', 'specs', 'options',
    'catalogPdf', 'status', 'sortOrder',
  ],
  services: ['title', 'slug', 'locale', 'icon', 'color', 'image', 'shortDesc', 'fullDesc', 'features', 'faq', 'sortOrder', 'status'],
  careers: [
    'title', 'slug', 'locale', 'type', 'location', 'salary', 'shortDesc', 'fullDesc', 'image',
    'typeTravail', 'mission', 'objectifs', 'prerequis', 'experience', 'workflow', 'benefits',
    'contact', 'applyAuth', 'status',
  ],
  news: [
    'title', 'slug', 'locale', 'category', 'classification', 'sujet', 'authorName', 'authorId', 'date', 'publicationDate',
    'readTime', 'shortDesc', 'fullContent', 'image', 'tags', 'status',
  ],
  authors: ['name', 'slug', 'locale', 'role', 'bio', 'email', 'photo', 'isFallback', 'sortOrder', 'status'],
  events: [
    'title', 'slug', 'locale', 'type', 'date', 'startDate', 'endDate', 'location', 'shortDesc', 'fullContent',
    'image', 'agenda', 'status',
  ],
  testimonials: ['name', 'locale', 'role', 'clinic', 'text', 'image', 'rating', 'sortOrder', 'status'],
  partners: ['name', 'locale', 'logo', 'category', 'website', 'sortOrder', 'status'],
  solutions: [
    'title', 'slug', 'locale', 'shortDesc', 'fullDesc', 'icon', 'image', 'color',
    'productIds', 'features', 'faq', 'sortOrder', 'status',
  ],
  hero: ['title', 'locale', 'subtitle', 'description', 'image', 'cta', 'ctaLink', 'sortOrder', 'status'],
  pages: [
    'slug', 'locale', 'kind', 'subtype', 'title', 'subtitle', 'category', 'content',
    'media', 'slides', 'sections', 'features', 'pdfUrl', 'status', 'sortOrder',
  ],
  menus: ['name', 'location', 'items', 'locale', 'status'],
  users: [
    // `wilaya` existe en base et dans le DTO serveur : sans lui ici, `pick()`
    // le retirait silencieusement de la charge utile et la wilaya saisie
    // n'était jamais enregistrée.
    'email', 'password', 'firstName', 'lastName', 'phone', 'company', 'type', 'status',
    'roleId', 'locale', 'avatar', 'address', 'wilaya', 'position', 'experience', 'motivation', 'cvUrl',
    'ip', 'country',
  ],
  roles: ['name', 'slug', 'description', 'permissionIds', 'isSystem'],
};

const DEFAULTS: Record<string, Record<string, unknown>> = {
  products: { name: 'Nouveau produit', status: 'draft', inStock: true },
  services: { title: 'Nouveau service', status: 'draft', icon: 'wrench' },
  careers: { title: 'Nouvelle offre', status: 'draft', type: 'CDI' },
  news: { title: 'Nouvel article', status: 'draft' },
  authors: { name: 'Nouvel auteur', status: 'published' },
  events: { title: 'Nouvel événement', status: 'draft' },
  testimonials: { name: 'Nouveau témoignage', text: 'Avis client', rating: 5, status: 'published' },
  partners: { name: 'Nouveau partenaire', status: 'published' },
  solutions: { title: 'Nouvelle solution', slug: `solution-${Date.now()}`, status: 'draft' },
  hero: { title: 'Nouveau slide', status: 'draft' },
  pages: { title: 'Nouvelle page', slug: `page-${Date.now()}`, kind: 'generic', subtype: 'simple', status: 'draft' },
  menus: { name: 'Nouveau menu', location: 'main', items: [], status: 'published' },
  users: {
    email: `user${Date.now()}@sarisysteme.com`,
    firstName: 'Nouveau',
    lastName: 'User',
    password: 'ChangeMe_Sari2026!',
    type: 'client',
    status: 'pending',
  },
};

function pick(resource: string, item: Record<string, unknown>): Record<string, unknown> {
  const allowed = WRITABLE_FIELDS[resource] || Object.keys(item);
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = item[key];
    if (value === undefined || value === null) continue;
    if (value === '' && (key === 'slug' || key === 'sku')) continue;
    out[key] = value;
  }
  return out;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem(ADMIN_REFRESH_KEY);
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const session = await cmsFetch<{ accessToken: string; refreshToken?: string; user?: unknown }>(
          '/auth/refresh',
          { method: 'POST', json: { refreshToken }, timeoutMs: 8000 },
        );
        if (!session.accessToken) return false;
        persistAdminSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken || refreshToken,
          user: session.user as never,
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function cmsAdminFetch<T = unknown>(path: string, options: CmsRequestOptions = {}): Promise<T> {
  const token = readAdminAccess();
  try {
    return await cmsFetch<T>(path, { timeoutMs: 12000, ...options, token });
  } catch (err) {
    if (err instanceof CmsError && err.status === 401) {
      const ok = await tryRefresh();
      if (ok) {
        return cmsFetch<T>(path, { timeoutMs: 12000, ...options, token: readAdminAccess() });
      }
      clearAdminSession();
      if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/admin')) {
        const locale = window.location.pathname.split('/')[1] || 'fr';
        window.location.href = `/${locale}/admin`;
      }
    }
    throw err;
  }
}

export async function cmsAdminList<T = Record<string, unknown>>(
  resource: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const params = new URLSearchParams({ view: 'block', limit: '100' });
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const payload = await cmsAdminFetch<unknown>(`/${resource}?${params.toString()}`);
  return unwrapList<T>(payload);
}

/**
 * Charge une fiche complète.
 *
 * La liste renvoie une projection allégée (`view=block`) : `position` et
 * `roleId`, par exemple, en sont absents. Ouvrir un formulaire d'édition à
 * partir d'une ligne de liste afficherait donc ces champs vides, et les
 * effacerait à l'enregistrement. On relit la fiche entière avant d'éditer.
 */
export async function cmsAdminGet<T = Record<string, unknown>>(
  resource: string,
  id: string,
): Promise<T> {
  const payload = await cmsAdminFetch<unknown>(`/${resource}/${id}`);
  const corps = payload as { data?: unknown };
  return ((corps && typeof corps === 'object' && 'data' in corps ? corps.data : payload) || {}) as T;
}

export async function cmsAdminCreate<T = Record<string, unknown>>(
  resource: string,
  item: Record<string, unknown>,
): Promise<T> {
  return cmsAdminFetch<T>(`/${resource}`, { method: 'POST', json: pick(resource, item), timeoutMs: 15000 });
}

export async function cmsAdminUpdate<T = Record<string, unknown>>(
  resource: string,
  id: string,
  item: Record<string, unknown>,
): Promise<T> {
  return cmsAdminFetch<T>(`/${resource}/${id}`, { method: 'PATCH', json: pick(resource, item), timeoutMs: 15000 });
}

export async function cmsAdminDelete(resource: string, id: string): Promise<void> {
  await cmsAdminFetch(`/${resource}/${id}`, { method: 'DELETE' });
}

export function newItemDraft(resource: string, locale: string): Record<string, unknown> {
  return { ...(DEFAULTS[resource] || { title: 'Nouvel élément', status: 'draft' }), locale };
}

export async function cmsHealth(): Promise<{ driver?: string; uptime?: number } | null> {
  try {
    return await cmsFetch('/health', { timeoutMs: 2500 });
  } catch {
    return null;
  }
}

export async function cmsStatus(): Promise<{
  driver: string;
  connected: boolean;
  counts: Record<string, number>;
} | null> {
  try {
    return await cmsAdminFetch('/settings/status', { timeoutMs: 5000 });
  } catch {
    return null;
  }
}

export async function cmsImportCatalog(replace = false) {
  return cmsAdminFetch<{ imported: Record<string, number>; skipped: Record<string, string> }>(
    '/settings/import-catalog',
    { method: 'POST', json: { replace }, timeoutMs: 60000 },
  );
}

/**
 * Ressources dont les enregistrements ne sont pas des traductions.
 *
 * Le back-office liste la plupart des contenus une langue à la fois : une
 * actualité existe en français, en anglais et en arabe sous trois
 * enregistrements distincts, et afficher les trois mélangés n'aurait pas de
 * sens. Les comptes utilisateurs, eux, n'existent qu'une fois. Leur champ
 * `locale` dit dans quelle langue la personne veut voir le site, pas dans
 * quelle langue sa fiche est rédigée : filtrer dessus faisait disparaître de
 * la liste tous les comptes réglés sur une autre langue que celle du
 * sélecteur — la liste devenait même vide en arabe.
 */
const RESSOURCES_SANS_TRADUCTION = new Set(['users']);

/** Un module liste-t-il des enregistrements propres à une langue ? */
export function estTraduitParLangue(dataType: string): boolean {
  return !RESSOURCES_SANS_TRADUCTION.has(dataType);
}

export function extraFiltersForType(dataType: string, locale: string): Record<string, string> {
  const filter: Record<string, string> = {};
  if (estTraduitParLangue(dataType)) filter.locale = locale;
  if (dataType === 'legal') filter.kind = 'legal';
  if (dataType === 'genericContent') filter.kind = 'generic';
  // Un filtre vide vaut mieux qu'un `filter={}` inutile dans l'URL.
  return Object.keys(filter).length ? { filter: JSON.stringify(filter) } : {};
}

export async function cmsAdminAutocomplete(
  resource: string,
  q: string,
  field = 'title',
): Promise<Array<{ id: string; value: string }>> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q, field, limit: '12' });
  try {
    const payload = await cmsAdminFetch<unknown>(`/${resource}/autocomplete?${params.toString()}`);
    return unwrapList<{ id: string; value: string }>(payload);
  } catch {
    return [];
  }
}
