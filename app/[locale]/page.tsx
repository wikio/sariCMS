// app/[locale]/page.tsx
import { getTranslations } from 'next-intl/server';
import { getHero, getProducts, getTestimonials, getPartners, getNews, getEvents, getConfig } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import HeroSlider from '@/components/sections/HeroSlider';
import MarqueePartners from '@/components/sections/MarqueePartners';
import NavigationGrid from '@/components/sections/NavigationGrid';
import ParallaxSection from '@/components/sections/ParallaxSection';
import FeaturedProducts from '@/components/sections/FeaturedProducts';
import AlternatingSections from '@/components/sections/AlternatingSections';
import StatsSection from '@/components/sections/StatsSection';
import TestimonialsSlider from '@/components/sections/TestimonialsSlider';
import LatestEvents from '@/components/sections/LatestEvents';
import NewsletterSection from '@/components/sections/NewsletterSection';
import PartnersSection from '@/components/sections/PartnersSection';
import CTASection from '@/components/sections/CTASection';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.nav' });
  return {
    title: `${t('home')} | SARI Système`,
    description: 'Distribution d\'équipements médicaux professionnels en Algérie depuis plus de 20 ans.',
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  // ✅ Chargement parallèle de toutes les données
  const [hero, products, testimonials, partners, news, events, config] = await Promise.all([
    getHero(locale),
    getProducts(locale),
    getTestimonials(locale),
    getPartners(locale),
    getNews(locale),
    getEvents(locale),
    getConfig(locale),
  ]);

  return (
    <div>
      <HeroSlider slides={hero} />
      <MarqueePartners partners={partners} />
      <NavigationGrid />
      <ParallaxSection locale={locale} />
      <FeaturedProducts products={products} count={4} />
      <AlternatingSections />
      {/* ✅ Passage explicite des props */}
      <StatsSection config={config} />
      <TestimonialsSlider testimonials={testimonials} />
      <LatestEvents events={events} count={3} />
      <NewsletterSection />
      <PartnersSection partners={partners} />
      <CTASection />
    </div>
  );
}