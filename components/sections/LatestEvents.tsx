// components/sections/LatestEvents.tsx
'use client';

/**
 * Événements de la page d'accueil.
 *
 * Le studio permet de choisir les fiches (dans l'ordre voulu) ou de laisser le
 * site prendre les N plus récents, d'imposer « à venir seulement », et de régler
 * titre, description, nombre et bouton « tout voir ».
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import EventCard from '@/components/cards/EventCard';
import type { Event } from '@/types';
import {
  applySelection,
  boolSetting,
  limitOf,
  localizeHref,
  numberSetting,
  setting,
  selectionFor,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import SectionFrame, { gridProps } from '@/components/sections/SectionFrame';

interface LatestEventsProps {
  events: Event[];
  count?: number;
  config?: HomeSectionConfig;
}

export default function LatestEvents({ events, count = 3, config }: LatestEventsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.LatestEvents');

  const source = Array.isArray(events) ? events : [];
  const selection = { ...selectionFor(config, count), upcomingOnly: boolSetting(config, 'upcomingOnly', false) };
  const latest = applySelection(source, selection, {
    dateOf: (event) => event.startDate || event.date,
    titleKey: 'title',
  });

  if (latest.length === 0) return null;

  const columns = Math.max(1, Math.min(4, latest.length));
  const grid = gridProps(config, numberSetting(config, 'columns', columns), 32);

  return (
    <SectionFrame
      sectionKey="events"
      config={config}
      header={{
        fallbacks: { subtitle: t('subtitle'), title: t('title'), description: t('description') },
        action: setting(config, 'showViewAll', true) ? (
          <Link
            href={localizeHref(config?.settings?.ctaHref, locale, `/${locale}/events`)}
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
      <div {...grid} className={`${grid.className} stagger-children`} style={{ ...grid.style, ['--hs-cols' as string]: String(limitOf(config, count)) }}>
        {latest.map((event) => (
          <EventCard key={String(event.id)} event={event} />
        ))}
      </div>
    </SectionFrame>
  );
}
