// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, type Locale } from './lib/i18n';

// Créer le middleware next-intl
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Exclure les routes API et les fichiers statiques
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ✅ Rediriger "/" vers "/fr" (locale par défaut)
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
  }

  // ✅ Vérifier si le pathname commence par une locale valide
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // ✅ Si pas de locale, ajouter la locale par défaut
  if (!pathnameHasLocale) {
    const newUrl = new URL(`/${defaultLocale}${pathname}`, request.url);
    return NextResponse.redirect(newUrl);
  }

  // ✅ Sinon, laisser next-intl gérer le reste
  return intlMiddleware(request);
}

// Configuration des routes à matcher
export const config = {
  matcher: [
    // Matcher toutes les routes sauf les fichiers statiques et API
    '/((?!api|_next|_vercel|.*\\..*).*)',
    '/',
    '/(fr|en|ar)/:path*',
  ],
};