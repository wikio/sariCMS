/**
 * /api/admin/auth/logout — Déconnexion admin.
 *
 * Supprime les cookies d'authentification.
 */
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}