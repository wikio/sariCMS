// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import { locales, isRtl, type Locale } from '@/lib/i18n';
import { getConfig, getMenu } from '@/lib/data';
import SiteWrapper from '@/components/layout/SiteWrapper';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CartProvider } from '@/contexts/CartContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { ApplicationsProvider } from '@/contexts/ApplicationsContext';
import '@/app/globals.css';

const inter = Inter({
  subsets: ['latin', 'arabic'],
  display: 'swap',
  variable: '--font-inter',
});

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
  const config = await getConfig(locale);
  return {
    title: `${config.meta.companyName} - ${config.meta.tagline}`,
    description: config.meta.description,
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

  return (
    <html lang={locale} dir={dir} className={inter.variable} suppressHydrationWarning>
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
                    <SiteWrapper config={config} menu={menu}>
                      {children}
                    </SiteWrapper>
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