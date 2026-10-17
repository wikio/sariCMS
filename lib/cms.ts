/**
 * Client CMS — parle à l’API Nest (`/api/v1`).
 *
 * Côté navigateur : URL relative `/api/v1` (proxy Next → backend).
 * Côté serveur     : `CMS_API_INTERNAL_URL` (127.0.0.1:3001 par défaut).
 * Si l’API est down ou vide, les appelants retombent sur les JSON statiques.
 */

export const CMS_PREFIX = '/api/v1';

export function cmsBrowserBase(): string {
  return process.env.NEXT_PUBLIC_CMS_API_URL || CMS_PREFIX;
}

export function cmsServerBase(): string {
  return process.env.CMS_API_INTERNAL_URL || `http://127.0.0.1:3001${CMS_PREFIX}`;
}

export function cmsBase(): string {
  return typeof window === 'undefined' ? cmsServerBase() : cmsBrowserBase();
}

export interface CmsListMeta {
  page?: number;
  limit?: number;
  total?: number;
  pageCount?: number;
}

export class CmsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'CmsError';
  }
}

type CmsEnvelope<T> = { success?: boolean; data?: T; message?: string; statusCode?: number };

function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'success' in (json as object)) {
    const env = json as CmsEnvelope<T>;
    return env.data as T;
  }
  return json as T;
}

export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export interface CmsRequestOptions extends Omit<RequestInit, 'body'> {
  token?: string | null;
  json?: unknown;
  timeoutMs?: number;
}

export async function cmsFetch<T = unknown>(path: string, options: CmsRequestOptions = {}): Promise<T> {
  const { token, json, timeoutMs = 2500, headers, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${cmsBase()}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
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
      const raw = parsed && typeof parsed === 'object' && 'message' in parsed
        ? (parsed as { message: unknown }).message
        : '';
      const message = Array.isArray(raw) ? raw.join(' · ') : String(raw || '') || `CMS ${res.status}`;
      throw new CmsError(message, res.status, parsed);
    }

    return unwrap<T>(parsed);
  } finally {
    clearTimeout(timer);
  }
}

export async function cmsPublicList<T>(
  resource: string,
  locale?: string,
  extra: Record<string, string> = {},
): Promise<T[]> {
  const params = new URLSearchParams({
    view: 'block',
    limit: '100',
    ...(locale ? { locale } : {}),
    ...extra,
  });
  try {
    const payload = await cmsFetch<unknown>(`/public/${resource}?${params.toString()}`);
    return unwrapList<T>(payload);
  } catch {
    return [];
  }
}

export async function cmsPublicOne<T>(resource: string, idOrSlug: string, locale?: string): Promise<T | null> {
  const params = new URLSearchParams(locale ? { locale } : {});
  const qs = params.toString();
  try {
    return await cmsFetch<T>(`/public/${resource}/${encodeURIComponent(idOrSlug)}${qs ? `?${qs}` : ''}`);
  } catch {
    return null;
  }
}
