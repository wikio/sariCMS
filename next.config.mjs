import createNextIntlPlugin from 'next-intl/plugin';

// ✅ Indiquez explicitement le chemin vers votre fichier de configuration i18n
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const cmsInternal = (process.env.CMS_API_INTERNAL_URL || 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');

/**
 * Adresses légales courtes, renvoyées vers le document correspondant.
 *
 * Les liens du pied de page ont été écrits à la main, puis repris en base dans la
 * collection `menus` : on y trouve donc `/privacy` ou `/terms` côte à côte avec
 * `/legal/privacy`. Les documents, eux, n'ont qu'une adresse — `/legal/{type}` —
 * parce que c'est le `category` de la fiche qui décide (voir `lib/legal-docs.ts`).
 * Plutôt qu'un 404 pour un lien de menu, on adoube l'ancienne forme ; et
 * `permanent: false`, parce qu'un lien de pied de page se corrige en base et qu'une
 * redirection 301 collerait au navigateur pour dix ans.
 */
// Les langues du site, à tenir alignées sur `lib/i18n.ts` — next.config.mjs est lu
// par Node avant la compilation et ne peut pas importer un module TypeScript.
const LOCALES = ['fr', 'en', 'ar'];
const LEGAL_ALIASES = {
  // Confidentialité.
  privacy: 'privacy',
  confidentialite: 'privacy',
  'data-protection': 'privacy',
  'data-privacy': 'privacy',
  rgpd: 'privacy',
  cookies: 'privacy',
  // Conditions de vente.
  terms: 'conditions',
  cgv: 'conditions',
  'terms-and-conditions': 'conditions',
  'conditions-generales-de-vente': 'conditions',
  // Mentions légales.
  mentions: 'mentions',
  'mentions-legales': 'mentions',
  'legal-notice': 'mentions',
  'legal-mentions': 'mentions',
};
const legalRedirects = Object.entries(LEGAL_ALIASES).map(([from, to]) => ({
  source: `/:locale(${LOCALES.join('|')})/${from}`,
  destination: `/:locale/legal/${to}`,
  permanent: false,
}));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['grapesjs'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'sarisysteme.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://sarisysteme.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-CSRF-Token' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://images.unsplash.com https://www.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://images.unsplash.com https://sarisysteme.com https://www.google.com",
              "frame-src 'self' https://www.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "media-src 'self'",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async redirects() {
    return legalRedirects;
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${cmsInternal}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
