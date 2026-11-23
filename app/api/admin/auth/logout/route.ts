/**
 * /api/admin/auth/logout — Déconnexion admin.
 *
 * Supprime les cookies d'authentification.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { clearAuthCookies, getRefreshToken } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const refreshToken = getRefreshToken(req);
  if (refreshToken) await cmsFetch('/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => {});
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}