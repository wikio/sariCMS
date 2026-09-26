/**
 * /api/admin/auth/refresh — Rafraîchissement du access token.
 *
 * Utilise le refresh token (cookie httpOnly) pour émettre un nouveau
 * access token. Le refresh token est roté (nouveau à chaque utilisation).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRefreshToken, verifyRefreshToken, createAccessToken, createRefreshToken, setAuthCookies, clearAuthCookies } from '@/lib/admin-auth';
import { cmsFetch } from '@/lib/cms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) {
    return NextResponse.json({ error: 'Refresh token manquant', code: 'NO_REFRESH_TOKEN' }, { status: 401 });
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    const response = NextResponse.json({ error: 'Refresh token invalide ou expiré', code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  // Récupérer les infos user à jour (depuis backend ou cookie)
  let user: { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] } | null = null;

  try {
    const freshUser = await cmsFetch<{ user: typeof user }>('/auth/me', {
      headers: { Authorization: `Bearer ${refreshToken}` }, // ou access token si dispo
      timeoutMs: 5000,
    });
    user = freshUser.user;
  } catch {
    // Fallback : lire depuis le cookie user
    const userCookie = req.cookies.get('sari_admin_user')?.value;
    if (userCookie) {
      try {
        user = JSON.parse(userCookie);
      } catch {
        // ignore
      }
    }
  }

  if (!user || user.id !== payload.sub) {
    const response = NextResponse.json({ error: 'Session invalide', code: 'SESSION_MISMATCH' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  // Émettre nouveaux tokens (rotation du refresh token)
  const newAccessToken = await createAccessToken(user as { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] });
  const newRefreshToken = await createRefreshToken(user.id);

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, newAccessToken, newRefreshToken, user as { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] });
  return response;
}