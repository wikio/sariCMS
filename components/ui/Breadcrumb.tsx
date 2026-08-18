// components/ui/Breadcrumb.tsx
'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Home, ChevronRight, ChevronLeft } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items = [], className = '' }: BreadcrumbProps) {
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

  if (!items || items.length === 0) return null;

  return (
    <nav className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* Lien ou texte */}
          {item.href ? (
            <Link
              href={`/${locale}${item.href.replace('#', '')}`}
              className="hover:text-sari-blue transition-colors flex items-center gap-1"
            >
              {/* Icône maison pour le premier élément (Accueil) */}
              {index === 0 && <Home className="w-4 h-4" />}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span className="text-sari-dark dark:text-white font-semibold flex items-center gap-1">
              {item.icon && <Home className="w-4 h-4" />}
              <span>{item.label}</span>
            </span>
          )}

          {/* Séparateur (flèche dynamique) - sauf pour le dernier élément */}
          {index < items.length - 1 && (
            <ArrowIcon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-600" />
          )}
        </div>
      ))}
    </nav>
  );
}