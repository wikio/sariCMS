/** Session serveur du back-office. Seule l'API Nest authentifie et renouvelle les jetons. */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch, CmsError } from './cms';
import type { AdminUser } from './admin-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ACCESS = 'sari_admin_access';
const REFRESH = 'sari_admin_refresh';

export function getAccessToken(req: NextRequest) { return req.cookies.get(ACCESS)?.value; }
/** Les clients historiques de la passerelle CMS peuvent encore utiliser leur Bearer Nest. */
export function getCmsAccessToken(req: NextRequest) {
  return getAccessToken(req) || /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
}
export function getRefreshToken(req: NextRequest) { return req.cookies.get(REFRESH)?.value; }

function requireAdmin(user?: AdminUser): AdminUser {
  if (!user?.id || !user.email) throw new CmsError('Session incomplète', 502);
  if (user.type !== 'admin') throw new CmsError('Compte administrateur requis', 403);
  return user;
}

export async function adminIdentity(token?: string): Promise<AdminUser> {
  if (!token) throw new CmsError('Non authentifié', 401);
  return requireAdmin(await cmsFetch<AdminUser>('/auth/me', { token, timeoutMs: 4000 }));
}

export interface BackendSession {
  requires2fa?: boolean;
  challengeToken?: string;
  user?: AdminUser;
  accessToken?: string;
  refreshToken?: string;
}

export function sessionResponse(session: BackendSession): NextResponse {
  const user = requireAdmin(session?.user);
  if (!session.accessToken || !session.refreshToken) throw new CmsError('Session incomplète', 502);
  const response = NextResponse.json({ ok: true, user }, { headers: NO_STORE });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' } as const;
  response.cookies.set(ACCESS, session.accessToken, { ...options, maxAge: 15 * 60 });
  response.cookies.set(REFRESH, session.refreshToken, { ...options, maxAge: 30 * 86400 });
  return response;
}

export function clearAuthCookies(response: NextResponse): void {
  for (const name of [ACCESS, REFRESH, 'sari_admin_user']) response.cookies.delete(name);
}

export function authStatus(error: unknown) {
  return error instanceof CmsError ? error.status : 503;
}

export function authError(error: unknown) {
  const status = authStatus(error);
  return NextResponse.json({ error: status < 500 && error instanceof Error ? error.message : 'Service d’authentification indisponible' }, { status, headers: NO_STORE });
}
