// components/sections/HeroSlider.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HeroSlide } from '@/types';

interface HeroSliderProps {
  slides: HeroSlide[];
}

export default function HeroSlider({ slides }: HeroSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const locale = useLocale();
  const t = useTranslations('components.sections.HeroSlider');

  useEffect(() => {
    if (slides.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className="relative h-screen slider-container">
      {slides.map((slide, idx) => (
        <div key={slide.id} className={`slider-slide ${idx === currentSlide ? 'active' : ''}`}>
          <div className="absolute inset-0 parallax-bg" style={{ backgroundImage: `url(${slide.image})` }}>
            <div className="absolute inset-0 bg-sari-dark/80"></div>
          </div>
          <div className="absolute inset-0 grid-pattern-bg opacity-20"></div>
          <div className="relative z-10 h-full container mx-auto px-6 flex items-center">
            <div className="max-w-3xl text-white">
              <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-6 animate-fade-in-up">
                {t('excellence')}
              </span>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                {slide.title}
              </h1>
              <p className="text-xl text-gray-200 mb-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                {slide.subtitle}
              </p>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                {slide.description}
              </p>
              <div className="animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                <Link 
                  href={`/${locale}${slide.ctaLink?.replace('#', '/') || '/solutions'}`} 
                  className="btn-primary text-white px-8 py-4 font-semibold shadow-2xl inline-flex items-center gap-2"
                >
                  {slide.cta || t('discover')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex gap-3 z-20">
        {slides.map((_, idx) => (
          <button 
            key={idx} 
            onClick={() => setCurrentSlide(idx)} 
            className={`transition-all ${idx === currentSlide ? 'bg-sari-lime w-12 h-3' : 'bg-white/50 w-3 h-3'}`}
          ></button>
        ))}
      </div>
    </section>
  );
}