// components/cards/TestimonialCard.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Star, Quote, BadgeCheck } from 'lucide-react';
import type { Testimonial } from '@/types';

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  const t = useTranslations('components.cards.TestimonialCard');

  return (
    <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all">
      {/* Note étoilée */}
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
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          {t('rating')}: {testimonial.rating}/5
        </span>
      </div>

      {/* Citation */}
      <div className="relative mb-6">
        <Quote className="absolute -top-2 -left-2 w-8 h-8 text-sari-blue/20" />
        <p className="text-gray-600 dark:text-gray-300 italic text-lg leading-relaxed pl-6">
          "{testimonial.text}"
        </p>
      </div>

      {/* Séparateur */}
      <div className="h-px bg-gray-200 dark:bg-gray-700 mb-4"></div>

      {/* Auteur */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={testimonial.image}
            alt={testimonial.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-sari-blue"
          />
          <div className="absolute -bottom-1 -right-1 bg-sari-lime rounded-full p-0.5">
            <BadgeCheck className="w-4 h-4 text-sari-dark" />
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
          <div className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <BadgeCheck className="w-3 h-3" />
            {t('verified')}
          </div>
        </div>
      </div>
    </div>
  );
}