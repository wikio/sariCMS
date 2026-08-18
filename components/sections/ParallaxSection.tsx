// components/sections/ParallaxSection.tsx
'use client'; // ✅ IMPORTANT : doit être un Client Component

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ParallaxSectionProps {
  image?: string;
  subtitle?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaLink?: string;
  locale?: string;
}

export default function ParallaxSection({
  image = 'https://images.unsplash.com/photo-1519494026892-88bb237b200d?w=1920',
  subtitle,
  title,
  description,
  ctaLabel,
  ctaLink = '/about',
  locale = 'fr',
}: ParallaxSectionProps) {
  const t = useTranslations('components.sections.ParallaxSection');

  return (
    <section
      className="parallax-bg py-32 relative"
      style={{ backgroundImage: `url(${image})` }}
    >
      <div className="absolute inset-0 bg-sari-dark/90"></div>
      <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
      <div className="container mx-auto px-6 relative z-10 text-center">
        <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
          {subtitle || t('defaultSubtitle')}
        </span>
        <h2 className="text-4xl md:text-6xl font-bold text-white mt-4 mb-8 max-w-4xl mx-auto leading-tight">
          {title || t('defaultTitle')}
        </h2>
        <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
          {description || t('defaultDescription')}
        </p>
        <Link
          href={`/${locale}${ctaLink}`}
          className="btn-primary text-white px-10 py-4 font-semibold text-lg inline-flex items-center gap-2"
        >
          {ctaLabel || t('defaultCta')}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}