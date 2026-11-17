'use client';

import { cmsFetch, CmsError, unwrap, unwrapList, type CmsRequestOptions } from '@/lib/cms';
import {
  clearAdminSession,
  readAdminAccess,
} from '@/lib/admin-session';
import { CSRF_HEADER_NAME, getClientCsrfToken } from '@/lib/csrf';
import { clearAuthCache } from '@/components/admin/useAdminAuth';

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

const ADMIN_CMS_PROXY = '/api/admin/cms';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfTokenInFlight: Promise<string | null> | null = null;

async function ensureCsrfToken(): Promise<string | null> {
  const existing = getClientCsrfToken();
  if (existing) return existing;
  if (typeof window === 'undefined') return null;
  if (!csrfTokenInFlight) {
    csrfTokenInFlight = (async () => {
      try {
        const res = await fetch('/api/csrf-token', { credentials: 'same-origin', cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as { csrfToken?: string } | null;
          return data?.csrfToken || getClientCsrfToken();
        }
      } catch {
        // ignore
      } finally {
        csrfTokenInFlight = null;
      }
      return getClientCsrfToken();
    })();
  }
  return csrfTokenInFlight;
}

async function adminProxyFetch<T>(path: string, options: CmsRequestOptions = {}): Promise<T> {
  const { token, json, timeoutMs = 12000, headers, ...init } = options;
  const method = String(init.method || 'GET').toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${ADMIN_CMS_PROXY}${normalizedPath}`;

  try {
    const reqHeaders = new Headers(headers as HeadersInit | undefined);
    if (!reqHeaders.has('Accept')) reqHeaders.set('Accept', 'application/json');
    if (json !== undefined && !reqHeaders.has('Content-Type')) {
      reqHeaders.set('Content-Type', 'application/json');
    }
    const bearerToken = token || readAdminAccess();
    if (bearerToken && !reqHeaders.has('Authorization')) {
      reqHeaders.set('Authorization', `Bearer ${bearerToken}`);
    }
    if (MUTATING_METHODS.has(method) && !reqHeaders.has(CSRF_HEADER_NAME)) {
      const csrf = await ensureCsrfToken();
      if (csrf) reqHeaders.set(CSRF_HEADER_NAME, csrf);
    }

    const res = await fetch(url, {
      ...init,
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: reqHeaders,
      body: json !== undefined ? JSON.stringify(json) : init.body,
      cache: 'no-store',
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const raw =
        parsed && typeof parsed === 'object' && 'message' in parsed
          ? (parsed as { message: unknown }).message
          : parsed && typeof parsed === 'object' && 'error' in parsed
            ? (parsed as { error: unknown }).error
            : '';
      const message = Array.isArray(raw) ? raw.join(' · ') : String(raw || '') || `CMS ${res.status}`;
      throw new CmsError(message, res.status, parsed);
    }

    return unwrap<T>(parsed);
  } finally {
    clearTimeout(timer);
  }
}

let refreshInFlight: Promise<boolean> | null = null;
let expiringSession: Promise<void> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/admin/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function handleExpiredSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!expiringSession) {
    expiringSession = (async () => {
      let redirected = false;
      try {
        clearAdminSession();
        clearAuthCache();
        // Nettoie les cookies httpOnly côté serveur avant toute redirection vers
        // /{locale}/admin, sinon /api/admin/auth/me répondrait encore 200 et
        // relancerait une boucle infinie login ↔ dashboard.
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        }).catch(() => {});
        const pathname = window.location.pathname;
        const match = pathname.match(/^\/(fr|en|ar)\/admin\/.+/);
        if (match) {
          redirected = true;
          window.location.href = `/${match[1]}/admin`;
        }
      } finally {
        if (!redirected) expiringSession = null;
      }
    })();
  }
  await expiringSession;
}

export async function cmsAdminFetch<T = unknown>(path: string, options: CmsRequestOptions = {}): Promise<T> {
  if (typeof window === 'undefined') {
    return cmsFetch<T>(path, { timeoutMs: 12000, ...options });
  }
  try {
    return await adminProxyFetch<T>(path, options);
  } catch (err) {
    if (err instanceof CmsError && err.status === 401) {
      const ok = await tryRefresh();
      if (ok) {
        return adminProxyFetch<T>(path, options);
      }
      await handleExpiredSession();
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
  /** Compteurs que la base n'a pas fournis (table absente, droit manquant). */
  unavailable?: string[];
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
