'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, FileText, Hash, Layers, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { collectNewsGroups, groupKey, newsListHref, type NewsFilter } from '@/lib/news-groups';
import type { News } from '@/types';

const FIELDS = [
  { by: 'category', label: 'filterCategory', all: 'allCategories', icon: Layers },
  { by: 'type', label: 'filterType', all: 'allTypes', icon: FileText },
  { by: 'tag', label: 'filterTag', all: 'allTags', icon: Hash },
] as const;

export default function NewsFilters({ articles, locale, filter, count }: {
  articles: News[]; locale: string; filter: NewsFilter | null; count: number;
}) {
  const t = useTranslations('pages.news');
  const router = useRouter();
  // Calculer les choix sur tout le catalogue, pas sur la tranche de résultats affichée.
  const fields = useMemo(() => FIELDS.map((field) => ({
    ...field, values: collectNewsGroups(articles, field.by),
  })), [articles]);
  const activeKey = filter ? groupKey(filter.value) : '';
  const visible = fields.filter(({ by, values }) => values.length || by === filter?.by);
  if (!visible.length) return null;

  return (
    <section aria-labelledby="news-filters-title" className="relative mb-10 rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_38px_-26px_rgba(12,99,127,0.45)] dark:border-gray-700 dark:bg-[#1a1a1a] sm:p-6">
      <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-sari-blue via-sari-blue to-sari-lime rtl:bg-gradient-to-l sm:inset-x-8" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sari-blue/10 text-cyan-800 dark:text-cyan-300">
            <SlidersHorizontal aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="news-filters-title" className="text-lg font-bold leading-tight text-sari-dark dark:text-white">{t('filterTitle')}</h2>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{t('filterHint')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span role="status" aria-atomic="true" className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <span aria-hidden="true" className="size-2 rounded-full bg-sari-lime" />
            <span key={count} className="motion-safe:animate-scale-in motion-safe:[animation-duration:180ms]">{t('resultCount', { count })}</span>
          </span>
          {filter && (
            <Link href={newsListHref(locale)} scroll={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-cyan-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sari-blue dark:text-cyan-300">
              <RotateCcw aria-hidden="true" className="size-4" />{t('clearFilter')}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
        {visible.map(({ by, values, icon: Icon, label, all }) => {
          const active = filter?.by === by;
          const selected = active ? values.find((value) => groupKey(value) === activeKey) : undefined;
          const id = `news-filter-${by}`;
          return (
            <div key={by} className="group relative min-w-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5">
              <label htmlFor={id} className="pointer-events-none absolute start-14 top-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{t(label)}</label>
              <select
                id={id} name={by} value={selected ?? (active ? filter.value : '')}
                onChange={(event) => {
                  const value = event.target.value;
                  router.push(newsListHref(locale, value ? { by, value } : null), { scroll: false });
                }}
                className={`block h-16 w-full cursor-pointer appearance-none truncate rounded-xl border pb-2 pe-9 ps-14 pt-7 text-base font-bold leading-5 text-sari-dark hover:border-sari-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sari-blue motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200 sm:text-sm dark:text-white dark:[color-scheme:dark] ${active
                  ? 'border-sari-blue bg-cyan-50 shadow-sm dark:bg-cyan-950'
                  : 'border-gray-200 bg-gray-50 hover:shadow-sm dark:border-gray-700 dark:bg-[#202020] dark:hover:border-sari-blue'}`}
              >
                <option value="">{t(all)}</option>
                {active && !selected && <option value={filter.value}>{filter.value}</option>}
                {values.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 start-3 my-auto flex size-8 items-center justify-center rounded-lg motion-safe:transition-colors ${active
                ? 'bg-cyan-800 text-white dark:bg-cyan-300 dark:text-gray-900'
                : 'bg-white text-cyan-800 ring-1 ring-gray-200 group-hover:bg-sari-blue/10 dark:bg-gray-800 dark:text-cyan-300 dark:ring-gray-700'}`}>
                <Icon className="size-4" />
              </span>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-700 motion-safe:transition-transform motion-safe:group-hover:-translate-y-1/4 dark:text-gray-400 dark:group-focus-within:text-cyan-300" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
