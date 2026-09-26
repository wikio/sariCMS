'use client';

import { useEffect } from 'react';

const CSRF_COOKIE = 'sari_csrf';
const CSRF_HEADER = 'x-csrf-token';

function getCsrfFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

// Singleton : même promesse partagée pendant le fetch du token
let tokenPromise: Promise<string | null> | null = null;

async function fetchCsrfToken(origFetch: typeof fetch): Promise<string | null> {
  const fromCookie = getCsrfFromCookie();
  if (fromCookie) return fromCookie;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    try {
      const r = await origFetch('/api/csrf-token', { credentials: 'same-origin' });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        const tok = (j as { csrfToken?: string } | null)?.csrfToken;
        if (tok) return tok;
        // Cookie peut avoir été posé malgré JSON vide
        return getCsrfFromCookie();
      }
    } catch {}
    return null;
  })();
  try {
    const t = await tokenPromise;
    return t;
  } finally {
    tokenPromise = null;
  }
}

let patched = false;

export function ensureCsrfFetchPatched(): void {
  if (typeof window === 'undefined') return;
  // Éviter le double patch (HMR / navigation)
  const w = window as unknown as { __sariCsrfPatched?: boolean; fetch: typeof fetch };
  if (patched || w.__sariCsrfPatched) return;
  w.__sariCsrfPatched = true;
  patched = true;

  const origFetch = w.fetch.bind(window);

  const EXEMPT = [
    '/api/admin/auth/captcha',
    '/api/admin/auth/verify-captcha',
    '/api/admin/auth/login',
    '/api/admin/auth/logout',
    '/api/admin/auth/refresh',
    '/api/csrf-token',
  ];
  const shouldAddCsrf = (url: string, method: string): boolean => {
    const m = method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return false;
    // Le middleware applique la protection uniquement sur /api/admin (isAdminApiRoute)
    // On borne le patch à ce préfixe pour ne pas toucher les autres API.
    if (!url.includes('/api/admin')) return false;
    if (EXEMPT.some((p) => url.includes(p))) return false;
    return true;
  };

  w.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      let urlStr = '';
      let method = 'GET';
      let headersSource: Headers | undefined;

      if (typeof input === 'string') {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.toString();
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        urlStr = input.url;
        method = input.method || method;
        headersSource = input.headers as unknown as Headers;
      }

      if (init?.method) method = init.method;

      if (urlStr && shouldAddCsrf(urlStr, method)) {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        // Si l'appel est un Request, fusionner ses headers s'ils n'ont pas déjà été fournis via init
        if (!init?.headers && headersSource) {
          headersSource.forEach((v, k) => {
            if (!headers.has(k)) headers.set(k, v);
          });
        }
        const hasHeader = headers.has(CSRF_HEADER) || headers.has(CSRF_HEADER.toUpperCase()) || headers.has('X-CSRF-Token');
        if (!hasHeader) {
          let token = getCsrfFromCookie();
          if (!token) token = await fetchCsrfToken(origFetch);
          if (token) {
            headers.set(CSRF_HEADER, token);
            // Cas Request sans init : créer un nouveau Request pour porter le header
            if (typeof Request !== 'undefined' && input instanceof Request && !init) {
              const newReq = new Request(input, { headers });
              return origFetch(newReq);
            }
            init = { ...(init || {}), headers, credentials: init?.credentials || 'same-origin' };
          }
        }
      }
    } catch {
      // En cas d'erreur du patch, tomber sur le fetch original sans bloquer
    }
    return origFetch(input as never, init);
  };
}

// Patch synchrone au chargement du module : avant le premier fetch admin
if (typeof window !== 'undefined') {
  try {
    ensureCsrfFetchPatched();
  } catch {}
}

export default function CsrfPatch(): null {
  useEffect(() => {
    ensureCsrfFetchPatched();
    // Pré-chauffe le cookie (fetch GET ne requiert pas de CSRF mais pose le cookie)
    // pour que les PUT suivants trouvent sari_csrf dans document.cookie sans latence.
    const tok = getCsrfFromCookie();
    if (!tok) {
      fetch('/api/csrf-token', { credentials: 'same-origin' }).catch(() => {});
    }
  }, []);
  return null;
}
