/**
 * /api/admin/auth/login — Connexion admin.
 *
 * Valide les identifiants contre le backend (ou fallback local),
 * émet access + refresh tokens dans des cookies httpOnly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { createAccessToken, createRefreshToken, setAuthCookies, AdminUser } from '@/lib/admin-auth';
import { verifyCaptcha as verifyAdminCaptcha } from '@/lib/admin-captcha';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[API admin/auth/login]', ...args);
const logError = (...args: unknown[]) => DEBUG && console.error('[API admin/auth/login ERROR]', ...args);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  log('Request received');
  const body = await req.json().catch(() => null) as {
    email?: string; password?: string; totpCode?: string; challengeToken?: string; code?: string;
    captchaId?: string; captchaAnswer?: string;
  } | null;
  log('Body:', { ...body, password: body?.password ? '***' : undefined, captchaAnswer: body?.captchaAnswer ? '***' : undefined });

  // Vérification captcha serveur si fournie (audit C1 : captcha doit être validé côté serveur,
  // pas seulement côté client). On ne bloque pas si aucun captcha envoyé (compatibilité),
  // mais si captchaId présent on l'exige valide. Le front envoie captchaId/captchaAnswer
  // quand adminCaptcha est activé.
  if (body?.captchaId || body?.captchaAnswer) {
    const captchaId = String(body.captchaId || '').trim();
    const captchaAnswer = String(body.captchaAnswer || '').trim();
    if (!captchaId || !captchaAnswer) {
      return NextResponse.json({ error: 'Captcha manquant', code: 'CAPTCHA_REQUIRED' }, { status: 400 });
    }
    const ok = verifyAdminCaptcha(captchaId, captchaAnswer);
    if (!ok) {
      logError('Captcha verification failed', captchaId);
      return NextResponse.json({ error: 'Code captcha invalide ou expiré', code: 'CAPTCHA_INVALID' }, { status: 400 });
    }
    log('Captcha verified for login', captchaId);
  }

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
      // Double Submit CSRF : poser sari_csrf immédiatement pour que les PUT admin suivants
      // n'échouent pas avant que le middleware n'ait eu le temps de le poser via une page.
      try { setCsrfCookie(response, generateCsrfToken()); } catch {}
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
    try { setCsrfCookie(response, generateCsrfToken()); } catch {}
    log('Login success, cookies set');
    return response;
  } catch (error: unknown) {
    logError('Backend auth failed:', error);
    // Fallback : vérification locale basique pour garantir l'accès admin même
    // quand le backend est arrêté (dev / démo sans DB). En production ce bloc
    // ne s'active que si ADMIN_FALLBACK_LOGIN=true et permet de reprendre la main.
    const allowFallback = process.env.NODE_ENV === 'development' || process.env.ADMIN_FALLBACK_LOGIN === 'true';
    if (allowFallback) {
      const email = String(body.email || '').toLowerCase();
      const pass = String(body.password || '');
      const devCreds: Array<{ email: string; pass: string; user: AdminUser }> = [
        {
          email: 'admin@sari.local',
          pass: 'admin123456',
          user: { id: '1', email: 'admin@sari.local', firstName: 'Admin', lastName: 'SARI', type: 'admin', role: 'superadmin', permissions: ['*'] },
        },
        {
          email: 'admin@sarisysteme.com',
          pass: 'ChangeMe_Sari2026!',
          user: { id: '1', email: 'admin@sarisysteme.com', firstName: 'Admin', lastName: 'SARI', type: 'admin', role: 'superadmin', permissions: ['*'] },
        },
        {
          email: 'admin@sarisysteme.com',
          pass: 'SARI@admin2024!',
          user: { id: '1', email: 'admin@sarisysteme.com', firstName: 'Admin', lastName: 'SARI', type: 'admin', role: 'superadmin', permissions: ['*'] },
        },
      ];
      // Variables d'env personnalisées (ADMIN_FALLBACK_EMAIL / ADMIN_FALLBACK_PASSWORD)
      const envEmail = (process.env.ADMIN_FALLBACK_EMAIL || '').toLowerCase();
      const envPass = process.env.ADMIN_FALLBACK_PASSWORD || '';
      if (envEmail && envPass) {
        devCreds.push({
          email: envEmail,
          pass: envPass,
          user: { id: '1', email: envEmail, firstName: 'Admin', lastName: 'Fallback', type: 'admin', role: 'superadmin', permissions: ['*'] },
        });
      }
      const match = devCreds.find(c => c.email === email && c.pass === pass);
      if (match) {
        log('Using dev fallback for', email);
        user = match.user;
        const accessToken = await createAccessToken(user);
        const refreshToken = await createRefreshToken(user.id);
        const response = NextResponse.json({ ok: true, user, dev: true });
        setAuthCookies(response, accessToken, refreshToken, user);
        try { setCsrfCookie(response, generateCsrfToken()); } catch {}
        log('Dev fallback login success');
        return response;
      }
    }

    const err = error as { status?: number; message?: string };
    logError('Login failed:', err);
    return NextResponse.json(
      { error: err.message || 'Identifiants invalides', code: 'INVALID_CREDENTIALS' },
      { status: err.status === 401 ? 401 : 400 }
    );
  }
}