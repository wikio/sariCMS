/**
 * /api/admin/auth/captcha — émission du captcha anti-robot de l'auth admin.
 */
import { NextResponse } from 'next/server';
import { issueCaptcha } from '@/lib/admin-captcha';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[API admin/auth/captcha]', ...args);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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