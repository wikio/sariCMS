/**
 * /api/admin/auth/me — Récupération de l'utilisateur connecté.
 *
 * Valide l'access token et retourne les infos user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, verifyAccessToken, getUserFromCookie } from '@/lib/admin-auth';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[API admin/auth/me]', ...args);
const logError = (...args: unknown[]) => DEBUG && console.error('[API admin/auth/me ERROR]', ...args);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  log('Request received');
  const accessToken = getAccessToken(req);
  log('Access token present:', !!accessToken);
  if (!accessToken) {
    logError('No access token');
    return NextResponse.json({ error: 'Non authentifié', code: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const payload = await verifyAccessToken(accessToken);
  log('Token payload:', payload);
  if (!payload) {
    logError('Invalid or expired token');
    return NextResponse.json({ error: 'Token invalide ou expiré', code: 'INVALID_TOKEN' }, { status: 401 });
  }

  // Compléter avec les infos du cookie user (non sensible, pour l'affichage)
  const userCookie = getUserFromCookie(req);
  log('User cookie:', userCookie);

  return NextResponse.json({
    ok: true,
    user: {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      permissions: payload.permissions,
      ...userCookie,
    },
  });
}