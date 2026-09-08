// components/ui/EmptyState.tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { 
  Inbox, SearchX, Database, ShoppingCart, Mail, Package,
  ArrowRight, ArrowLeft
} from 'lucide-react';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: { label: string; href: string };
  variant?: 'default' | 'compact' | 'large';
  preset?: 'noResults' | 'noData' | 'emptyCart' | 'noMessages' | 'noOrders';
}

// Mapping des icônes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'inbox': Inbox,
  'search-x': SearchX,
  'database': Database,
  'shopping-cart': ShoppingCart,
  'mail': Mail,
  'package': Package,
};

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action = undefined,
  variant = 'default',
  preset = undefined
}: EmptyStateProps) {
  const locale = useLocale();
  const t = useTranslations('components.ui.EmptyState');
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const variants = {
    default: 'bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800',
    compact: 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800',
    large: 'bg-sari-gray dark:bg-[#111111] border-2 border-dashed border-gray-300 dark:border-gray-700'
  };

  const sizes = {
    default: 'py-16 px-8',
    compact: 'py-8 px-6',
    large: 'py-24 px-12'
  };

  const iconSizes = {
    default: 'w-16 h-16',
    compact: 'w-12 h-12',
    large: 'w-24 h-24'
  };

  // Préréglages de traduction pour les cas courants
  const presets = {
    noResults: {
      icon: 'search-x',
      title: t('noResults'),
      description: t('noResultsDesc')
    },
    noData: {
      icon: 'database',
      title: t('noData'),
      description: t('noDataDesc')
    },
    emptyCart: {
      icon: 'shopping-cart',
      title: t('emptyCart'),
      description: t('emptyCartDesc')
    },
    noMessages: {
      icon: 'mail',
      title: t('noMessages'),
      description: t('noMessagesDesc')
    },
    noOrders: {
      icon: 'package',
      title: t('noOrders'),
      description: t('noOrdersDesc')
    }
  };

  // Appliquer le preset si spécifié
  const presetData = preset && presets[preset] ? presets[preset] : null;
  const finalIcon = icon || presetData?.icon || 'inbox';
  const finalTitle = title || presetData?.title || t('noResults');
  const finalDescription = description || presetData?.description || t('noResultsDesc');

  const IconComponent = iconMap[finalIcon] || Inbox;

  return (
    <div className={`${variants[variant]} ${sizes[variant]} rounded-xl text-center`}>
      <div className={`${iconSizes[variant]} bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-6`}>
        <IconComponent className={`${variant === 'large' ? 'w-12 h-12' : 'w-8 h-8'} text-sari-blue`} />
      </div>
      <h3 className={`${variant === 'large' ? 'text-2xl' : 'text-xl'} font-bold text-sari-dark dark:text-white mb-2`}>
        {finalTitle}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        {finalDescription}
      </p>
      {action && (
        <Link
          href={`/${locale}${action.href.replace('#', '')}`}
          className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2"
        >
          {action.label}
          <ArrowIcon className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}