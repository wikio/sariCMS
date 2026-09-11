/**
 * /api/admin/auth/login — Connexion admin.
 *
 * Valide les identifiants contre le backend (ou fallback local),
 * émet access + refresh tokens dans des cookies httpOnly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { createAccessToken, createRefreshToken, setAuthCookies, AdminUser } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email et mot de passe requis', code: 'CREDENTIALS_MISSING' }, { status: 400 });
  }

  let user: AdminUser | null = null;

  try {
    // Tenter authentification via l'API backend
    const authResult = await cmsFetch<{ accessToken: string; refreshToken: string; user: AdminUser }>('/auth/login', {
      method: 'POST',
      json: { email: body.email, password: body.password },
      timeoutMs: 10000,
    });
    user = authResult.user;
    // Si le backend renvoie ses propres tokens, on les utilise
    const accessToken = authResult.accessToken || await createAccessToken(user);
    const refreshToken = authResult.refreshToken || await createRefreshToken(user.id);

    const response = NextResponse.json({ ok: true, user });
    setAuthCookies(response, accessToken, refreshToken, user);
    return response;
  } catch (error: unknown) {
    // Fallback : vérification locale basique (développement uniquement)
    if (process.env.NODE_ENV === 'development' && body.email === 'admin@sari.local' && body.password === 'admin123456') {
      user = {
        id: '1',
        email: 'admin@sari.local',
        firstName: 'Admin',
        lastName: 'SARI',
        type: 'admin',
        role: 'superadmin',
        permissions: ['*'],
      };
      const accessToken = await createAccessToken(user);
      const refreshToken = await createRefreshToken(user.id);

      const response = NextResponse.json({ ok: true, user, dev: true });
      setAuthCookies(response, accessToken, refreshToken, user);
      return response;
    }

    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || 'Identifiants invalides', code: 'INVALID_CREDENTIALS' },
      { status: err.status === 401 ? 401 : 400 }
    );
  }
}