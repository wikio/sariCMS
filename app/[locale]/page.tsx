// app/[locale]/page.tsx
import { getTranslations } from 'next-intl/server';
import { getHero, getProducts, getTestimonials, getPartners, getNews, getEvents, getConfig } from '@/lib/data';
// La configuration des blocs vient du module serveur (il lit les fichiers de
// secours) : jamais par `lib/data.ts`, que des composants client importent.
import { getHomeSnapshot } from '@/lib/home/store';
import type { Locale } from '@/lib/i18n';
import { catalogEntry } from '@/lib/home/catalog';
import { HOME_ORDER, type HomeSectionKey, type HomeSections } from '@/lib/home/config';
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
import type { ReactNode } from 'react';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.nav' });
  return {
    title: `${t('home')} | SARI Système`,
    description: 'Distribution d\'équipements médicaux professionnels en Algérie depuis plus de 20 ans.',
  };
}

/**
 * Les blocs de la page d'accueil sont rendus dans l'ordre enregistré par
 * l'administration (Studio → Page d'accueil) et chacun reçoit sa propre
 * configuration : textes, nombre d'éléments, sélection de fiches, style et,
 * le cas échéant, le HTML produit par le constructeur de page.
 *
 * Deux filtres s'appliquent avant l'affichage, dans cet ordre :
 * 1. la visibilité globale du bloc (écran « Visibilité vitrine »), qui masque
 *    le bloc à tous les visiteurs d'une langue ;
 * 2. l'interrupteur « afficher » du studio, qui n'éteint que ce bloc.
 *
 * Les données du catalogue sont chargées une seule fois pour la page : chaque
 * bloc y puise selon sa sélection, ce qui évite N requêtes pour N blocs.
 */
/**
 * `firstOnPage` : le bandeau de navigation est en `position: fixed`, il survole
 * la page. Seul le bloc de tête doit donc lui céder de la place — et il le fait
 * par la variable `--site-header-h`, mesurée sur le bandeau réel.
 */
function renderSection(
  key: HomeSectionKey,
  sections: HomeSections,
  data: Record<string, unknown>,
  firstOnPage = false,
): ReactNode {
  const config = sections[key];
  switch (key) {
    case 'hero':
      return <HeroSlider slides={data.hero as never} config={config} firstOnPage={firstOnPage} />;
    case 'partners-marquee':
      return <MarqueePartners partners={data.partners as never} config={config} />;
    case 'navigation':
      return <NavigationGrid config={config} />;
    case 'mission':
      return <ParallaxSection config={config} />;
    case 'products':
      return <FeaturedProducts products={data.products as never} config={config} />;
    case 'blocks':
      return <AlternatingSections config={config} />;
    case 'stats':
      return <StatsSection config={data.config as never} home={config} />;
    case 'testimonials':
      return <TestimonialsSlider testimonials={data.testimonials as never} config={config} />;
    case 'events':
      return <LatestEvents events={data.events as never} config={config} />;
    case 'news':
      return <LatestNews news={data.news as never} config={config} />;
    case 'newsletter':
      return <NewsletterSection config={config} source="home.newsletter" />;
    case 'partners':
      return <PartnersSection partners={data.partners as never} config={config} />;
    case 'cta':
      return <CTASection config={config} />;
    default:
      return null;
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  // ✅ Chargement parallèle de toutes les données, configuration des blocs comprise
  const [hero, products, testimonials, partners, news, events, config, home] = await Promise.all([
    getHero(locale),
    getProducts(locale),
    getTestimonials(locale),
    getPartners(locale),
    getNews(locale),
    getEvents(locale),
    getConfig(locale),
    getHomeSnapshot(locale),
  ]);

  const data = { hero, products, testimonials, partners, news, events, config };
  const order = (home.order?.length ? home.order : HOME_ORDER) as HomeSectionKey[];

  return (
    <div>
      {order.map((key, index) => {
        const element = renderSection(key, home.sections, data, index === 0);
        if (!element) return null;
        return (
          <VisibleSection key={key} visibilityKey={catalogEntry(key)?.visibilityKey || `section.${key}`}>
            {element}
          </VisibleSection>
        );
      })}
    </div>
  );
}
