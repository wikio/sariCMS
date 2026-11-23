// app/[locale]/news/page.tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Newspaper, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getNews } from '@/lib/data';
import { entityUrl } from '@/lib/entity-url';
import type { News } from '@/types';
import Pagination from '@/components/ui/Pagination';
import NewsFilters from '@/components/news/NewsFilters';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useDateUtils } from '@/lib/use-date-format';
import { groupKey, newsGroupValues, newsListHref, readNewsFilter } from '@/lib/news-groups';

const ITEMS_PER_PAGE = 6;

function NewsLoading() {
  const t = useTranslations('pages.news');
  return <p role="status" className="pt-44 text-center min-h-screen">{t('loading')}</p>;
}

export default function NewsPage() {
  const locale = useLocale();
  return (
    <PageVisibilityGuard visibilityKey="module.news">
      <Suspense fallback={<NewsLoading />}>
        <NewsList key={locale} locale={locale} />
      </Suspense>
    </PageVisibilityGuard>
  );
}

function NewsList({ locale }: { locale: string }) {
  const [news, setNews] = useState<News[] | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const { formatDate } = useDateUtils();
  const t = useTranslations('pages.news');
  const isRtl = locale === 'ar';

  useEffect(() => {
    let current = true;
    getNews(locale).then((data) => { if (current) setNews(data); });
    return () => { current = false; };
  }, [locale]);

  if (!news) return <NewsLoading />;
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

  // L’URL est la source de vérité : changer de sous-menu, effacer le filtre ou
  // revenir en arrière n’a pas à synchroniser trois états React concurrents.
  const filter = readNewsFilter(params);
  const key = filter ? groupKey(filter.value) : '';
  const filtered = filter
    ? news.filter((article) => newsGroupValues(article, filter.by).some((value) => groupKey(value) === key))
    : news;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const requested = Number(params.get('page'));
  const currentPage = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, totalPages || 1) : 1;
  const currentItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen">
      <div className="text-center mb-8 sm:mb-10">
        <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">
          {t('blogNews')}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2">
          {t('latestNews')}
        </h1>
      </div>

      <NewsFilters articles={news} locale={locale} filter={filter} count={filtered.length} />

      {filter && !filtered.length && (
        <p role="status" className="text-center text-gray-600 dark:text-gray-400">{t('noMatches', { value: filter.value })}</p>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {currentItems.map(item => (
          <article key={item.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover h-full flex flex-col group rounded-xl overflow-hidden">
            <div className="aspect-[16/9] overflow-hidden relative">
              <ImageWithFallback
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                fallbackIcon="calendar"
                placeholderSize="lg"
              />
              {item.category?.trim() && (
                <Link
                  href={newsListHref(locale, { by: 'category', value: item.category })}
                  className="absolute top-4 start-4 bg-sari-blue text-white px-3 py-1 text-xs font-bold uppercase rounded hover:bg-sari-blue/80 transition-colors"
                >
                  {item.category}
                </Link>
              )}
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(item.date, locale, { format: 'medium' })}
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
              <Link
                href={entityUrl(locale, 'news', item)}
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
        <Pagination currentPage={currentPage} totalPages={totalPages}
          onPageChange={(page) => router.push(newsListHref(locale, filter, page), { scroll: false })} />
      )}
    </div>
  );
}
