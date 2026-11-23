/**
 * /api/admin/auth/captcha — émission et rendu du captcha anti-robot de l'auth admin.
 *
 * - `GET /api/admin/auth/captcha` : émet un captcha `{ id, imageUrl, expiresIn }`.
 * - `GET /api/admin/auth/captcha?id=…` : sert l'image `image/svg+xml` directement
 *   depuis le même gestionnaire de route (évite tout 404 de sous-route imbriquée
 *   sous Turbopack/Windows et garantit le partage du registre en mémoire).
 *   La sous-route `/api/admin/auth/captcha/image?id=…` reste conservée en alias.
 */
import { NextRequest, NextResponse } from 'next/server';
import { captchaImage, issueCaptcha } from '@/lib/admin-captcha';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[API admin/auth/captcha]', ...args);

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

  log('Request received');
  const issued = issueCaptcha();
  log('Issued captcha:', issued);
  return NextResponse.json(
    {
      id: issued.id,
      imageUrl: issued.imageUrl,
      expiresIn: issued.expiresIn,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}