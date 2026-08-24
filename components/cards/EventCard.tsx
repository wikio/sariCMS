// components/cards/EventCard.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Calendar, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import { slugify } from '@/lib/slugify';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event;
  variant?: 'standard' | 'horizontal';
}

export default function EventCard({ event, variant = 'standard' }: EventCardProps) {
  const locale = useLocale();
  const t = useTranslations('components.cards.EventCard');
  const isRtl = locale === 'ar';

  // ✅ URL avec slug SEO
  const eventUrl = `/${locale}/events/${event.id}-${slugify(event.title)}`;

  // Déterminer la couleur du badge selon le type
  const typeColors: Record<string, string> = {
    'Salon': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    'Formation': 'bg-sari-blue/10 text-sari-blue',
    'Conférence': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    'Portes Ouvertes': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    'Atelier': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    'Lancement': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    'Démonstration': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    'Webinar': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  };

  const badgeClass = typeColors[event.type] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';

  // Extraire le jour et le mois de la date
  const dateParts = event.date.split(' ');
  const day = dateParts[0];
  const month = dateParts[1] || '';

  // === Variante HORIZONTAL ===
  if (variant === 'horizontal') {
    return (
      <Link
        href={eventUrl}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all cursor-pointer overflow-hidden group flex flex-col md:flex-row"
      >
        <div className="relative md:w-64 h-48 md:h-auto overflow-hidden flex-shrink-0">
          {event.image ? (
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
              <Calendar className="w-16 h-16" />
            </div>
          )}
          <div className="absolute top-4 left-4">
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${badgeClass}`}>
              {event.type}
            </span>
          </div>
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{event.date}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-4">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">
            {event.shortDesc}
          </p>
          <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
            {t('learnMore')}
            {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </div>
      </Link>
    );
  }

  // === Variante STANDARD (par défaut) ===
  return (
    <Link
      href={eventUrl}
      className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all cursor-pointer overflow-hidden group h-full flex flex-col"
    >
      <div className="relative h-48 overflow-hidden">
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
            <Calendar className="w-16 h-16" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${badgeClass}`}>
            {event.type}
          </span>
        </div>
        <div className="absolute top-4 right-4 bg-sari-lime text-sari-dark px-3 py-2 font-bold text-center rounded">
          <div className="text-xl leading-none">{day}</div>
          <div className="text-xs">{month}</div>
        </div>
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors line-clamp-2">
          {event.title}
        </h3>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-3">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>{event.date}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-4">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="line-clamp-1">{event.location}</span>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">
          {event.shortDesc}
        </p>
        <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
          {t('learnMore')}
          {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </div>
    </Link>
  );
}