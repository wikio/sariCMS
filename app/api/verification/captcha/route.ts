/**
 * /api/verification/captcha — émission du captcha anti-robot de la vérification.
 *
 * `GET` renvoie `{id, imageUrl, expiresIn}` : le code n'existe que dessiné dans
 * l'image servie par `/api/verification/captcha/image`, à usage unique, dix
 * minutes. C'est le carnet du captcha d'inscription (`lib/newsletter-captcha`)
 * qui tient les jetons — même éphémère, même empreinte, mais une image servie
 * sous notre propre route, pour qu'un rechargement de la vérification ne passe
 * jamais par la route du formulaire de newsletter.
 */
import { NextResponse } from 'next/server';
import { issueCaptcha } from '@/lib/newsletter-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const issued = issueCaptcha();
  return NextResponse.json(
    {
      id: issued.id,
      imageUrl: `/api/verification/captcha/image?id=${encodeURIComponent(issued.id)}`,
      expiresIn: issued.expiresIn,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
