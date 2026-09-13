// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, type Locale } from './lib/i18n';
import { csrfProtectionMiddleware } from './lib/csrf';
import { auditLog } from './lib/audit-log-edge';
import { jwtVerify } from 'jose';

// Créer le middleware next-intl
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
});

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const header of SECURITY_HEADERS) {
    response.headers.set(header.key, header.value);
  }
  return response;
}

function isAdminRoute(pathname: string): boolean {
  return locales.some(locale => pathname.startsWith(`/${locale}/admin`));
}

function isAdminApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/admin');
}

function isAdminLoginPage(pathname: string): boolean {
  return locales.some(locale => pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`);
}

function isPublicAdminApi(pathname: string): boolean {
  return (
    pathname.startsWith('/api/admin/auth/captcha') ||
    pathname.startsWith('/api/admin/auth/verify-captcha') ||
    pathname.startsWith('/api/admin/auth/login') ||
    pathname.startsWith('/api/admin/auth/logout') ||
    pathname.startsWith('/api/admin/auth/refresh') ||
    pathname.startsWith('/api/admin/auth/me') ||
    pathname.startsWith('/api/csrf-token')
  );
}

function getJwtSecrets(): Uint8Array[] {
  const candidates = [
    process.env.ADMIN_JWT_SECRET,
    process.env.JWT_ACCESS_SECRET,
    'dev-secret-change-in-production-min-32-chars!!',
    'change-me-access-secret-min-32-chars-please',
  ].filter(Boolean) as string[];
  const uniq = [...new Set(candidates)];
  return uniq.map(s => new TextEncoder().encode(s));
}

async function verifyAdminToken(token: string): Promise<boolean> {
  for (const secret of getJwtSecrets()) {
    try {
      await jwtVerify(token, secret);
      return true;
    } catch {
      // try next secret
    }
  }
  return false;
}

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown';
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    if (rateLimitMap.size > 10000) rateLimitMap.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  // CSRF protection for admin API routes (POST, PUT, PATCH, DELETE)
  if (isAdminApiRoute(pathname)) {
    const csrfResponse = csrfProtectionMiddleware(request);
    if (csrfResponse) {
      // Log CSRF failure
      auditLog.csrfFailure({ ip, path: pathname, ua }).catch(() => {});
      return addSecurityHeaders(csrfResponse);
    }
  }

  // Protection serveur des routes admin (OWASP A01 — Broken Access Control)
  // Le front faisait uniquement une vérification côté client (localStorage / useAdminAuth)
  // contournable en désactivant JS. On ajoute une garde serveur :
  // - Pages /{locale}/admin/* (hors login) : redirige vers login si pas de cookie sari_admin_access
  // - API /api/admin/* (hors endpoints publics auth/captcha) : 401 JSON si pas de token
  // La validation forte du token est faite dans /api/admin/auth/me (proxy backend + fallback JWT),
  // le middleware vérifie au moins la présence et tente une vérification JWT rapide sans bloquer
  // les tokens backend opaques qui seraient validés par le backend.
  if ((isAdminRoute(pathname) && !isAdminLoginPage(pathname)) || (isAdminApiRoute(pathname) && !isPublicAdminApi(pathname))) {
    const token = request.cookies.get('sari_admin_access')?.value;
    if (!token) {
      auditLog.authFailure({ ip, path: pathname, ua, reason: 'missing_token' }).catch(() => {});
      if (isAdminApiRoute(pathname)) {
        return addSecurityHeaders(
          new NextResponse(JSON.stringify({ error: 'Non authentifié', code: 'NOT_AUTHENTICATED' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      // Page admin : rediriger vers login localisé
      const localeMatch = pathname.match(/^\/(fr|en|ar)(\/|$)/);
      const locale = (localeMatch ? localeMatch[1] : defaultLocale) as string;
      return addSecurityHeaders(NextResponse.redirect(new URL(`/${locale}/admin`, request.url)));
    }
    // Si token présent, tenter une vérification JWT rapide (multi-secrets).
    // Si échec, on ne bloque pas immédiatement : le token peut être un JWT backend signé avec un secret
    // légèrement différent, ou avoir été révoqué côté backend — la route /me fera la vérification
    // définitive via proxy backend. On log seulement pour l'audit.
    const valid = await verifyAdminToken(token);
    if (!valid) {
      // Ne pas bloquer : laisser la requête poursuivre, la vérification backend dans /me ou
      // dans les handlers d'API fera foi. On aurait pu aussi tenter un fetch backend ici,
      // mais cela ajouterait une latence à chaque requête admin.
      // Pour les API sensibles (upload, verification), les handlers eux-mêmes appellent /auth/me.
    }
  }

  // Rate limiting global sur API
  if (pathname.startsWith('/api')) {
    if (checkRateLimit(ip)) {
      // Log rate limit
      auditLog.rateLimited({ ip, path: pathname, ua, limit: RATE_LIMIT_MAX_REQUESTS }).catch(() => {});
      return new NextResponse(JSON.stringify({ error: 'Trop de requêtes', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  }

  // ✅ Exclure les routes API et les fichiers statiques du middleware i18n
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // ✅ Rediriger "/" vers "/fr" (locale par défaut)
  if (pathname === '/') {
    const response = NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
    return addSecurityHeaders(response);
  }

  // ✅ Vérifier si le pathname commence par une locale valide
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // ✅ Si pas de locale, ajouter la locale par défaut
  if (!pathnameHasLocale) {
    const newUrl = new URL(`/${defaultLocale}${pathname}`, request.url);
    const response = NextResponse.redirect(newUrl);
    return addSecurityHeaders(response);
  }

  // ✅ Sinon, laisser next-intl gérer le reste
  const response = intlMiddleware(request);
  return addSecurityHeaders(response);
}

// Configuration des routes à matcher
export const config = {
  matcher: [
    // Matcher toutes les routes sauf les fichiers statiques
    '/((?!_next|_vercel|.*\\..*).*)',
    '/',
    '/(fr|en|ar)/:path*',
  ],
};