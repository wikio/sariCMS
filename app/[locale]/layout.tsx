// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, isRtl, type Locale } from '@/lib/i18n';
import { getConfig, getMenu } from '@/lib/data';
import SiteWrapper from '@/components/layout/SiteWrapper';
import VisibilityProvider from '@/components/layout/VisibilityProvider';
import { fetchVisibility } from '@/lib/visibility-server';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CartProvider } from '@/contexts/CartContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { ApplicationsProvider } from '@/contexts/ApplicationsContext';
import '@/app/globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [{ getSeo }] = await Promise.all([import('@/lib/seo')]);
  const [config, seo] = await Promise.all([getConfig(locale), getSeo(locale)]);
  const title = seo.title || `${config.meta.companyName} - ${config.meta.tagline}`;
  const description = seo.description || config.meta.description;
  let metadataBase: URL | undefined;
  try {
    if (seo.canonical) metadataBase = new URL(seo.canonical);
  } catch {
    metadataBase = undefined;
  }
  return {
    title: {
      default: title,
      template: seo.titleTemplate || '%s | SARI Système',
    },
    description,
    keywords: seo.keywords ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
    robots: seo.robots || 'index, follow',
    metadataBase,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    openGraph: {
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      images: seo.ogImage ? [{ url: seo.ogImage }] : undefined,
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      site: seo.twitter || undefined,
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
    verification: seo.googleSiteVerification ? { google: seo.googleSiteVerification } : undefined,
    icons: seo.favicon ? { icon: seo.favicon } : undefined,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = isRtl(locale) ? 'rtl' : 'ltr';

  // ✅ Charger config et menu pour les passer au SiteWrapper
  const config = await getConfig(locale);
  const menu = await getMenu(locale);
  // Visibilité propre à cette langue, lue en base : le rendu serveur part donc
  // du bon état, sans scintillement au montage.
  const visibility = await fetchVisibility(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body 
        className="antialiased bg-gray-50 dark:bg-[#111111] text-sari-dark dark:text-gray-200 font-sans"
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <CartProvider>
                <OrdersProvider>
                  <ApplicationsProvider>
                    {/* ✅ SiteWrapper reçoit config et menu pour gérer l'affichage conditionnel */}
                    <VisibilityProvider locale={locale} overrides={visibility}>
                      <SiteWrapper config={config} menu={menu}>
                        {children}
                      </SiteWrapper>
                    </VisibilityProvider>
                  </ApplicationsProvider>
                </OrdersProvider>
              </CartProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}