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
import LatestNews from '@/components/sections/LatestNews';
import NewsletterSection from '@/components/sections/NewsletterSection';
import PartnersSection from '@/components/sections/PartnersSection';
import CTASection from '@/components/sections/CTASection';
import VisibleSection from '@/components/shared/VisibleSection';

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
      <VisibleSection visibilityKey="section.hero">
        <HeroSlider slides={hero} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.partners">
        <MarqueePartners partners={partners} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.navigation">
        <NavigationGrid />
      </VisibleSection>
      <VisibleSection visibilityKey="section.mission">
        <ParallaxSection locale={locale} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.products">
        <FeaturedProducts products={products} count={4} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.solutions">
        <AlternatingSections />
      </VisibleSection>
      <VisibleSection visibilityKey="section.stats">
        <StatsSection config={config} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.testimonials">
        <TestimonialsSlider testimonials={testimonials} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.events">
        <LatestEvents events={events} count={3} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.news">
        <LatestNews news={news} count={3} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.newsletter">
        <NewsletterSection />
      </VisibleSection>
      <VisibleSection visibilityKey="section.partners">
        <PartnersSection partners={partners} />
      </VisibleSection>
      <VisibleSection visibilityKey="section.cta">
        <CTASection />
      </VisibleSection>
    </div>
  );
}