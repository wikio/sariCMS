/**
 * /api/contact/captcha — émission et rendu du captcha anti-robot du formulaire de contact.
 *
 * - `GET /api/contact/captcha` : renvoie `{id, imageUrl, expiresIn}`.
 * - `GET /api/contact/captcha?id=…` : sert l'image `image/svg+xml` directement
 *   (la sous-route `/api/contact/captcha/image` reste conservée en alias).
 */
import { NextRequest, NextResponse } from 'next/server';
import { captchaImage, issueCaptcha } from '@/lib/contact-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (id !== null) {
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

  const issued = issueCaptcha();
  return NextResponse.json(
    {
      id: issued.id,
      imageUrl: issued.imageUrl,
      expiresIn: issued.expiresIn,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}