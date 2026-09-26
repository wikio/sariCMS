/**
 * /api/admin/auth/login — Connexion admin.
 *
 * Valide les identifiants contre le backend (ou fallback local),
 * émet access + refresh tokens dans des cookies httpOnly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { createAccessToken, createRefreshToken, setAuthCookies, AdminUser } from '@/lib/admin-auth';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[API admin/auth/login]', ...args);
const logError = (...args: unknown[]) => DEBUG && console.error('[API admin/auth/login ERROR]', ...args);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  log('Request received');
  const body = await req.json().catch(() => null) as {
    email?: string; password?: string; totpCode?: string; challengeToken?: string; code?: string;
  } | null;
  log('Body:', { ...body, password: body?.password ? '***' : undefined });
  let user: AdminUser | null = null;
  if (body?.challengeToken) {
    try {
      const challenge = await cmsFetch<{ accessToken?: string; refreshToken?: string; user?: AdminUser; requires2fa?: boolean; challengeToken?: string } & Record<string, unknown>>('/auth/2fa/challenge', {
        method: 'POST',
        json: { challengeToken: body.challengeToken, code: body.code || body.totpCode },
        timeoutMs: 10000,
      });
      if (challenge?.requires2fa || !challenge?.user) return NextResponse.json(challenge);
      user = (challenge as { user: AdminUser }).user;
      const accessToken = (challenge as { accessToken?: string }).accessToken || await createAccessToken(user);
      const refreshToken = (challenge as { refreshToken?: string }).refreshToken || await createRefreshToken(user.id);
      const response = NextResponse.json({ ok: true, user });
      setAuthCookies(response, accessToken, refreshToken, user);
      log('Login success (2fa), cookies set');
      return response;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      return NextResponse.json(
        { error: err.message || 'Code 2FA invalide', code: 'INVALID_2FA' },
        { status: err.status === 401 ? 401 : 400 }
      );
    }
  }
  if (!body?.email || !body?.password) {
    logError('Missing credentials');
    return NextResponse.json({ error: 'Email et mot de passe requis', code: 'CREDENTIALS_MISSING' }, { status: 400 });
  }

  try {
    log('Calling backend cmsFetch /auth/login');
    const authResult = await cmsFetch<{ accessToken?: string; refreshToken?: string; user?: AdminUser; requires2fa?: boolean; challengeToken?: string } & Record<string, unknown>>('/auth/login', {
      method: 'POST',
      json: { email: body.email, password: body.password, ...(body.totpCode ? { totpCode: body.totpCode } : {}) },
      timeoutMs: 10000,
    });
    log('Backend auth result keys:', authResult ? Object.keys(authResult) : null);
    if (authResult?.requires2fa) {
      return NextResponse.json({ requires2fa: true, challengeToken: authResult.challengeToken });
    }
    user = authResult.user || null;
    if (!user) {
      return NextResponse.json({ error: 'Identifiants invalides', code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }
    const accessToken = authResult.accessToken || await createAccessToken(user);
    const refreshToken = authResult.refreshToken || await createRefreshToken(user.id);

    const response = NextResponse.json({ ok: true, user });
    setAuthCookies(response, accessToken, refreshToken, user);
    log('Login success, cookies set');
    return response;
  } catch (error: unknown) {
    logError('Backend auth failed:', error);
    // Fallback : vérification locale basique (développement uniquement)
    if (process.env.NODE_ENV === 'development' && body.email === 'admin@sari.local' && body.password === 'admin123456') {
      log('Using dev fallback');
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
      log('Dev fallback login success');
      return response;
    }

    const err = error as { status?: number; message?: string };
    logError('Login failed:', err);
    return NextResponse.json(
      { error: err.message || 'Identifiants invalides', code: 'INVALID_CREDENTIALS' },
      { status: err.status === 401 ? 401 : 400 }
    );
  }
}