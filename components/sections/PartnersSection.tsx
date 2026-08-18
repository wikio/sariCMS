// components/sections/PartnersSection.tsx
'use client';

import { useTranslations } from 'next-intl';
import type { Partner } from '@/types';
import ImageWithFallback from '@/components/shared/ImageWithFallback';

interface PartnersSectionProps {
  partners: Partner[];
}

export default function PartnersSection({ partners }: PartnersSectionProps) {
  const t = useTranslations('components.sections.PartnersSection');

  // ✅ Vérification que partners existe et n'est pas vide
  if (!partners || partners.length === 0) return null;

  return (
    <section className="py-24 bg-white dark:bg-[#1a1a1a]">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
            {t('subtitle')}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-4 mb-6">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('description')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center stagger-children">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="bg-gray-50 dark:bg-[#111111] p-8 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800 rounded-xl hover:border-sari-blue hover:shadow-lg transition-all duration-300 group"
            >
              <ImageWithFallback
                src={partner.logo}
                alt={partner.name}
                fallbackText={partner.name}
                className="max-h-16 w-auto opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 grayscale group-hover:grayscale-0"
                objectFit="contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}