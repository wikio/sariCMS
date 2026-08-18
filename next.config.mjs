import createNextIntlPlugin from 'next-intl/plugin';

// ✅ Indiquez explicitement le chemin vers votre fichier de configuration i18n
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const cmsInternal = (process.env.CMS_API_INTERNAL_URL || 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'sarisysteme.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
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
