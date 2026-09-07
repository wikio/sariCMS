// app/[locale]/legal/page.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { FileCheck, FileText, Info, Shield } from 'lucide-react';
import { getLegal } from '@/lib/data';
import { LEGAL_DOC_TYPES, type LegalDocType } from '@/lib/legal-docs';
import type { Locale } from '@/lib/i18n';
import Breadcrumb from '@/components/ui/Breadcrumb';

/**
 * Le pied de page pointe volontiers sur `/legal` tout court, et une adresse qui
 * répond 404 alors que les quatre documents existent est un lien cassé de plus.
 * Cette page les énumère — ceux qui ont un titre, dans l'ordre où le visiteur est
 * censé les lire — au lieu de choisir un document à sa place : un renvoi forcé
 * vers les mentions légales ferait disparaître la confidentialité du parcours.
 */

const ICONS: Record<LegalDocType, ReactNode> = {
  mentions: <FileText className="w-8 h-8 text-sari-blue" />,
  privacy: <Shield className="w-8 h-8 text-sari-blue" />,
  conditions: <FileCheck className="w-8 h-8 text-sari-blue" />,
  about: <Info className="w-8 h-8 text-sari-blue" />,
};

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.legal' });
  return {
    title: `${t('legalDoc')} | SARI Système`,
    description: t('otherLegalDocs'),
  };
}

export default async function LegalIndexPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.legal' });
  const legal = await getLegal(locale);
  const docs = LEGAL_DOC_TYPES.filter((type) => legal[type]?.title);

  /*
   * Pas de garde de visibilité ici : l'écran « Visibilité vitrine » agit sur
   * chaque document (`page.mentions`, `page.privacy`…), et une page d'index qui
   * disparaît est exactement le lien cassé que cette page vient réparer. Les
   * documents masqués répondent déjà par l'écran 404 du garde.
   */
  return (
    <div className="pt-32 pb-24 min-h-screen page-enter">
      <div className="bg-sari-blue py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">{t('legalDoc')}</h1>
          <p className="text-lg text-blue-100">{t('otherLegalDocs')}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <Breadcrumb
          items={[
            { label: t('backHome'), href: '/' },
            { label: t('legalDoc') },
          ]}
        />

        {docs.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('pageNotFound')}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {docs.map((type) => (
              <Link
                key={type}
                href={`/${locale}/legal/${type}`}
                className="p-6 border-2 border-gray-200 dark:border-gray-800 rounded-xl transition-all hover:border-sari-blue flex items-start gap-4"
              >
                {ICONS[type]}
                <span className="min-w-0">
                  <span className="block font-bold text-sari-dark dark:text-white mb-1">{legal[type].title}</span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    {legal[type].lastUpdate ? `${t('lastUpdate')} : ${legal[type].lastUpdate}` : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
);
}
