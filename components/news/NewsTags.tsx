'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Hash, Tags } from 'lucide-react';
import { newsGroupValues, newsListHref } from '@/lib/news-groups';
import type { News } from '@/types';

/** Un lien normal par tag réel : même URL que le filtre de la liste et le sous-menu. */
function TagLinks({ tags, locale }: { tags: string[]; locale: string }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag} className="min-w-0 max-w-full">
          <Link href={newsListHref(locale, { by: 'tag', value: tag })}
            className="inline-flex min-h-10 max-w-full items-center rounded-full border border-sari-blue/30 bg-sari-blue/5 px-3.5 py-1.5 text-sm font-semibold text-cyan-800 hover:border-sari-blue hover:bg-sari-blue/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sari-blue motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 dark:bg-sari-blue/10 dark:text-cyan-300">
            <bdi className="[overflow-wrap:anywhere]">#{tag}</bdi>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const moreLink = 'mt-2 inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-cyan-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sari-blue dark:text-cyan-300';

export function ArticleTags({ article, popular, locale }: { article: News; popular: string[]; locale: string }) {
  const t = useTranslations('pages.newsDetail');
  const own = newsGroupValues(article, 'tag');
  const suggestions = !own.length && popular.length > 0;
  const displayed = own.length ? own : popular.slice(0, 3);
  const category = article.category?.trim();
  const type = article.classification?.trim();

  return (
    <section aria-labelledby="article-tags-title" className="mb-8 border-t border-gray-200 pt-6 dark:border-gray-800">
      <h3 id="article-tags-title" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sari-dark dark:text-white">
        <Tags aria-hidden="true" className="size-4 text-cyan-700 dark:text-cyan-300" />{t('tags')}
      </h3>
      {!own.length && (
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{suggestions ? t('suggestedTags') : t('noArticleTags')}</p>
      )}
      {displayed.length ? <TagLinks tags={displayed} locale={locale} /> : (
        <Link className={moreLink} href={newsListHref(locale, category ? { by: 'category', value: category } : type ? { by: 'type', value: type } : null)}>
          {category ? t('browseCategory', { value: category }) : type ? t('browseType', { value: type }) : t('backToNews')}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
        </Link>
      )}
    </section>
  );
}

export function PopularTags({ tags, locale }: { tags: string[]; locale: string }) {
  const t = useTranslations('pages.newsDetail');
  return (
    <section aria-labelledby="popular-tags-title" className="rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-[#1a1a1a] sm:p-8">
      <h3 id="popular-tags-title" className="mb-4 flex items-center gap-3 text-xl font-bold text-sari-dark dark:text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sari-blue/10 text-cyan-800 dark:text-cyan-300"><Hash aria-hidden="true" className="size-5" /></span>
        {t('popularTags')}
      </h3>
      {tags.length ? <TagLinks tags={tags} locale={locale} /> : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('noPopularTags')}</p>
          <Link className={moreLink} href={newsListHref(locale)}>
            {t('backToNews')}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
          </Link>
        </>
      )}
    </section>
  );
}
