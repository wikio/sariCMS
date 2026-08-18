// app/[locale]/events/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { CalendarX, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { getEvents } from '@/lib/data';
import { slugify } from '@/lib/slugify'; // ✅ 1. Ajout de l'import slugify
import type { Event } from '@/types';
import Pagination from '@/components/ui/Pagination';

export default function EventsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [events, setEvents] = useState<Event[]>([]);
  const itemsPerPage = 6;
  const locale = useLocale();
  const t = useTranslations('pages.events');
  const isRtl = locale === 'ar';

  useEffect(() => {
    const loadEvents = async () => {
      const data = await getEvents(locale);
      setEvents(data);
    };
    loadEvents();
  }, [locale]);

  const totalPages = Math.ceil(events.length / itemsPerPage);
  const currentItems = events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (events.length === 0) {
    return (
      <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-sari-blue/10 flex items-center justify-center mb-6 rounded-full">
          <CalendarX className="w-12 h-12 text-sari-blue" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('noEventsTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          {t('noEventsDesc')}
        </p>
        <Link href={`/${locale}/contact`} className="btn-primary text-white px-6 py-3 inline-block">
          {t('contactPrivate')}
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen">
      <div className="text-center mb-16">
        <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">
          {t('subtitle')}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2">
          {t('title')}
        </h1>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {currentItems.map((event) => (
          <div key={event.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover overflow-hidden flex flex-col h-full group">
            <div className="relative">
              <img src={event.image} alt={event.title} className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute top-4 left-4 bg-sari-lime text-sari-dark px-3 py-2 font-bold text-center">
                <div className="text-xl leading-none">{event.date.split(' ')[0]}</div>
                <div className="text-xs">{event.date.split(' ')[1]}</div>
              </div>
              <div className="absolute top-4 right-4 bg-sari-dark/80 text-white px-3 py-1 text-xs font-bold uppercase backdrop-blur-sm">{event.type}</div>
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors line-clamp-2">
                {event.title}
              </h3>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-4">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-6 flex-grow">
                {event.shortDesc}
              </p>
              
              {/* ✅ 2. Modification du lien pour inclure le slug et utiliser le dossier "events" */}
              <Link 
                href={`/${locale}/events/${event.id}-${slugify(event.title)}`} 
                className="text-sari-blue font-semibold hover:underline mt-auto inline-flex items-center gap-2"
              >
                {t('viewProgram')}
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Link>
              
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </div>
  );
}