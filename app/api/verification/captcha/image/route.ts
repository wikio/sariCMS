/**
 * Image du captcha de vérification : `GET /api/verification/captcha/image?id=…`
 *
 * Copie de conduite sur celle de la newsletter : `image/svg+xml`, jamais de
 * cache (un code est lié à un jeton à usage unique), `nosniff`, et un rectangle
 * « expiré » en 410 quand l'identifiant ne vit plus — le formulaire remplace
 * alors de lui-même le captcha par une nouvelle émission.
 */
import { NextRequest, NextResponse } from 'next/server';
import { captchaImage } from '@/lib/newsletter-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  const svg = captchaImage(id);
  if (!svg) {
    return new NextResponse(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="68"><rect width="200" height="68" fill="#eef2f7"/><text x="16" y="40" font-family="sans-serif" font-size="13" fill="#64748b">Code expire</text></svg>',
      {
        status: 410,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
