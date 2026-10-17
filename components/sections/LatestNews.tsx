// components/sections/LatestNews.tsx
'use client';

/**
 * Dernières actualités de la page d'accueil : fiches choisies dans le studio,
 * ou les N plus récentes quand la sélection reste en mode automatique.
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import NewsCard from '@/components/cards/NewsCard';
import type { News } from '@/types';
import {
  applySelection,
  limitOf,
  localizeHref,
  setting,
  selectionFor,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import SectionFrame, { gridProps } from '@/components/sections/SectionFrame';

interface LatestNewsProps {
  news: News[];
  count?: number;
  config?: HomeSectionConfig;
}

export default function LatestNews({ news, count = 3, config }: LatestNewsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.LatestNews');

  const source = Array.isArray(news) ? news : [];
  const latest = applySelection(source, selectionFor(config, count), {
    dateOf: (item) => item.publicationDate || item.date,
    titleKey: 'title',
  });

  if (latest.length === 0) return null;

  const grid = gridProps(config, limitOf(config, count), 32);

  return (
    <SectionFrame
      sectionKey="news"
      config={config}
      header={{
        fallbacks: { subtitle: t('subtitle'), title: t('title'), description: t('description') },
        action: setting(config, 'showViewAll', true) ? (
          <Link
            href={localizeHref(config?.settings?.ctaHref, locale, `/${locale}/news`)}
            className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            {txt(config, 'viewAllLabel', t('viewAll'))}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        ) : null,
      }}
    >
      <div {...grid} className={`${grid.className} stagger-children`}>
        {latest.map((item) => (
          <NewsCard key={String(item.id)} news={item} />
        ))}
      </div>
    </SectionFrame>
  );
}
