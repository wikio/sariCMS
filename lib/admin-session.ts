/** Clés localStorage de la session admin JWT (plus de mot de passe en dur). */

export const ADMIN_ACCESS_KEY = 'sari_admin_access';
export const ADMIN_REFRESH_KEY = 'sari_admin_refresh';
export const ADMIN_USER_KEY = 'sari_admin_user';

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

export function readAdminAccess(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_ACCESS_KEY);
}

export function readAdminUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function persistAdminSession(session: {
  accessToken: string;
  refreshToken?: string;
  user?: AdminUser;
}): void {
  localStorage.setItem(ADMIN_ACCESS_KEY, session.accessToken);
  if (session.refreshToken) localStorage.setItem(ADMIN_REFRESH_KEY, session.refreshToken);
  if (session.user) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(session.user));
  // compat anciens écrans qui testent encore ce flag
  localStorage.setItem('sari_admin_auth', 'true');
  localStorage.setItem('sari_admin_time', Date.now().toString());
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_ACCESS_KEY);
  localStorage.removeItem(ADMIN_REFRESH_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  localStorage.removeItem('sari_admin_auth');
  localStorage.removeItem('sari_admin_time');
}

export function hasAdminSession(): boolean {
  return Boolean(readAdminAccess() || (typeof window !== 'undefined' && localStorage.getItem('sari_admin_auth') === 'true'));
}

/**
 * Seul le type `admin` a sa place dans le back-office.
 *
 * `/auth/login` est le même point d'entrée pour tous les types de comptes :
 * un client qui saisissait ses identifiants sur /admin obtenait une session
 * valide, car la garde ne vérifiait que la présence d'un token, jamais le
 * type. Cette fonction est le point de contrôle unique.
 */
export function isAdminUser(user: AdminUser | null): boolean {
  return user?.type === 'admin';
}

/** Session présente ET rattachée à un compte administrateur. */
export function hasAdminAccess(): boolean {
  return hasAdminSession() && isAdminUser(readAdminUser());
}

/**
 * L'espace client/partenaire/candidat n'est pas destiné aux administrateurs :
 * ils disposent du back-office. Sert de garde côté /dashboard.
 */
export function isBackOfficeUser(type?: string | null): boolean {
  return type === 'admin';
}
