// components/sections/LatestEvents.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import EventCard from '@/components/cards/EventCard';
import type { Event } from '@/types';

interface LatestEventsProps {
  events: Event[];
  count?: number;
}

export default function LatestEvents({ events, count = 3 }: LatestEventsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.LatestEvents');

  const latest = events.slice(0, count);

  if (latest.length === 0) return null;

  return (
    <section className="py-24 bg-white dark:bg-[#1a1a1a]">
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
            href={`/${locale}/events`}
            className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            {t('viewAll')}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>

        {/* Grille d'événements */}
        <div className="grid md:grid-cols-3 gap-8">
          {latest.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}