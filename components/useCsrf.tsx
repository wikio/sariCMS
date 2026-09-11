'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'sari_csrf';

let csrfTokenCache: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

export function useCsrfToken(): string | null {
  const [token, setToken] = useState<string | null>(csrfTokenCache);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fetchToken = async () => {
      // D'abord essayer de lire depuis le cookie
      const cookieMatch = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE}=([^;]+)`));
      if (cookieMatch) {
        const cookieToken = decodeURIComponent(cookieMatch[2]);
        csrfTokenCache = cookieToken;
        setToken(cookieToken);
        return;
      }

      // Sinon récupérer via l'API
      if (!csrfTokenPromise) {
        csrfTokenPromise = fetch('/api/csrf-token', { credentials: 'same-origin' })
          .then(r => r.ok ? r.json() : null)
          .then(data => data?.csrfToken || '')
          .catch(() => '');
      }
      const apiToken = await csrfTokenPromise;
      if (apiToken) {
        csrfTokenCache = apiToken;
        setToken(apiToken);
      }
    };

    fetchToken();
  }, []);

  return token;
}

export function withCsrfToken(init: RequestInit = {}): RequestInit {
  const token = csrfTokenCache || getCsrfTokenFromCookie();
  if (!token) return init;

  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      [CSRF_HEADER]: token,
    },
    credentials: 'same-origin',
  };
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Wrapper autour de fetch qui ajoute automatiquement le token CSRF
 * pour les méthodes mutantes (POST, PUT, PATCH, DELETE).
 */
export async function csrfFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (needsCsrf) {
    const token = await ensureCsrfToken();
    if (token) {
      init = {
        ...init,
        headers: {
          ...(init.headers || {}),
          [CSRF_HEADER]: token,
        },
        credentials: 'same-origin',
      };
    }
  }

  return fetch(url, init);
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfTokenCache) return csrfTokenCache;

  // Lire depuis le cookie
  const cookieToken = getCsrfTokenFromCookie();
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }

  // Récupérer via l'API
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch('/api/csrf-token', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => data?.csrfToken || '')
      .catch(() => '');
  }
  const apiToken = await csrfTokenPromise;
  if (apiToken) csrfTokenCache = apiToken;
  return apiToken;
}

/**
 * Hook pour les formulaires - fournit une fonction pour ajouter le token
 * aux données de formulaire (hidden input) ou aux headers.
 */
export function useCsrfForm() {
  const token = useCsrfToken();

  const getCsrfHiddenInput = () => {
    if (!token) return null;
    return (
      <input type="hidden" name="csrf_token" value={token} />
    );
  };

  const getCsrfHeader = () => ({
    [CSRF_HEADER]: token || '',
  });

  return { token, getCsrfHiddenInput, getCsrfHeader };
}