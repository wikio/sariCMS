// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cmsFetch, CmsError } from '@/lib/cms';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  type: 'client' | 'partner' | 'candidate' | 'admin';
  phone?: string;
  company?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, type?: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = 'sari_user';
const USERS_REGISTRY_KEY = 'sari_users_registry';

/** Registre local des comptes créés via l'inscription (fallback hors-ligne). */
function readRegistry(): Array<User & { password: string }> {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_REGISTRY_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeRegistry(users: Array<User & { password: string }>) {
  localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
  }, []);

  const persist = (u: User) => {
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const refreshUser = () => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) { try { setUser(JSON.parse(stored)); } catch { /* */ } }
  };

  /** Authentification : backend JWT d'abord, sinon fallback démo/local. */
  const login = async (email: string, password: string, type?: string): Promise<boolean> => {
    const normalized = email.trim().toLowerCase();

    // 1. Backend (Nest) — /auth/login
    try {
      const res = await cmsFetch<{ accessToken?: string; user?: Record<string, unknown>; requires2fa?: boolean }>(
        '/auth/login',
        { method: 'POST', json: { email: normalized, password }, timeoutMs: 8000 },
      );
      if (res?.accessToken && res.user) {
        const u = res.user as Record<string, unknown>;
        persist({
          id: String(u.id ?? ''),
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || String(u.email),
          firstName: String(u.firstName ?? ''),
          lastName: String(u.lastName ?? ''),
          email: String(u.email),
          type: (u.type as User['type']) || (type as User['type']) || 'client',
          phone: u.phone ? String(u.phone) : undefined,
          company: u.company ? String(u.company) : undefined,
        });
        return true;
      }
    } catch {
      // API hors-ligne → fallback local
    }

    // 2. Comptes de démo (dev)
    const demoUsers: Record<string, User & { password: string }> = {
      'client@sari.dz': { id: '1', name: 'Client Demo', email: 'client@sari.dz', type: 'client', password: 'demo123' },
      'partner@sari.dz': { id: '2', name: 'Partner Demo', email: 'partner@sari.dz', type: 'partner', password: 'demo123' },
      'candidate@sari.dz': { id: '3', name: 'Candidate Demo', email: 'candidate@sari.dz', type: 'candidate', password: 'demo123' },
    };
    const demo = demoUsers[normalized];
    if (demo && demo.password === password) {
      const { password: _pw, ...safe } = demo;
      persist(safe);
      return true;
    }

    // 3. Comptes inscrits localement
    const registry = readRegistry();
    const found = registry.find((u) => u.email.toLowerCase() === normalized);
    if (found && found.password === password) {
      const { password: _pw, ...safe } = found;
      persist(safe);
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
  };

  /** Inscription : backend /users d'abord, sinon registre local. */
  const register = async (userData: Partial<User> & { password: string }): Promise<boolean> => {
    const email = String(userData.email ?? '');
    const fullName = userData.name || [userData.firstName, userData.lastName].filter(Boolean).join(' ');
    const [firstName = '', lastName = ''] = (userData.name || '').split(' ');
    const newUser: User = {
      id: userData.id || Date.now().toString(),
      name: fullName || email,
      firstName: userData.firstName || firstName,
      lastName: userData.lastName || lastName || fullName,
      email,
      type: userData.type || 'client',
      phone: userData.phone,
      company: userData.company,
    };

    // Backend : POST /users (nécessite un mot de passe fort côté Nest).
    try {
      await cmsFetch('/users', {
        method: 'POST',
        json: {
          email: userData.email,
          password: userData.password,
          firstName: newUser.firstName || name,
          lastName: newUser.lastName || '',
          type: newUser.type,
          phone: newUser.phone,
          company: newUser.company,
          locale: 'fr',
        },
        timeoutMs: 12000,
      });
    } catch {
      // API hors-ligne ou validations Nest → on continue en local.
    }

    // Registre local (fallback + persistance multi-comptes).
    const registry = readRegistry();
    const existingIdx = registry.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingIdx >= 0) registry[existingIdx] = { ...newUser, password: userData.password };
    else registry.push({ ...newUser, password: userData.password });
    writeRegistry(registry);

    persist(newUser);
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
