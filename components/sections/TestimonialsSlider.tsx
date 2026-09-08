// components/sections/TestimonialsSlider.tsx
'use client';

/**
 * Témoignages de la page d'accueil.
 *
 * Le studio choisit les témoignages (image de l'auteur comprise, via le champ
 * `image` du module témoignages), l'ordre — manuel, mieux notés, plus récents —
 * et la présentation : défilement avec flèches et points, ou grille.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import type { Testimonial } from '@/types';
import {
  applySelection,
  limitOf,
  numberSetting,
  setting,
  selectionFor,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import SectionFrame from '@/components/sections/SectionFrame';

interface TestimonialsSliderProps {
  testimonials: Testimonial[];
  count?: number;
  config?: HomeSectionConfig;
}

export default function TestimonialsSlider({ testimonials, count = 6, config }: TestimonialsSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const t = useTranslations('components.sections.TestimonialsSlider');
  const tCard = useTranslations('components.cards.TestimonialCard');

  const source = Array.isArray(testimonials) ? testimonials : [];
  const items = applySelection(source, selectionFor(config, count), {
    titleKey: 'name',
    ratingKey: 'rating',
  });

  const layout = String(setting<string>(config, 'layout', 'slider')) === 'grid' ? 'grid' : 'slider';
  const autoplay = layout === 'slider' && setting(config, 'autoplay', true);
  const interval = Math.max(2000, numberSetting(config, 'interval', 5000));
  const showRating = setting(config, 'showRating', true);
  const showAvatar = setting(config, 'showAvatar', true);
  const showClinic = setting(config, 'showClinic', true);
  const showDots = layout === 'slider' && setting(config, 'showDots', true);
  const showArrows = layout === 'slider' && setting(config, 'showArrows', true);
  const perRow = Math.max(1, Math.min(3, numberSetting(config, 'columns', 2)));

  const next = useCallback(() => setCurrentSlide((prev) => (items.length ? (prev + 1) % items.length : 0)), [items.length]);

  // Défilement automatique : arrêté dès que la souris entre dans le bloc.
  useEffect(() => {
    if (!autoplay || paused || items.length < 2) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [autoplay, paused, interval, next, items.length]);

  useEffect(() => {
    if (currentSlide >= items.length) setCurrentSlide(0);
  }, [currentSlide, items.length]);

  if (items.length === 0) return null;

  const previous = () => setCurrentSlide((prev) => (prev === 0 ? items.length - 1 : prev - 1));

  const card = (testimonial: Testimonial) => (
    <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all h-full">
      {showRating ? (
        <div className="flex items-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-5 h-5 ${
                i < testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
              }`}
            />
          ))}
          <span className={`${isRtl ? 'mr-2' : 'ml-2'} text-sm text-gray-500 dark:text-gray-400`}>
            {tCard('rating')}: {testimonial.rating}/5
          </span>
        </div>
      ) : null}

      <div className="relative mb-6">
        <Quote className={`absolute -top-2 ${isRtl ? '-right-2' : '-left-2'} w-8 h-8 text-sari-blue/20`} />
        <p className={`text-gray-600 dark:text-gray-300 italic text-lg leading-relaxed ${isRtl ? 'pr-6' : 'pl-6'}`}>“{testimonial.text}”</p>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700 mb-4"></div>

      <div className="flex items-center gap-4">
        {showAvatar && testimonial.image ? (
          <div className="relative">
            <img src={testimonial.image} alt={testimonial.name} className="w-14 h-14 rounded-full object-cover border-2 border-sari-blue" />
            <div className={`absolute -bottom-1 ${isRtl ? '-left-1' : '-right-1'} bg-sari-lime rounded-full p-0.5`}>
              <svg className="w-4 h-4 text-sari-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        ) : null}
        <div>
          <div className="font-bold text-sari-dark dark:text-white text-lg">{testimonial.name}</div>
          <div className="text-sari-blue text-sm">{testimonial.role}</div>
          {showClinic && testimonial.clinic ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">{testimonial.clinic}</div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <SectionFrame
      sectionKey="testimonials"
      config={config}
      header={{
        align: 'center',
        fallbacks: { subtitle: t('subtitle'), title: t('title'), description: t('description') },
      }}
    >
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {layout === 'grid' ? (
          <div
            className="grid gap-8 grid-cols-1 md:[grid-template-columns:repeat(var(--hs-cols,2),minmax(0,1fr))] stagger-children"
            style={{ ['--hs-cols' as string]: String(perRow) }}
          >
            {items.slice(0, limitOf(config, count)).map((testimonial) => (
              <div key={String(testimonial.id)} dir={isRtl ? 'rtl' : 'ltr'}>
                {card(testimonial)}
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto relative" dir="ltr">
            <div className="overflow-hidden">
              <div
                className="testimonial-track flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {items.map((testimonial) => (
                  <div key={String(testimonial.id)} className="w-full flex-shrink-0 px-4">
                    <div dir={isRtl ? 'rtl' : 'ltr'}>{card(testimonial)}</div>
                  </div>
                ))}
              </div>
            </div>

            {showArrows && items.length > 1 ? (
              <>
                <button
                  onClick={previous}
                  className="absolute top-1/2 -translate-y-1/2 -left-4 md:-left-6 z-10 w-12 h-12 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-sari-blue hover:text-white hover:border-sari-blue transition-all group"
                  aria-label={t('previous')}
                >
                  <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={next}
                  className="absolute top-1/2 -translate-y-1/2 -right-4 md:-right-6 z-10 w-12 h-12 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-sari-blue hover:text-white hover:border-sari-blue transition-all group"
                  aria-label={t('next')}
                >
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </>
            ) : null}

            {showDots && items.length > 1 ? (
              <div className="flex justify-center gap-3 mt-8">
                {items.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`transition-all rounded-full ${
                      idx === currentSlide ? 'bg-sari-blue w-8 h-3' : 'bg-gray-300 dark:bg-gray-600 w-3 h-3 hover:bg-sari-blue/50'
                    }`}
                    aria-label={t('testimonialNumber', { number: idx + 1 })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
      {txt(config, 'footnote') ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">{txt(config, 'footnote')}</p>
      ) : null}
    </SectionFrame>
  );
}
