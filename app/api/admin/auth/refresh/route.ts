/**
 * /api/admin/auth/refresh — Rafraîchissement du access token.
 *
 * Les refresh tokens backend sont opaques (hex 48 bytes stocké hashé en DB),
 * PAS des JWT. La vérification locale jwtVerify échouait donc toujours pour
 * les sessions backend => refresh impossible => déconnexion après 15 min.
 *
 * Stratégie :
 * 1) Essayer le backend POST /auth/refresh { refreshToken } (rotation côté serveur,
 *    source de vérité). Si succès, poser les nouveaux cookies depuis la réponse backend.
 * 2) Fallback : vérification JWT locale pour les tokens dev générés par Next.
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

  // 1) Proxy backend — gère les refresh opaques
  try {
    const refreshed = await cmsFetch<{ accessToken: string; refreshToken: string; user?: Record<string, unknown>; expiresIn?: string } & Record<string, unknown>>('/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
      timeoutMs: 5000,
    });
    if (refreshed?.accessToken && refreshed?.refreshToken) {
      const user = (refreshed.user || refreshed as unknown as Record<string, unknown>) as { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] };
      // Normaliser l'user pour le cookie
      const safeUser: { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] } = {
        id: String(user?.id || (refreshed as unknown as { sub?: string }).sub || ''),
        email: String(user?.email || ''),
        firstName: user?.firstName,
        lastName: user?.lastName,
        type: (user?.type as string) || 'admin',
        role: user?.role as string | undefined,
        permissions: (user?.permissions as string[] | undefined) || [],
      };
      if (!safeUser.id) {
        // Le backend a pu renvoyer directement { accessToken, refreshToken } sans user imbriqué
        // On récupère le user depuis le cookie existant
        const cookieRaw = req.cookies.get('sari_admin_user')?.value;
        if (cookieRaw) {
          try {
            const parsed = JSON.parse(cookieRaw);
            safeUser.id = String(parsed.id || '');
            safeUser.email = parsed.email || safeUser.email;
            safeUser.firstName = parsed.firstName;
            safeUser.lastName = parsed.lastName;
            safeUser.type = parsed.type || 'admin';
            safeUser.permissions = parsed.permissions || [];
          } catch {}
        }
      }
      const response = NextResponse.json({ ok: true });
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken, safeUser);
      return response;
    }
  } catch (e) {
    const err = e as { status?: number; message?: string };
    // 401 backend => refresh invalide, on supprime les cookies
    if (err?.status === 401) {
      const response = NextResponse.json({ error: 'Refresh token invalide ou expiré', code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }
    // Autre erreur (backend down) → fallback local
  }

  // 2) Fallback JWT local (tokens dev)
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    const response = NextResponse.json({ error: 'Refresh token invalide ou expiré', code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  let user: { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] } | null = null;

  // Essayer de rafraîchir les infos via backend /auth/me avec l'access token existant ?
  // Ici on n'a que le refresh JWT local, donc on lit le cookie user.
  const userCookie = req.cookies.get('sari_admin_user')?.value;
  if (userCookie) {
    try {
      user = JSON.parse(userCookie);
    } catch {
      // ignore
    }
  }

  if (!user || String(user.id) !== String(payload.sub)) {
    const response = NextResponse.json({ error: 'Session invalide', code: 'SESSION_MISMATCH' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const newAccessToken = await createAccessToken(user as { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] });
  const newRefreshToken = await createRefreshToken(user.id);

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, newAccessToken, newRefreshToken, user as { id: string; email: string; firstName?: string; lastName?: string; type?: string; role?: string; permissions?: string[] });
  return response;
}