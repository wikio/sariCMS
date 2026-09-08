/**
 * Image du captcha d'inscription : `GET /api/newsletter/captcha?id=…`
 *
 * Le code n'existe que dessiné dans les pixels de ce fichier. Il n'est ni dans
 * le HTML du formulaire, ni dans un attribut `alt`, ni dans la réponse JSON de
 * l'émission : un robot doit lire l'image pour répondre.
 *
 * Réponse `image/svg+xml`, jamais mise en cache (`no-store`) : un code est lié à
 * un jeton à usage unique, le servir depuis un cache le rendrait rejouable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { captchaImage } from '@/lib/newsletter-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  const svg = captchaImage(id);
  if (!svg) {
    // Jeton inconnu ou périmé : un rectangle vide que le formulaire remplace
    // immédiatement en redemandant un code.
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
      // L'image n'est pas appelée depuis un autre hôte ; le refus explicite
      // évite qu'un site tiers affiche nos codes.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
