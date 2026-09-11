/**
 * /api/admin/auth/captcha — émission du captcha anti-robot de l'auth admin.
 */
import { NextResponse } from 'next/server';
import { issueCaptcha } from '@/lib/admin-captcha';

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