'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[useAdminAuth]', ...args);
const logError = (...args: unknown[]) => DEBUG && console.error('[useAdminAuth ERROR]', ...args);

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  type?: string;
  role?: string;
  permissions?: string[];
  totpEnabled?: boolean;
}

let cachedUser: AdminUser | null = null;
let authCheckPromise: Promise<AdminUser | null> | null = null;

export function useAdminAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [user, setUser] = useState<AdminUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [isLoginPage, setIsLoginPage] = useState(false);

  useEffect(() => {
    const isLogin = pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`;
    log('Pathname changed:', { pathname, isLogin });
    setIsLoginPage(isLogin);
  }, [pathname, locale]);

  useEffect(() => {
    if (isLoginPage) {
      log('Login page, skipping auth check');
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      log('Checking auth, cachedUser:', cachedUser);
      if (cachedUser) {
        log('Using cached user');
        setUser(cachedUser);
        setLoading(false);
        return;
      }

      if (authCheckPromise) {
        log('Waiting for existing auth check');
        const user = await authCheckPromise;
        setUser(user);
        cachedUser = user;
        setLoading(false);
        return;
      }

      authCheckPromise = (async () => {
        try {
          log('Fetching /api/admin/auth/me');
          let res = await fetch('/api/admin/auth/me', { credentials: 'same-origin', cache: 'no-store' });
          log('Auth check response:', res.status);
          if (res.status === 401) {
            // Access token expiré ? Tenter un refresh silencieux via cookie httpOnly
            log('401 -> attempting refresh');
            try {
              const refreshRes = await fetch('/api/admin/auth/refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
              log('Refresh response:', refreshRes.status);
              if (refreshRes.ok) {
                // Réessayer /me après refresh
                res = await fetch('/api/admin/auth/me', { credentials: 'same-origin', cache: 'no-store' });
                log('Retry me after refresh:', res.status);
              }
            } catch (e) {
              logError('Refresh attempt failed', e);
            }
          }
          if (res.ok) {
            const data = await res.json();
            log('Auth check data:', data);
            return data.user || null;
          }
        } catch (err) {
          logError('Auth check fetch error:', err);
        }
        return null;
      })();

      const user = await authCheckPromise;
      log('Auth check result:', user);
      setUser(user);
      cachedUser = user;
      // Ne pas garder en cache un échec : après un login réussi, le prochain
      // contrôle doit refaire un appel /me au lieu de rejouer le 401 précédent.
      if (!user) authCheckPromise = null;
      setLoading(false);
    };

    checkAuth();
  }, [isLoginPage, locale, pathname]);

  const logout = async () => {
    log('Logging out');
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (err) {
      logError('Logout error:', err);
    }
    cachedUser = null;
    authCheckPromise = null;
    setUser(null);
    router.push(`/${locale}`);
  };

  const refreshUser = async () => {
    log('Refreshing user');
    cachedUser = null;
    authCheckPromise = null;
    setLoading(true);
    const res = await fetch('/api/admin/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const user = data.user || null;
      cachedUser = user;
      setUser(user);
    } else {
      logError('Refresh failed:', res.status);
      setUser(null);
      cachedUser = null;
    }
    setLoading(false);
  };

  return { user, loading, logout, refreshUser, isLoginPage };
}

export function clearAuthCache() {
  log('Clearing auth cache');
  cachedUser = null;
  authCheckPromise = null;
}

/**
 * Amorce le cache avec un utilisateur dont l'identité vient d'être vérifiée.
 *
 * La page de connexion connaît déjà l'administrateur (la route
 * `/api/admin/auth/login` répond `{ ok: true, user }`). Elle vidait pourtant le
 * cache avant de naviguer, ce qui forçait le tableau de bord à refaire un
 * aller-retour `/api/admin/auth/me` — parfois suivi d'un refresh — avant
 * d'afficher quoi que ce soit. En amorçant le cache, l'écran d'accueil se rend
 * immédiatement.
 */
export function setAuthCache(user: AdminUser) {
  log('Seeding auth cache');
  cachedUser = user;
  authCheckPromise = null;
}