// app/[locale]/services/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { getServices } from '@/lib/data';
import { loadFicheLocale } from '@/lib/fiche-i18n';
import { entityUrl } from '@/lib/entity-url';
import ServiceCard from '@/components/cards/ServiceCard';
import FAQ from '@/components/ui/FAQ';
import SectionTitle from '@/components/ui/SectionTitle';
import Divider from '@/components/shared/Divider';
import EmptyState from '@/components/ui/EmptyState';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';

export default function ServicesPage() {
  const locale = useLocale();
  const t = useTranslations('pages.services');
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    const loadServices = async () => {
      const data = await getServices(locale);
      
      // Appliquer les traductions pour les icônes et couleurs
      const translatedServices = data.map(service => {
        if (locale === 'fr') return service;
        
        // Charger les traductions depuis localStorage
        const fiche = loadFicheLocale('services', String(service.id), locale);
        
        return {
          ...service,
          // Fallback sur la version française si pas de traduction
          icon: (fiche.icon as string) || service.icon,
          color: (fiche.color as string) || service.color,
          image: (fiche.image as string) || service.image,
          title: (fiche.title as string) || service.title,
          shortDesc: (fiche.shortDesc as string) || service.shortDesc,
          fullDesc: (fiche.fullDesc as string) || service.fullDesc,
          features: (fiche.features as string[]) || service.features,
          faq: (fiche.faq as Array<{ q: string; a: string }>) || service.faq,
          // Le slug traduit doit suivre, sinon l'URL garde le slug français.
          slug: (fiche.slug as string) || service.slug,
        };
      });

      console.info(
        `[services/liste] ${translatedServices.length} services en ${locale}` +
          translatedServices
            .map(
              (s: any) =>
                `\n  • id=${s.id} legacyId=${s.legacyId ?? '(aucun)'} → ${entityUrl(
                  locale,
                  'services',
                  s,
                )}`,
            )
            .join(''),
      );

      setServices(translatedServices);
    };
    loadServices();
  }, [locale]);

  // FAQ traduite
  const faqItems = t.raw('faq') || [];

  if (services.length === 0) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center">
        <EmptyState
          icon="wrench"
          title={t('loading')}
          description={t('loadingDesc')}
          action={{ label: t('backHome'), href: '/' }}
        />
      </div>
    );
  }

  return (
    <PageVisibilityGuard visibilityKey="module.services">
    <div className="pt-32 page-enter">
      <div
        className="parallax-bg py-24 flex items-center justify-center text-center text-white relative"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920)' }}
      >
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="relative z-10 container mx-auto px-6">
          <h1 className="text-5xl font-bold mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="py-24 container mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href={`/${locale}`} className="hover:text-sari-blue transition-colors">
            {t('home')}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-sari-dark dark:text-white font-semibold">
            {t('services')}
          </span>
        </nav>

        <SectionTitle
          subtitle={t('expertiseSubtitle')}
          title={t('expertiseTitle')}
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        <Divider text={t('faqTitle')} />

        <div className="max-w-4xl mx-auto mt-12">
          {faqItems.length > 0 ? (
            <FAQ items={faqItems} variant="numbered" />
          ) : (
            <FAQ
              items={[
                { q: t('faq.0.q'), a: t('faq.0.a') },
                { q: t('faq.1.q'), a: t('faq.1.a') },
                { q: t('faq.2.q'), a: t('faq.2.a') },
                { q: t('faq.3.q'), a: t('faq.3.a') }
              ]}
              variant="numbered"
            />
          )}
        </div>
      </div>
    </div>
    </PageVisibilityGuard>
  );
}