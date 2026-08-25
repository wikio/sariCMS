// app/[locale]/evenements/[id]-[slug]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, MapPin, Tag, Users, Clock, Check, UserPlus, 
  CheckCircle, ChevronLeft, ChevronRight, Bell
} from 'lucide-react';
import { getEvents } from '@/lib/data';
import { matchesEntity } from '@/lib/ids';
import { extractLegacyId, findEventTranslation, buildMultilingualUrl } from '@/lib/translation-utils';
import type { Event } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';

export default function EventDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const t = useTranslations('pages.eventDetail');
  const isRtl = locale === 'ar';

  const [event, setEvent] = useState<Event | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);
  const [regFormData, setRegFormData] = useState({ name: '', email: '', phone: '', company: '', notes: '' });

  useEffect(() => {
    const loadEvent = async () => {
      const events = await getEvents(locale);
      setAllEvents(events);
      
      // Essayer d'extraire le legacyId de l'URL
      const legacyId = extractLegacyId(id);
      
      let found: Event | undefined;
      if (legacyId) {
        // Rechercher par legacyId d'abord
        found = events.find((e) => e.legacyId === legacyId);
      }
      
      // Fallback sur la recherche par id/slug si legacyId non trouvé
      if (!found) {
        found = events.find((e) => matchesEntity(e, id));
      }
      
      setEvent(found || null);
    };
    loadEvent();
  }, [id, locale]);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress((winScroll / height) * 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!event?.date) return;
    const dateStr = event.date.split(' - ')[0].split(' ').slice(0, 3).join(' ');
    const eventDate = new Date(dateStr);
    if (isNaN(eventDate.getTime())) return;
    const timer = setInterval(() => {
      const now = new Date();
      const diff = eventDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [event?.date]);

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationSubmitted(true);
    setTimeout(() => {
      setShowRegistrationForm(false);
      setRegistrationSubmitted(false);
      setRegFormData({ name: '', email: '', phone: '', company: '', notes: '' });
    }, 3000);
  };

  if (!event) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center min-h-screen">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 rounded-full">
          <Calendar className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('notFound')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('notFoundDesc')}
        </p>
        <Link href={`/${locale}/evenements`} className="btn-primary text-white px-6 py-3 inline-block">
          {t('backToEvents')}
        </Link>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    'Salon': 'bg-purple-500',
    'Formation': 'bg-blue-500',
    'Conférence': 'bg-indigo-500',
    'Portes Ouvertes': 'bg-green-500',
    'Atelier': 'bg-orange-500',
    'Lancement': 'bg-red-500',
    'Démonstration': 'bg-cyan-500',
    'Webinar': 'bg-pink-500',
    'Interne': 'bg-gray-500',
  };
  const typeColor = typeColors[event.type] || 'bg-sari-blue';

  const relatedEvents = allEvents.filter((e) => e.id !== event.id && e.type === event.type).slice(0, 3);
  const currentIndex = allEvents.findIndex((e) => e.id === event.id);
  const prevEvent = currentIndex > 0 ? allEvents[currentIndex - 1] : null;
  const nextEvent = currentIndex < allEvents.length - 1 ? allEvents[currentIndex + 1] : null;

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <PageVisibilityGuard visibilityKey="module.events">
    <div className="pt-32 pb-24 min-h-screen">
      {/* Barre de progression */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 z-50">
        <div className="h-full bg-sari-blue transition-all duration-150" style={{ width: `${scrollProgress}%` }}></div>
      </div>

      {/* Header avec image */}
      <div className="relative h-[500px] md:h-[600px] overflow-hidden">
        <img src={event.image} alt={event.title} className="w-full h-full object-cover parallax-slow" />
        <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/70 to-transparent"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
          <div className="max-w-4xl">
            <span className={`inline-block px-4 py-2 ${typeColor} text-white font-semibold text-sm uppercase tracking-wider mb-4`}>
              {event.type}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {event.title}
            </h1>
            <div className="flex flex-wrap items-center gap-6 text-gray-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sari-lime" />
                <span className="font-semibold">{event.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-sari-lime" />
                <span>{event.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown */}
      {timeLeft.days > 0 && (
        <div className="bg-sari-blue text-white py-8">
          <div className="container mx-auto px-6">
            <div className="text-center mb-4">
              <span className="text-sm uppercase tracking-wider text-blue-100">
                {t('countdownLabel')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { value: timeLeft.days, label: t('days') },
                { value: timeLeft.hours, label: t('hours') },
                { value: timeLeft.minutes, label: t('minutes') },
                { value: timeLeft.seconds, label: t('seconds') },
              ].map((item, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm p-4 text-center">
                  <div className="text-3xl md:text-4xl font-bold">{String(item.value).padStart(2, '0')}</div>
                  <div className="text-xs text-blue-100 uppercase mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="container mx-auto px-6 py-16">
        <Breadcrumb items={[
          { label: t('breadcrumbHome'), href: '/' },
          { label: t('breadcrumbEvents'), href: '/events' },
          { label: event.type },
        ]} />

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            {/* Description */}
            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl mb-8">
              <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-6">
                {t('aboutTitle')}
              </h2>
              <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed"
                dangerouslySetInnerHTML={{ __html: event.fullContent }} />
            </div>

            {/* Programme */}
            {event.agenda && event.agenda.length > 0 && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl mb-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-sari-blue flex items-center justify-center rounded-lg">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-sari-dark dark:text-white">
                      {t('programTitle')}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {t('programDesc')}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-sari-blue/30"></div>
                  <div className="space-y-6">
                    {event.agenda.map((item, i) => {
                      const [time, ...descParts] = item.split(':');
                      const desc = descParts.join(':').trim();
                      return (
                        <div key={i} className="relative flex gap-6 group">
                          <div className="relative z-10 w-12 h-12 bg-sari-blue flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg rounded-full">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 bg-gray-50 dark:bg-[#111111] p-6 border border-gray-200 dark:border-gray-800 hover:border-sari-blue transition-colors rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-sari-blue text-white px-3 py-1 font-bold text-sm rounded">
                                {time.trim()}
                              </span>
                            </div>
                            <p className="text-lg font-semibold text-sari-dark dark:text-white">{desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Informations pratiques */}
            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl mb-8">
              <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-8">
                {t('practicalTitle')}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { icon: Calendar, title: t('date'), value: event.date },
                  { icon: MapPin, title: t('location'), value: event.location },
                  { icon: Tag, title: t('type'), value: event.type },
                  { icon: Users, title: t('audience'), value: t('audienceValue') },
                ].map((info, i) => {
                  const Icon = info.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 p-4 bg-sari-blue/5 border border-sari-blue/20 rounded-lg">
                      <div className="w-12 h-12 bg-sari-blue flex items-center justify-center flex-shrink-0 rounded-lg">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sari-dark dark:text-white mb-1">{info.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{info.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation précédent/suivant */}
            {(prevEvent || nextEvent) && (
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {prevEvent ? (
                  <Link href={buildMultilingualUrl(`/${locale}/evenements`, prevEvent.legacyId || String(prevEvent.id), prevEvent.slug)} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 hover:border-sari-blue transition-all group rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <PrevIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      {t('prevEvent')}
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2">
                      {prevEvent.title}
                    </h3>
                  </Link>
                ) : <div></div>}
                {nextEvent ? (
                  <Link href={buildMultilingualUrl(`/${locale}/evenements`, nextEvent.legacyId || String(nextEvent.id), nextEvent.slug)} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 hover:border-sari-blue transition-all group text-right rounded-lg">
                    <div className="flex items-center justify-end gap-2 text-sm text-gray-500 mb-2">
                      {t('nextEvent')}
                      <NextIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2">
                      {nextEvent.title}
                    </h3>
                  </Link>
                ) : <div></div>}
              </div>
            )}

            {/* Événements similaires */}
            {relatedEvents.length > 0 && (
              <div>
                <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-8">
                  {t('similarTitle')}
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {relatedEvents.map((ev) => (
                    <Link key={ev.id} href={buildMultilingualUrl(`/${locale}/evenements`, ev.legacyId || String(ev.id), ev.slug)} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover overflow-hidden group rounded-lg">
                      <div className="aspect-video overflow-hidden relative">
                        <img src={ev.image} alt={ev.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className={`absolute top-4 left-4 ${typeColors[ev.type] || 'bg-sari-blue'} text-white px-3 py-1 text-xs font-bold uppercase rounded`}>
                          {ev.type}
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-sari-dark dark:text-white mb-2 line-clamp-2 group-hover:text-sari-blue transition-colors">
                          {ev.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>{ev.date}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Bouton d'inscription */}
            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl sticky top-32 rounded-lg">
              <h3 className="text-2xl font-bold text-sari-dark dark:text-white mb-4 text-center">
                {t('participateTitle')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">
                {event.type === 'Webinar' ? t('webinarNote') : t('limitedNote')}
              </p>
              {!showRegistrationForm ? (
                <button onClick={() => setShowRegistrationForm(true)} className="w-full btn-primary text-white py-4 font-semibold shadow-lg flex items-center justify-center gap-2 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                  {t('registerBtn')}
                </button>
              ) : (
                <form onSubmit={handleRegistration} className="space-y-4">
                  {registrationSubmitted ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 p-6 text-center rounded-lg">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <h4 className="font-bold text-green-700 dark:text-green-400">
                        {t('successTitle')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {t('successDesc')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <input type="text" required placeholder={t('name')} value={regFormData.name} onChange={(e) => setRegFormData({ ...regFormData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                      <input type="email" required placeholder={t('email')} value={regFormData.email} onChange={(e) => setRegFormData({ ...regFormData, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                      <input type="tel" placeholder={t('phone')} value={regFormData.phone} onChange={(e) => setRegFormData({ ...regFormData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                      <input type="text" placeholder={t('company')} value={regFormData.company} onChange={(e) => setRegFormData({ ...regFormData, company: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                      <textarea rows={3} placeholder={t('notes')} value={regFormData.notes} onChange={(e) => setRegFormData({ ...regFormData, notes: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none resize-none rounded-lg"></textarea>
                      <button type="submit" className="w-full btn-primary text-white py-4 font-semibold shadow-lg rounded-lg">
                        {t('confirmBtn')}
                      </button>
                      <button type="button" onClick={() => setShowRegistrationForm(false)} className="w-full text-gray-500 hover:text-sari-dark dark:hover:text-white text-sm">
                        {t('cancel')}
                      </button>
                    </>
                  )}
                </form>
              )}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('question')}
                </p>
                <Link href={`/${locale}/contact`} className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2">
                  {t('contactUs')} <NextIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Partager */}
            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-lg">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-6">
                {t('shareTitle')}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <button className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </button>
                <button className="w-full h-10 bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
                <button className="w-full h-10 bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </button>
                <button className="w-full h-10 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </button>
              </div>
            </div>

            {/* Rappel */}
            <div className="bg-sari-lime/10 dark:bg-sari-lime/20 border-2 border-sari-lime p-6 rounded-lg">
              <div className="flex items-start gap-3">
                <Bell className="w-6 h-6 text-sari-lime flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-sari-dark dark:text-white mb-1">
                    {t('reminderTitle')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('reminderDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageVisibilityGuard>
  );
}