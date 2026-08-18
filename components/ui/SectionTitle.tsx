// components/ui/SectionTitle.tsx
'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface SectionTitleAction {
  label: string;
  href: string;
}

interface SectionTitleProps {
  subtitle?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center' | 'right';
  action?: SectionTitleAction;
}

export default function SectionTitle({
  subtitle,
  title,
  description,
  align = 'center',
  action = null,
}: SectionTitleProps) {
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

  const alignments = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const actionAlignments = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div className={`mb-12 ${alignments[align]}`}>
      {subtitle && (
        <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">
          {subtitle}
        </span>
      )}
      <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2 mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {description}
        </p>
      )}
      {action && (
        <div className={`flex ${actionAlignments[align]} mt-6`}>
          <Link
            href={`/${locale}${action.href.replace('#', '')}`}
            className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2"
          >
            {action.label}
            <ArrowIcon className="w-5 h-5" />
          </Link>
        </div>
      )}
    </div>
  );
}