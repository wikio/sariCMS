/**
 * /api/admin/auth/verify-captcha — vérification du captcha admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptcha, rateLimited } from '@/lib/admin-captcha';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[API admin/auth/verify-captcha]', ...args);
const logError = (...args: unknown[]) => DEBUG && console.error('[API admin/auth/verify-captcha ERROR]', ...args);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'inconnu';
}

export async function POST(req: NextRequest) {
  log('Request received');
  if (rateLimited(`admin-verify:${clientIp(req)}`, 20, 5 * 60 * 1000)) {
    logError('Rate limited');
    return NextResponse.json(
      { ok: false, error: 'Trop de tentatives de vérification' },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  log('Body:', body);
  if (!body) return NextResponse.json({ ok: false, error: 'JSON attendu' }, { status: 400 });

  const captchaId = String(body.captchaId || '');
  const captchaAnswer = String(body.captchaAnswer || '');
  log('Verifying:', { captchaId, captchaAnswer });

  if (!captchaId || !captchaAnswer) {
    return NextResponse.json({ ok: false, error: 'Champs manquants' }, { status: 400 });
  }

  const ok = verifyCaptcha(captchaId, captchaAnswer);
  log('Verify result:', ok);
  return NextResponse.json({ ok });
}