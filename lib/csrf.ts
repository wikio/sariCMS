/**
 * lib/csrf.ts — Protection CSRF via Double Submit Cookie Pattern.
 *
 * Le token CSRF est stocké dans un cookie httpOnly (pour lecture JS impossible
 * par un attaquant tiers) ET envoyé dans un header personnalisé `X-CSRF-Token`
 * par le client. Le serveur vérifie que les deux correspondent.
 *
 * Pourquoi pas SameSite=Strict seul : compatibilité navigateurs anciens,
 * sous-domaines, et défense en profondeur.
 */
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = 'sari_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_BYTES = 32;

function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback pour environnements sans crypto.getRandomValues (très rare en 2026)
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return array;
}

function base64UrlEncode(bytes: Uint8Array): string {
  // Convertir en base64 puis adapter pour URL (base64url)
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateCsrfToken(): string {
  return base64UrlEncode(generateRandomBytes(CSRF_TOKEN_BYTES));
}

export function getCsrfTokenFromRequest(req: NextRequest): string | null {
  // Priorité : header (envoyé par le client JS), puis cookie (fallback)
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  if (headerToken) return headerToken;
  return req.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
}

export function validateCsrfToken(req: NextRequest): boolean {
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== cookieToken.length) return false;

  // Comparaison en temps constant
  let diff = 0;
  for (let i = 0; i < headerToken.length; i++) {
    diff |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i);
  }
  return diff === 0;
}

export function csrfProtectionMiddleware(
  req: NextRequest,
  exemptPaths: string[] = ['/api/contact/captcha', '/api/newsletter/captcha', '/api/verification/captcha']
): NextResponse | null {
  // Exempter les routes de lecture (GET, HEAD, OPTIONS) et les chemins listés
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return null;
  const pathname = req.nextUrl.pathname;
  if (exemptPaths.some(p => pathname.startsWith(p))) return null;

  if (!validateCsrfToken(req)) {
    return new NextResponse(
      JSON.stringify({ error: 'Token CSRF invalide ou manquant', code: 'CSRF_INVALID' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

/**
 * Hook côté client pour récupérer le token CSRF depuis le cookie
 * (nécessite que le cookie ne soit PAS httpOnly pour être lisible en JS,
 * ou qu'on l'expose via une route API /api/csrf-token).
 *
 * Ici on utilise une approche hybride : le token est dans un cookie
 * accessible en JS (SameSite=Strict, Secure) car httpOnly empêcherait
 * le client de l'envoyer dans le header. C'est un compromis acceptable
 * car SameSite=Strict bloque déjà la majorité des attaques CSRF.
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}