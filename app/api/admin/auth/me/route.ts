/**
 * /api/admin/auth/me — Récupération de l'utilisateur connecté.
 *
 * Valide l'access token et retourne les infos user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, verifyAccessToken, getUserFromCookie } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const accessToken = getAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Non authentifié', code: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    return NextResponse.json({ error: 'Token invalide ou expiré', code: 'INVALID_TOKEN' }, { status: 401 });
  }

  // Compléter avec les infos du cookie user (non sensible, pour l'affichage)
  const userCookie = getUserFromCookie(req);

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