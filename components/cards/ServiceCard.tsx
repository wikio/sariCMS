// components/cards/ServiceCard.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Package } from 'lucide-react';
import IconMark from '@/components/admin/IconMark';
import type { Service } from '@/types';

interface ServiceCardProps {
  service: Service;
  variant?: 'standard' | 'compact';
  onClick?: (service: Service) => void;
}

export default function ServiceCard({ service, variant = 'standard', onClick }: ServiceCardProps) {
  const locale = useLocale();
  const t = useTranslations('components.cards.ServiceCard');

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(service);
    }
  };

  const serviceUrl = `/${locale}/services/${service.slug || service.id}`;
  const color = service.color || 'sari-blue';

  // === Variante COMPACT ===
  if (variant === 'compact') {
    return (
      <Link
        href={serviceUrl}
        onClick={handleClick}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
      >
        {service.image ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
            <img src={service.image} alt={service.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: `var(--${color}, var(--sari-blue))20` }}>
            <IconMark name={service.icon} className="w-6 h-6 transition-colors" style={{ color: `var(--${color}, var(--sari-blue))` }} />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors">
            {service.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
            {service.shortDesc}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-sari-blue transition-all" />
      </Link>
    );
  }

  // === Variante STANDARD ===
  return (
    <Link
      href={serviceUrl}
      onClick={handleClick}
      className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-8 rounded-xl hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col"
    >
      {service.image ? (
        <div className="w-full h-40 rounded-lg overflow-hidden mb-6">
          <img src={service.image} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        </div>
      ) : (
        <div className="w-14 h-14 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform rounded-lg" style={{ backgroundColor: `var(--${color}, var(--sari-blue))20` }}>
          <IconMark name={service.icon} className="w-7 h-7 transition-colors" style={{ color: `var(--${color}, var(--sari-blue))` }} />
        </div>
      )}
      <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors">
        {service.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm flex-grow mb-4">
        {service.shortDesc}
      </p>
      {service.features && service.features.length > 0 && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded" style={{ backgroundColor: `var(--${color}, var(--sari-blue))20`, color: `var(--${color}, var(--sari-blue))` }}>
            <CheckCircle className="w-3 h-3" />
            {service.features.length} {t('advantages')}
          </span>
        </div>
      )}
      <span className="font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all" style={{ color: `var(--${color}, var(--sari-blue))` }}>
        {t('learnMore')}
        <ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  );
}