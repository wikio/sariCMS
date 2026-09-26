/**
 * lib/admin-auth.ts — Gestion de session admin côté serveur avec cookies httpOnly.
 *
 * Remplace l'ancien système localStorage par des cookies sécurisés :
 * - Access token : cookie httpOnly, secure, SameSite=Strict, courte durée (15 min)
 * - Refresh token : cookie httpOnly, secure, SameSite=Strict, longue durée (30 jours)
 * - User info : cookie non httpOnly (lisible par le client pour l'affichage), SameSite=Strict
 *
 * Le middleware valide l'access token, le refresh se fait via /api/admin/auth/refresh.
 */
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify, decodeJwt } from 'jose';

// En production le backend Nest signe les JWT avec JWT_ACCESS_SECRET,
// le front Next signe ses fallback avec ADMIN_JWT_SECRET. Après le correctif
// initial ces deux secrets étaient différents (frontend: dev-secret..., backend:
// change-me-access-secret...), donc verifyAccessToken échouait systématiquement
// pour les tokens émis par le backend => /me renvoyait 401 => boucle login.
// On essaie tous les secrets connus, et on supporte la forme backend
// { sub, email, typ } ainsi que la forme front { sub, email, type, permissions }.
function getJwtSecrets(): Uint8Array[] {
  const candidates = [
    process.env.ADMIN_JWT_SECRET,
    process.env.JWT_ACCESS_SECRET,
    // fallback dev commun aux deux côtés
    'dev-secret-change-in-production-min-32-chars!!',
    'change-me-access-secret-min-32-chars-please',
  ].filter(Boolean) as string[];
  // dédupliquer
  const uniq = [...new Set(candidates)];
  return uniq.map(s => new TextEncoder().encode(s));
}

const PRIMARY_JWT_SECRET = getJwtSecrets()[0];

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';

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

interface AccessTokenPayload {
  sub: string;
  email: string;
  type: string;
  permissions: string[];
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

const ACCESS_COOKIE = 'sari_admin_access';
const REFRESH_COOKIE = 'sari_admin_refresh';
const USER_COOKIE = 'sari_admin_user';

export async function createAccessToken(user: AdminUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    type: user.type || 'admin',
    permissions: user.permissions || [],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(PRIMARY_JWT_SECRET);
}

export async function createRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(PRIMARY_JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  // Essayer chaque secret connu (ADMIN_JWT_SECRET, JWT_ACCESS_SECRET, fallbacks)
  for (const secret of getJwtSecrets()) {
    try {
      const { payload } = await jwtVerify(token, secret);
      // Normaliser la forme backend { typ: 'access' } vers { type: 'admin' }
      const p = payload as unknown as Record<string, unknown>;
      if (p.typ && !p.type) p.type = p.typ === 'access' ? 'admin' : String(p.typ);
      // Permissions absentes côté backend : on les laisse vides, /me les
      // reconstituera via le cookie ou un appel backend.
      return payload as unknown as AccessTokenPayload;
    } catch {
      // essayer le secret suivant
    }
  }
  // Dernier recours : décodage sans vérification pour diagnostiquer
  // (ne JAMAIS faire confiance à ce payload pour autoriser, seulement pour log)
  try {
    const decoded = decodeJwt(token) as unknown as Record<string, unknown>;
    if (decoded && decoded.sub && decoded.exp && (decoded.exp as number) * 1000 > Date.now()) {
      // token expiré ou secret inconnu — on retourne null pour forcer proxy backend
    }
  } catch {}
  return null;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  // Les refresh tokens backend sont des chaînes opaques hex (randomBytes 48 → hex),
  // pas des JWT. Ils échoueront toujours ici — c'est normal, le caller doit
  // proxifier vers le backend. On garde la vérif JWT pour les refresh JWT
  // générés en fallback dev.
  for (const secret of getJwtSecrets()) {
    try {
      const { payload } = await jwtVerify(token, secret);
      return payload as unknown as RefreshTokenPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export function decodeAccessTokenUnsafe(token: string): Record<string, unknown> | null {
  try {
    return decodeJwt(token) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string, user: AdminUser): void {
  // Access token - httpOnly, courte durée
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });

  // Refresh token - httpOnly, longue durée
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });

  // User info - non httpOnly pour lecture côté client (affichage nom/email)
  response.cookies.set(USER_COOKIE, JSON.stringify({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    type: user.type,
    role: user.role,
    permissions: user.permissions,
  }), {
    httpOnly: false, // Lisible par JS pour l'UI
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(USER_COOKIE);
}

export function getAccessToken(req: NextRequest): string | null {
  return req.cookies.get(ACCESS_COOKIE)?.value || null;
}

export function getRefreshToken(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value || null;
}

export function getUserFromCookie(req: NextRequest): AdminUser | null {
  const cookie = req.cookies.get(USER_COOKIE)?.value;
  if (!cookie) return null;
  try {
    return JSON.parse(cookie) as AdminUser;
  } catch {
    return null;
  }
}

export function isAdminUser(user: AdminUser | null): boolean {
  return user?.type === 'admin';
}

export function hasAdminAccess(req: NextRequest): boolean {
  const token = getAccessToken(req);
  if (!token) return false;
  // La validation complète se fait via verifyAccessToken si nécessaire
  return true; // Le middleware fera la vérification réelle
}