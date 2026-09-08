// components/cards/ServiceCard.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Package } from 'lucide-react';
import IconMark from '@/components/admin/IconMark';
import { resolveColor, withAlpha } from '@/lib/colors';
import { entityUrl } from '@/lib/entity-url';
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

  // URL « id-slug » homogène dans les trois langues. L'ancienne forme
  // `slug || id` produisait /fr/services/1 (pas de slug en FR) mais
  // /en/services/mon-slug (slug sans id) : deux formats incompatibles, et un
  // id seul ne dit pas au sélecteur de langue quelle fiche cible.
  const serviceUrl = entityUrl(locale, 'services', service);
  // Le jeton stocké ('sari-blue', 'red-500', '#0f766e'…) est résolu en couleur
  // réelle : les variables CSS --sari-* n'existent pas dans la feuille de style.
  const accent = resolveColor(service.color);
  const accentSoft = withAlpha(service.color, 0.12);
  // Sur une photo, une pastille translucide laisse transparaître l'image et
  // rend l'icône illisible : le badge posé sur l'illustration reste opaque.
  const accentSoftSolid = '#ffffff';

  // === Variante COMPACT ===
  if (variant === 'compact') {
    return (
      <Link
        href={serviceUrl}
        onClick={handleClick}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
      >
        {service.image ? (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
            <img src={service.image} alt={service.title} className="w-full h-full object-cover" />
            <span
              className="absolute bottom-0 right-0 w-5 h-5 rounded-tl-md flex items-center justify-center"
              style={{ backgroundColor: accentSoftSolid }}
            >
              <IconMark name={service.icon} fallback="wrench" className="w-3 h-3" color={accent} />
            </span>
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: accentSoft }}>
            <IconMark name={service.icon} fallback="wrench" className="w-6 h-6 transition-colors" style={{ color: accent }} />
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
        // L'image seule masquait l'icône de la fiche : les quatre services ont
        // une illustration, donc les icônes enregistrées en base n'étaient
        // visibles nulle part. Le badge les réaffiche, aux couleurs de la fiche.
        <div className="relative w-full h-40 rounded-lg overflow-hidden mb-6">
          <img src={service.image} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          <span
            className="absolute bottom-2 left-2 w-10 h-10 rounded-lg flex items-center justify-center shadow-md ring-1 ring-black/5 backdrop-blur-sm"
            style={{ backgroundColor: accentSoftSolid }}
          >
            <IconMark name={service.icon} fallback="wrench" className="w-5 h-5" color={accent} />
          </span>
        </div>
      ) : (
        <div className="w-14 h-14 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform rounded-lg" style={{ backgroundColor: accentSoft }}>
          <IconMark name={service.icon} fallback="wrench" className="w-7 h-7 transition-colors" style={{ color: accent }} />
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
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded" style={{ backgroundColor: accentSoft, color: accent }}>
            <CheckCircle className="w-3 h-3" />
            {service.features.length} {t('advantages')}
          </span>
        </div>
      )}
      <span className="font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all" style={{ color: accent }}>
        {t('learnMore')}
        <ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  );
}