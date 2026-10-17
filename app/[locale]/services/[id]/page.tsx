// app/[locale]/services/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Send, AlertCircle } from 'lucide-react';
import { getServices } from '@/lib/data';
import { entityRouteKey, findByRouteKey, routeId } from '@/lib/entity-url';
import type { Service } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';
import CTAButton from '@/components/ui/CTAButton';
import FAQ from '@/components/ui/FAQ';
import EmptyState from '@/components/ui/EmptyState';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';
import IconMark from '@/components/admin/IconMark';
import { resolveColor } from '@/lib/colors';

export default function ServiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const t = useTranslations('pages.serviceDetail');

  const [service, setService] = useState<Service | null>(null);

  useEffect(() => {
    const loadService = async () => {
      const services = await getServices(locale);
      // Même résolveur que les solutions : id, slug complet, partie slug, puis
      // legacyId. `matchesEntity` ignorait le legacyId, donc une URL portant
      // l'id d'une autre langue ne trouvait rien.
      const found = findByRouteKey(services, id);
      console.info(
        `[services/detail] segment « ${id} » en ${locale}` +
          `\n  id extrait : ${routeId(id)} — ${services.length} fiches chargées` +
          `\n  fiches : ${services
            .map((s) => `${s.id}${s.legacyId ? `(legacy ${s.legacyId})` : ''}`)
            .join(', ')}` +
          (found
            ? `\n  ✅ trouvée : id=${found.id} legacyId=${found.legacyId ?? '(aucun)'}` +
              ` — URL canonique « ${entityRouteKey(found)} »`
            : `\n  ❌ AUCUNE fiche ne correspond → écran « service introuvable ».`),
      );
      setService(found || null);
    };
    loadService();
  }, [id, locale]);

  if (!service) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center min-h-screen flex items-center justify-center">
        <EmptyState
          icon="alert-circle"
          title={t('notFound')}
          description={t('notFoundDesc')}
          action={{ label: t('backToServices'), href: '/services' }}
        />
      </div>
    );
  }

  // Couleur de la fiche, résolue depuis le jeton stocké en base
  // ('sari-blue', 'orange-500', '#0f766e'…).
  const accent = resolveColor(service.color);

  return (
    <PageVisibilityGuard visibilityKey="module.services">
    <div className="pt-32 pb-24 min-h-screen page-enter">
      {/* Bandeau aux couleurs de la fiche : l'icône et la couleur viennent de
          la base (champs `icon` et `color`), comme sur les cartes et le module
          Solutions. Auparavant un emoji 🏥 et un bleu figés donnaient le même
          en-tête aux quatre services. */}
      <div
        className="py-24 text-center text-white relative overflow-hidden"
        style={{ backgroundColor: accent }}
      >
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="container mx-auto px-6 relative">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <IconMark name={service.icon} fallback="wrench" className="w-10 h-10" color="#ffffff" />
          </div>
          <h1 className="text-5xl font-bold mb-4">{service.title}</h1>
          <p className="text-xl max-w-2xl mx-auto text-white/80">{service.shortDesc}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <Breadcrumb items={[
          { label: t('home'), href: '/' },
          { label: t('services'), href: '/services' },
          { label: service.title }
        ]} />

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl mb-12 rounded-xl">
              <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-6">
                {t('aboutTitle')}
              </h2>
              <div
                className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed"
                dangerouslySetInnerHTML={{ __html: service.fullDesc || '' }}
              />
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl mb-12 rounded-xl">
              <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-8">
                {t('commitmentsTitle')}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {service.features?.map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-sari-blue/5 border border-sari-blue/20 rounded-lg">
                    <div className="w-10 h-10 bg-sari-blue rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold text-sari-dark dark:text-white">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {service.faq && service.faq.length > 0 && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-8">
                  {t('faqTitle')}
                </h2>
                <FAQ items={service.faq} variant="numbered" />
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-32 bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-xl">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-4">
                {t('needService')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                {t('needServiceDesc')}
              </p>
              <CTAButton href="/contact" variant="primary" icon="send" fullWidth>
                {t('requestQuote')}
              </CTAButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageVisibilityGuard>
  );
}