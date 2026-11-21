// Proxy HTTP Next.js : routage i18n et gardes communes.
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './lib/i18n';
import { csrfProtectionMiddleware, generateCsrfToken, setCsrfCookie } from './lib/csrf';
import { auditLog } from './lib/audit-log-edge';
import { adminIdentity, authStatus, getAccessToken, getCmsAccessToken } from './lib/admin-auth';

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

function finalize(request: NextRequest, response: NextResponse): NextResponse {
  const final = addSecurityHeaders(response);
  // Double Submit CSRF: si l'utilisateur est sur l'admin mais n'a pas encore de cookie sari_csrf,
  // on le pose maintenant pour que le premier POST/PUT n'échoue pas. Le token est aussi
  // posé par /api/csrf-token et par /api/admin/auth/login, mais le middleware couvre
  // le cas où l'on arrive direct sur /admin/dashboard après login.
  if ((isAdminRoute(request.nextUrl.pathname) || isAdminApiRoute(request.nextUrl.pathname)) && !request.cookies.get('sari_csrf')?.value) {
    const token = generateCsrfToken();
    setCsrfCookie(final, token);
  }
  return final;
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

const PUBLIC_ADMIN_API = new Set([
  '/api/admin/auth/captcha', '/api/admin/auth/captcha/image', '/api/admin/auth/verify-captcha',
  '/api/admin/auth/login', '/api/admin/auth/logout', '/api/admin/auth/refresh', '/api/admin/auth/me',
]);

function isPublicAdminApi(pathname: string): boolean {
  return PUBLIC_ADMIN_API.has(pathname);
}

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown';
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const IS_DEV = process.env.NODE_ENV !== 'production';
const RATE_LIMIT_PUBLIC_MAX = Number(process.env.API_RATE_LIMIT_MAX || (IS_DEV ? 1000 : 300));
const RATE_LIMIT_ADMIN_MAX = Number(process.env.API_ADMIN_RATE_LIMIT_MAX || (IS_DEV ? 2000 : 600));
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    if (rateLimitMap.size > 10000) rateLimitMap.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > maxRequests;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  // CSRF protection for admin API routes (POST, PUT, PATCH, DELETE)
  if (isAdminApiRoute(pathname)) {
    const csrfResponse = csrfProtectionMiddleware(request);
    if (csrfResponse) {
      // Log CSRF failure
      auditLog.csrfFailure({ ip, path: pathname, ua }).catch(() => {});
      return finalize(request, csrfResponse);
    }
  }

  // Nest revalide la session et le rôle, y compris pour les routes qui ne lisent
  // que des fichiers locaux. Le cookie d'affichage ne constitue pas une preuve.
  if ((isAdminRoute(pathname) && !isAdminLoginPage(pathname)) || (isAdminApiRoute(pathname) && !isPublicAdminApi(pathname))) {
    const token = pathname.startsWith('/api/admin/cms/') ? getCmsAccessToken(request) : getAccessToken(request);
    try {
      await adminIdentity(token);
    } catch (error) {
      const status = authStatus(error);
      if (status === 401 || status === 403) {
        auditLog.authFailure({ ip, path: pathname, ua, reason: token ? 'session_denied' : 'missing_token' }).catch(() => {});
        if (!isAdminApiRoute(pathname)) {
          const locale = pathname.split('/')[1];
          return finalize(request, NextResponse.redirect(new URL(`/${locale}/admin`, process.env.PUBLIC_SITE_ORIGIN || request.url)));
        }
      }
      return finalize(request, NextResponse.json({ error: status === 401 ? 'Non authentifié' : status === 403 ? 'Accès refusé' : 'Service indisponible' },
        { status, headers: { 'Cache-Control': 'no-store' } }));
    }
  }

  // Rate limiting global sur API (seaux séparés admin authentifié, images dynamiques, vs public,
  // les endpoints sensibles disposant en plus de leurs propres limites strictes).
  if (pathname.startsWith('/api')) {
    const isPlaceholderAsset = pathname === '/api/placeholder' || pathname.startsWith('/api/placeholder/');
    const isAuthenticatedAdmin =
      isAdminApiRoute(pathname) && !isPublicAdminApi(pathname) && Boolean(request.cookies.get('sari_admin_access')?.value);
    const bucket = isPlaceholderAsset ? 'placeholder' : isAuthenticatedAdmin ? 'admin' : 'public';
    const limit = isPlaceholderAsset
      ? Math.max(RATE_LIMIT_ADMIN_MAX, 600)
      : isAuthenticatedAdmin
        ? RATE_LIMIT_ADMIN_MAX
        : RATE_LIMIT_PUBLIC_MAX;
    if (checkRateLimit(`${bucket}:${ip}`, limit)) {
      // Log rate limit
      auditLog.rateLimited({ ip, path: pathname, ua, limit }).catch(() => {});
      return finalize(
        request,
        new NextResponse(JSON.stringify({ error: 'Trop de requêtes', code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      );
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
    return finalize(request, response);
  }

  // ✅ Rediriger "/" vers "/fr" (locale par défaut)
  if (pathname === '/') {
    const response = NextResponse.redirect(new URL(`/${defaultLocale}${request.nextUrl.search}`, process.env.PUBLIC_SITE_ORIGIN || request.url));
    return finalize(request, response);
  }

  // ✅ Vérifier si le pathname commence par une locale valide
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // ✅ Si pas de locale, ajouter la locale par défaut
  if (!pathnameHasLocale) {
    const newUrl = new URL(`/${defaultLocale}${pathname}${request.nextUrl.search}`, process.env.PUBLIC_SITE_ORIGIN || request.url);
    const response = NextResponse.redirect(newUrl);
    return finalize(request, response);
  }

  // ✅ Sinon, laisser next-intl gérer le reste
  const response = intlMiddleware(request);
  return finalize(request, response);
}

// Configuration des routes à matcher
export const config = {
  matcher: [
    // Matcher toutes les routes sauf les fichiers statiques
    '/((?!_next|_vercel|.*\\..*).*)',
    '/',
    '/(fr|en|ar)/:path*',
    '/api/admin/:path*',
  ],
};