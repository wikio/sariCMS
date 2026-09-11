/**
 * /api/contact/verify-captcha — vérification du captcha de contact.
 *
 * Reçoit `{captchaId, captchaAnswer}` et répond `{ok: boolean}`.
 * Le code est à usage unique : après vérification (réussie ou non), il est brûlé.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptcha, rateLimited } from '@/lib/contact-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'inconnu';
}

export async function POST(req: NextRequest) {
  // Rate limiting spécifique vérification
  if (rateLimited(`contact-verify:${clientIp(req)}`, 20, 5 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: 'Trop de tentatives de vérification' },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'JSON attendu' }, { status: 400 });

  const captchaId = String(body.captchaId || '');
  const captchaAnswer = String(body.captchaAnswer || '');

  if (!captchaId || !captchaAnswer) {
    return NextResponse.json({ ok: false, error: 'Champs manquants' }, { status: 400 });
  }

  const ok = verifyCaptcha(captchaId, captchaAnswer);
  return NextResponse.json({ ok });
}