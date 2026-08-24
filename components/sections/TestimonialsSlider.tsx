// components/sections/TestimonialsSlider.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Testimonial } from '@/types';

interface TestimonialsSliderProps {
  testimonials: Testimonial[];
}

export default function TestimonialsSlider({ testimonials }: TestimonialsSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const t = useTranslations('components.sections.TestimonialsSlider');
  const tCard = useTranslations('components.cards.TestimonialCard');

  // Auto-play
  useEffect(() => {
    if (testimonials.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % testimonials.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [testimonials.length]);

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % testimonials.length);
  };

  if (testimonials.length === 0) return null;

  return (
    <section className="py-24 bg-sari-gray dark:bg-[#111111] relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
            {t('subtitle')}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-4 mb-6">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('description')}
          </p>
        </div>

        {/* ✅ Conteneur externe TOUJOURS en LTR pour l'animation */}
        <div className="max-w-4xl mx-auto relative" dir="ltr">
          <div className="overflow-hidden">
            <div
              className="testimonial-track flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="w-full flex-shrink-0 px-4">
                  {/* ✅ Conteneur interne avec RTL si arabe */}
                  <div
                    className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    {/* Étoiles */}
                    <div className="flex items-center gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < testimonial.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
                          }`}
                        />
                      ))}
                      <span className={`${isRtl ? 'mr-2' : 'ml-2'} text-sm text-gray-500 dark:text-gray-400`}>
                        {tCard('rating')}: {testimonial.rating}/5
                      </span>
                    </div>

                    {/* Citation */}
                    <div className="relative mb-6">
                      <Quote className={`absolute -top-2 ${isRtl ? '-right-2' : '-left-2'} w-8 h-8 text-sari-blue/20`} />
                      <p className={`text-gray-600 dark:text-gray-300 italic text-lg leading-relaxed ${isRtl ? 'pr-6' : 'pl-6'}`}>
                        "{testimonial.text}"
                      </p>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-gray-700 mb-4"></div>

                    {/* Auteur */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={testimonial.image}
                          alt={testimonial.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-sari-blue"
                        />
                        <div className={`absolute -bottom-1 ${isRtl ? '-left-1' : '-right-1'} bg-sari-lime rounded-full p-0.5`}>
                          <svg className="w-4 h-4 text-sari-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-sari-dark dark:text-white text-lg">
                          {testimonial.name}
                        </div>
                        <div className="text-sari-blue text-sm">{testimonial.role}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {testimonial.clinic}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ✅ BOUTONS DE NAVIGATION */}
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 -translate-y-1/2 -left-4 md:-left-6 z-10 w-12 h-12 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-sari-blue hover:text-white hover:border-sari-blue transition-all group"
            aria-label={t("previous", { defaultMessage: "Précédent" })}
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={goToNext}
            className="absolute top-1/2 -translate-y-1/2 -right-4 md:-right-6 z-10 w-12 h-12 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-sari-blue hover:text-white hover:border-sari-blue transition-all group"
            aria-label={t("next", { defaultMessage: "Suivant" })}
          >
            <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Indicateurs de pagination */}
          <div className="flex justify-center gap-3 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all rounded-full ${
                  idx === currentSlide
                    ? 'bg-sari-blue w-8 h-3'
                    : 'bg-gray-300 dark:bg-gray-600 w-3 h-3 hover:bg-sari-blue/50'
                }`}
                aria-label={t("testimonialNumber", { number: idx + 1, defaultMessage: `Témoignage ${idx + 1}` })}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}