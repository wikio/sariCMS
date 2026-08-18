import createNextIntlPlugin from 'next-intl/plugin';

// ✅ Indiquez explicitement le chemin vers votre fichier de configuration i18n
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'sarisysteme.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },  /*
  async redirects() {
    return [
      // Rediriger les URLs françaises vers les dossiers anglais
      { source: '/fr/a-propos', destination: '/fr/about', permanent: true },
      { source: '/fr/panier', destination: '/fr/cart', permanent: true },
      { source: '/fr/produits', destination: '/fr/products', permanent: true },
      { source: '/fr/produits/:id', destination: '/fr/products/:id', permanent: true },
      { source: '/fr/paiement', destination: '/fr/payment', permanent: true },
      { source: '/fr/evenements', destination: '/fr/events', permanent: true },
      { source: '/fr/actualites', destination: '/fr/news', permanent: true },
      { source: '/fr/emplois/:id', destination: '/fr/jobs/:id', permanent: true },
      { source: '/fr/legal/mentions-legales', destination: '/fr/legal/legal-notice', permanent: true },
      { source: '/fr/legal/confidentialite', destination: '/fr/legal/privacy', permanent: true },
      { source: '/fr/legal/conditions-generales', destination: '/fr/legal/cgv', permanent: true },
      
      { source: '/en/legal/general-terms', destination: '/en/legal/cgv', permanent: true },
      { source: '/en/paiement', destination: '/en/payment', permanent: true },
 
      // Idem pour l'arabe
      { source: '/ar/من-نحن', destination: '/ar/about', permanent: true },
      { source: '/ar/السلة', destination: '/ar/cart', permanent: true },
      { source: '/ar/المنتجات', destination: '/ar/products', permanent: true },
      { source: '/ar/المنتجات/:id', destination: '/ar/products/:id', permanent: true },
      { source: '/ar/الدفع', destination: '/ar/payment', permanent: true },
      { source: '/ar/الفعاليات', destination: '/ar/events', permanent: true },
      { source: '/ar/الأخبار', destination: '/ar/news', permanent: true },
      { source: '/ar/الوظائف/:id', destination: '/ar/jobs/:id', permanent: true },
      { source: '/ar/قانون/الإشعار-القانوني', destination: '/ar/legal/legal-notice', permanent: true },
      { source: '/ar/قانون/سياسة-الخصوصية', destination: '/ar/legal/privacy', permanent: true },
      { source: '/ar/قانون/الشروط-الأحكام', destination: '/ar/legal/cgv', permanent: true },
      
    ];
  },*/
};

export default withNextIntl(nextConfig);