/**
 * /api/contact/captcha — émission du captcha anti-robot du formulaire de contact.
 *
 * `GET` renvoie `{id, imageUrl, expiresIn}` : le code n'existe que dessiné dans
 * l'image servie par `/api/contact/captcha/image`, à usage unique, dix minutes.
 */
import { NextResponse } from 'next/server';
import { issueCaptcha } from '@/lib/contact-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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