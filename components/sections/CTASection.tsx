// components/sections/CTASection.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function CTASection() {
  const locale = useLocale();
  const t = useTranslations('components.sections.CTASection');

  return (
    <section className="py-24 bg-sari-dark relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
      <div className="container mx-auto px-6 relative z-10 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          {t('defaultTitle')}
        </h2>
        <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
          {t('defaultDescription')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/${locale}/contact`}
            className="btn-primary text-white px-10 py-4 font-semibold text-lg inline-flex items-center gap-2"
          >
            {t('primaryLabel')}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href={`/${locale}/products`}
            className="bg-sari-lime text-sari-dark px-8 py-4 font-bold rounded-lg hover:bg-white transition-colors flex items-center justify-center gap-2"
          >
            {t('secondaryLabel')}
          </Link>
        </div>
      </div>
    </section>
  );
}