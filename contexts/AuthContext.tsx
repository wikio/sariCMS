// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { cmsFetch, CmsError } from '@/lib/cms';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  email: string;
  type: 'client' | 'partner' | 'candidate' | 'admin';
  phone?: string;
  company?: string;
  avatar?: string;
  address?: string;
  country?: string;
  wilaya?: string;
  lastName?: string;
  position?: string;
  experience?: string;
  motivation?: string;
  cvUrl?: string;
  /**
   * Langue choisie par la personne dans son profil.
   *
   * Conservée à la connexion : sans elle, un compte réglé en arabe repartait
   * systématiquement sur la langue de la page de connexion.
   */
  locale?: string;
}

type Registration = Pick<User, 'name' | 'email' | 'type' | 'phone' | 'company' | 'locale'> & {
  password: string;
  captchaId?: string;
  captchaAnswer?: string;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  register: (data: Registration) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Jeton de la vitrine, distinct de la session du back-office. */
export const FRONT_TOKEN_KEY = 'sari_front_access';

export function frontToken(): string | null {
  try { return typeof window !== 'undefined' ? localStorage.getItem(FRONT_TOKEN_KEY) : null; }
  catch { return null; }
}

/** L'identité, le type et la langue viennent du compte associé au jeton, jamais du navigateur. */
async function fetchProfile(token: string): Promise<User | null> {
  const u = await cmsFetch<Record<string, unknown>>('/auth/me', { token, timeoutMs: 8000 });
  if (!u || (typeof u.id !== 'string' && typeof u.id !== 'number') || !String(u.id).trim() ||
      typeof u.email !== 'string' || !u.email.trim() ||
      (u.type !== 'client' && u.type !== 'partner' && u.type !== 'candidate' && u.type !== 'admin')) return null;
  return {
    id: String(u.id), email: u.email, type: u.type,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    firstName: String(u.firstName ?? ''), lastName: String(u.lastName ?? ''),
    phone: u.phone ? String(u.phone) : undefined,
    company: u.company ? String(u.company) : undefined,
    locale: u.locale ? String(u.locale) : undefined,
    address: u.address ? String(u.address) : undefined,
    country: u.country ? String(u.country) : undefined,
    wilaya: u.wilaya ? String(u.wilaya) : undefined,
    position: u.position ? String(u.position) : undefined,
    avatar: u.avatar ? String(u.avatar) : undefined,
  };
}

/** Créer le compte n'ouvre pas une session : seul le serveur d'authentification le peut. */
async function register(data: Registration): Promise<boolean> {
  try {
    const response = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.ok === true && !!body.result;
  } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Une réponse tardive ne doit pas rouvrir une session fermée ou remplacée dans un autre onglet.
  const revision = useRef(0);

  const refreshUser = useCallback(async () => {
    const request = ++revision.current;
    const token = frontToken();
    let profile: User | null = null;
    let rejected = false;
    if (token) {
      try {
        profile = await fetchProfile(token);
        rejected = !profile;
      } catch (err) {
        // Une panne réseau n'authentifie personne, mais permet un nouvel essai au rechargement.
        rejected = err instanceof CmsError && (err.status === 401 || err.status === 403);
      }
    }
    if (request !== revision.current || token !== frontToken()) return;
    if (rejected) localStorage.removeItem(FRONT_TOKEN_KEY);
    setUser(profile);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Migration des anciens postes. Ni le profil en cache ni l'ancien annuaire
    // (qui contenait des mots de passe) ne doivent servir à ouvrir une session.
    try {
      localStorage.removeItem('sari_user');
      localStorage.removeItem('sari_users_registry');
    } catch { /* Le stockage peut être désactivé. */ }
    const restore = () => {
      setUser(null);
      setIsLoading(true);
      void refreshUser();
    };
    restore();
    const onStorage = (event: StorageEvent) => {
      if (event.key === FRONT_TOKEN_KEY || event.key === null) restore();
    };
    window.addEventListener('storage', onStorage);
    return () => { ++revision.current; window.removeEventListener('storage', onStorage); };
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User | null> => {
    const request = ++revision.current;
    const previousToken = frontToken();
    try {
      const res = await cmsFetch<{ accessToken?: string; requires2fa?: boolean }>('/auth/login', {
        method: 'POST', json: { email: email.trim().toLowerCase(), password }, timeoutMs: 8000,
      });
      if (res?.requires2fa || !res?.accessToken) return null;
      const profile = await fetchProfile(res.accessToken);
      if (!profile || request !== revision.current || previousToken !== frontToken()) return null;
      localStorage.setItem(FRONT_TOKEN_KEY, res.accessToken);
      setUser(profile);
      return profile;
    } catch { return null; }
    finally { if (request === revision.current) setIsLoading(false); }
  };

  const logout = () => {
    ++revision.current;
    localStorage.removeItem(FRONT_TOKEN_KEY);
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
