/**
 * /api/csrf-token — Émission d'un token CSRF pour le client.
 *
 * Le token est stocké dans un cookie (accessible en JS car pas httpOnly
 * pour permettre l'envoi dans le header X-CSRF-Token) et retourné en JSON.
 * SameSite=Strict + Secure protège contre la majorité des attaques CSRF.
 */
import { NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token);
  return response;
}