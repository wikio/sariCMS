'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

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
    setIsLoginPage(isLogin);
  }, [pathname, locale]);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
        return;
      }

      if (authCheckPromise) {
        const user = await authCheckPromise;
        setUser(user);
        cachedUser = user;
        setLoading(false);
        return;
      }

      authCheckPromise = (async () => {
        try {
          const res = await fetch('/api/admin/auth/me', { credentials: 'same-origin', cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            return data.user || null;
          }
        } catch {
          // ignore
        }
        return null;
      })();

      const user = await authCheckPromise;
      setUser(user);
      cachedUser = user;
      setLoading(false);
    };

    checkAuth();
  }, [isLoginPage, locale, pathname]);

  const logout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // ignore
    }
    cachedUser = null;
    authCheckPromise = null;
    setUser(null);
    router.push(`/${locale}`);
  };

  const refreshUser = async () => {
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
      setUser(null);
      cachedUser = null;
    }
    setLoading(false);
  };

  return { user, loading, logout, refreshUser, isLoginPage };
}

export function clearAuthCache() {
  cachedUser = null;
  authCheckPromise = null;
}