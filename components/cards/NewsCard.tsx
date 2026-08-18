// components/cards/NewsCard.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
import { slugify } from '@/lib/slugify';
import type { News } from '@/types';

interface NewsCardProps {
  news: News;
  variant?: 'standard' | 'horizontal';
}

export default function NewsCard({ news, variant = 'standard' }: NewsCardProps) {
  const locale = useLocale();
  const t = useTranslations('components.cards.NewsCard');
  const isRtl = locale === 'ar';

  // ✅ URL avec slug SEO
  const newsUrl = `/${locale}/news/${news.id}-${slugify(news.title)}`;

  // === Variante HORIZONTAL ===
  if (variant === 'horizontal') {
    return (
      <Link
        href={newsUrl}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all cursor-pointer overflow-hidden group flex flex-col md:flex-row"
      >
        <div className="relative md:w-64 h-48 md:h-auto overflow-hidden flex-shrink-0">
          <img
            src={news.image}
            alt={news.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute top-4 left-4 bg-sari-blue text-white px-3 py-1 text-xs font-bold uppercase rounded">
            {news.category}
          </div>
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {news.date}
            </span>
            <span>•</span>
            <span>{news.readTime || '3 min'}</span>
          </div>
          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors line-clamp-2">
            {news.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">
            {news.shortDesc}
          </p>
          <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
            {t('readArticle')}
            {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </div>
      </Link>
    );
  }

  // === Variante STANDARD (par défaut) ===
  return (
    <Link
      href={newsUrl}
      className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all cursor-pointer overflow-hidden group h-full flex flex-col"
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={news.image}
          alt={news.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 left-4 bg-sari-blue text-white px-3 py-1 text-xs font-bold uppercase rounded">
          {news.category}
        </div>
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {news.date}
          </span>
          <span>•</span>
          <span>{news.readTime || '3 min'}</span>
        </div>
        <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors line-clamp-2">
          {news.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-4 flex-grow">
          {news.shortDesc}
        </p>
        <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
          {t('readArticle')}
          {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </div>
    </Link>
  );
}