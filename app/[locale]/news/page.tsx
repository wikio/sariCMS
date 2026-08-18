// app/[locale]/news/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Newspaper, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getNews } from '@/lib/data';
import { buildSlugUrl } from '@/lib/slugify';
import type { News } from '@/types';
import Pagination from '@/components/ui/Pagination';

export default function NewsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [news, setNews] = useState<News[]>([]);
  const itemsPerPage = 6;
  const locale = useLocale();
  const t = useTranslations('pages.news');
  const isRtl = locale === 'ar';

  useEffect(() => {
    const loadNews = async () => {
      const data = await getNews(locale);
      setNews(data);
    };
    loadNews();
  }, [locale]);

  const totalPages = Math.ceil(news.length / itemsPerPage);
  const currentItems = news.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (news.length === 0) {
    return (
      <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-sari-blue/10 flex items-center justify-center mb-6 rounded-full">
          <Newspaper className="w-12 h-12 text-sari-blue" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('noNewsTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          {t('noNewsDesc')}
        </p>
        <Link href={`/${locale}`} className="btn-primary text-white px-6 py-3 inline-block rounded-lg">
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen">
      <div className="text-center mb-16">
        <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">
          {t('blogNews')}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2">
          {t('latestNews')}
        </h1>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {currentItems.map(item => (
          <article key={item.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover h-full flex flex-col group rounded-xl overflow-hidden">
            <div className="aspect-[16/9] overflow-hidden relative">
              <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute top-4 left-4 bg-sari-blue text-white px-3 py-1 text-xs font-bold uppercase rounded">
                {item.category}
              </div>
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {item.date}
                </span>
                <span>•</span>
                <span>{item.readTime || '3 min'}</span>
              </div>
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 flex-grow group-hover:text-sari-blue transition-colors line-clamp-2">
                {item.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-4">
                {item.shortDesc}
              </p>
              {/* ✅ LIEN AVEC SLUG SEO */}
              <Link 
                href={buildSlugUrl(`/${locale}/news`, item.id, item.title)} 
                className="text-sari-blue font-semibold hover:underline mt-auto inline-flex items-center gap-2"
              >
                {t('readArticle')}
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Link>
            </div>
          </article>
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </div>
  );
}