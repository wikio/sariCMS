// components/sections/LatestNews.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import NewsCard from '@/components/cards/NewsCard';
import type { News } from '@/types';

interface LatestNewsProps {
  news: News[];
  count?: number;
}

export default function LatestNews({ news, count = 3 }: LatestNewsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.LatestNews');

  const latest = news.slice(0, count);

  if (latest.length === 0) return null;

  return (
    <section className="py-24 bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        {/* Titre de section */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
          <div>
            <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
              {t('subtitle')}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-4 mb-4">
              {t('title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
              {t('description')}
            </p>
          </div>
          <Link
            href={`/${locale}/news`}
            className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            {t('viewAll')}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>

        {/* Grille d'actualités */}
        <div className="grid md:grid-cols-3 gap-8">
          {latest.map((item) => (
            <NewsCard key={item.id} news={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
