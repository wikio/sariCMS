/**
 * Image du captcha de contact : `GET /api/contact/captcha/image?id=…`
 *
 * Le code n'existe que dessiné dans les pixels de ce fichier. Il n'est ni dans
 * le HTML du formulaire, ni dans un attribut `alt`, ni dans la réponse JSON de
 * l'émission : un robot doit lire l'image pour répondre.
 *
 * Réponse `image/svg+xml`, jamais mise en cache (`no-store`) : un code est lié à
 * un jeton à usage unique, le servir depuis un cache le rendrait rejouable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { captchaImage } from '@/lib/contact-captcha';

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