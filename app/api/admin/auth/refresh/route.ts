import { NextRequest } from 'next/server';
import { CmsError, cmsFetch } from '@/lib/cms';
import { authError, clearAuthCookies, getRefreshToken, sessionResponse, type BackendSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) throw new CmsError('Refresh token manquant', 401);
    const session = await cmsFetch<BackendSession>('/auth/refresh', {
      method: 'POST', json: { refreshToken }, timeoutMs: 5000,
    });
    return sessionResponse(session);
  } catch (error) {
    const response = authError(error);
    // En cas de panne temporaire garder le refresh : l'utilisateur pourra réessayer.
    if ([401, 403].includes(response.status)) clearAuthCookies(response);
    return response;
  }
}
