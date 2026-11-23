import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { authError, sessionResponse, type BackendSession } from '@/lib/admin-auth';
import { adminCaptchaRequired } from '@/lib/admin-login-policy';
import { verifyCaptcha } from '@/lib/admin-captcha';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    email?: string; password?: string; totpCode?: string; challengeToken?: string; code?: string;
    captchaId?: string; captchaAnswer?: string;
  } | null;
  if (!body?.challengeToken) {
    if (!body?.email || !body.password) {
      return NextResponse.json({ error: 'Email et mot de passe requis', code: 'CREDENTIALS_MISSING' }, { status: 400 });
    }
    if (body.captchaId || body.captchaAnswer) {
      if (!verifyCaptcha(String(body.captchaId || '').trim(), String(body.captchaAnswer || '').trim())) {
        return NextResponse.json({ error: 'Code captcha invalide ou expiré', code: 'CAPTCHA_INVALID' }, { status: 400 });
      }
    } else if (await adminCaptchaRequired()) {
      return NextResponse.json({ error: 'Captcha requis', code: 'CAPTCHA_REQUIRED' }, { status: 400 });
    }
  }
  try {
    const session = await cmsFetch<BackendSession>(body.challengeToken ? '/auth/2fa/challenge' : '/auth/login', {
      method: 'POST', timeoutMs: 10000,
      json: body.challengeToken ? { challengeToken: body.challengeToken, code: body.code || body.totpCode }
        : { email: body.email, password: body.password, totpCode: body.totpCode },
    });
    if (session?.requires2fa && session.challengeToken) {
      return NextResponse.json({ requires2fa: true, challengeToken: session.challengeToken }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const response = sessionResponse(session);
    setCsrfCookie(response, generateCsrfToken());
    return response;
  } catch (error) { return authError(error); }
}
