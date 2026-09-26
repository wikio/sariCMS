/**
 * /api/admin/auth/me — Récupération de l'utilisateur connecté.
 *
 * Stratégie hybride (corrige le bug post-audit) :
 * 1) Tente d'interroger le backend Nest via cmsFetch('/auth/me') avec le
 *    Bearer token. C'est la source de vérité : le backend possède le secret
 *    JWT_ACCESS_SECRET et la table users/refresh_tokens. Si le backend répond,
 *    on lui fait confiance même si la vérification JWT locale échoue (secrets
 *    différents en dev).
 * 2) Fallback : vérification JWT locale (ADMIN_JWT_SECRET / JWT_ACCESS_SECRET /
 *    dev defaults). Sert pour les tokens générés en fallback dev (admin@sari.local)
 *    et quand le backend est momentanément indisponible.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, verifyAccessToken, getUserFromCookie } from '@/lib/admin-auth';
import { cmsFetch } from '@/lib/cms';

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

  // 1) Essai backend (source de vérité)
  try {
    const backendUser = await cmsFetch<Record<string, unknown>>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 4000,
    });
    // cmsFetch déballe déjà { success, data } → on reçoit l'objet user
    const u = (backendUser as unknown as { user?: Record<string, unknown> })?.user || backendUser;
    if (u && (u as Record<string, unknown>).id) {
      const userCookie = getUserFromCookie(req);
      log('Backend me success', u);
      // Le backend renvoie déjà role/permissions/totpEnabled
      return NextResponse.json({
        ok: true,
        user: {
          // Valeurs backend prioritaires, cookie en complément affichage
          ...userCookie,
          ...(u as object),
        },
      });
    }
    // Certains backends renvoient directement l'user sans wrapper supplémentaire
    if (backendUser && typeof backendUser === 'object' && 'email' in backendUser) {
      const userCookie = getUserFromCookie(req);
      return NextResponse.json({
        ok: true,
        user: { ...userCookie, ...(backendUser as object) },
      });
    }
  } catch (e) {
    const err = e as { status?: number; message?: string };
    log('Backend /auth/me failed, fallback to local JWT', err?.status, err?.message);
    // Si 401 backend → token invalide, on tente quand même le fallback local
    // avant de renvoyer 401 définitif
  }

  // 2) Fallback vérification locale
  const payload = await verifyAccessToken(accessToken);
  log('Local token payload:', payload);
  if (!payload) {
    logError('Invalid or expired token (backend + local)');
    return NextResponse.json({ error: 'Token invalide ou expiré', code: 'INVALID_TOKEN' }, { status: 401 });
  }

  const userCookie = getUserFromCookie(req);
  log('User cookie:', userCookie);

  return NextResponse.json({
    ok: true,
    user: {
      ...userCookie,
      id: payload.sub || userCookie?.id,
      email: payload.email || userCookie?.email,
      type: (payload as unknown as { type?: string }).type || (userCookie?.type as string) || 'admin',
      permissions: (payload as unknown as { permissions?: string[] }).permissions || userCookie?.permissions || [],
    },
  });
}