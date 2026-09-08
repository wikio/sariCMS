// components/sections/HeroSlider.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroSlide } from '@/types';
import {
  applySelection,
  localizeHref,
  numberSetting,
  orOverride,
  overrideFor,
  selectionFor,
  setting,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import { BuilderBlock, ScopedStyle, isSectionVisible } from '@/components/sections/SectionFrame';

interface HeroSliderProps {
  slides: HeroSlide[];
  /** Réglages du bloc « Slider » enregistrés dans le studio de la page d'accueil. */
  config?: HomeSectionConfig;
  /**
   * Le slider est-il le premier bloc de la page ? Le bandeau de navigation est
   * en `position: fixed` : seul le premier bloc doit lui céder de la place, les
   * autres sont déjà repoussés par ce qui les précède.
   */
  firstOnPage?: boolean;
}

const HEIGHT_CLASS: Record<string, string> = {
  screen: 'h-screen min-h-[560px]',
  tall: 'h-[80vh] min-h-[520px]',
  medium: 'h-[60vh] min-h-[440px]',
  short: 'h-[48vh] min-h-[380px]',
};

/** Alignement horizontal du bloc de texte. */
const H_ALIGN_CLASS: Record<string, string> = {
  start: 'justify-start text-start',
  center: 'justify-center text-center',
  end: 'justify-end text-end',
};

/**
 * Alignement vertical. `middle` est le rendu d'origine du site : le texte est
 * centré dans la hauteur du slider, donc jamais sous le bandeau de navigation.
 * `top` colle le texte en haut du bloc — ce qui n'est possible qu'en lui
 * laissant la place du menu (voir `topGap`).
 */
const V_ALIGN_CLASS: Record<string, string> = {
  top: 'items-start',
  middle: 'items-center',
  bottom: 'items-end',
};

export default function HeroSlider({ slides, config, firstOnPage = true }: HeroSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const locale = useLocale();
  const t = useTranslations('components.sections.HeroSlider');

  const autoplay = setting(config, 'autoplay', true);
  const interval = numberSetting(config, 'interval', 6000);
  const showDots = setting(config, 'showDots', true);
  const showArrows = setting(config, 'showArrows', true);
  const height = String(setting(config, 'height', 'screen'));
  const overlay = numberSetting(config, 'overlay', 80);
  const align = String(setting(config, 'align', 'start'));
  const vertical = String(setting(config, 'vertical', 'middle'));
  // Marge au-dessus du texte quand il est collé en haut : la hauteur du bandeau
  // est déjà déduite par `--site-header-h`, `topGap` n'ajoute que le surplus.
  const topGap = numberSetting(config, 'topGap', 24);
  const badge = txt(config, 'badge', t('excellence'));
  const ctaFallback = txt(config, 'ctaLabel', t('discover'));

  // La sélection du studio (ordre des slides) passe avant l'ordre du module hero,
  // puis chaque slide reçoit les surcharges enregistrées dans le bloc : un titre
  // ou un bouton propre à la page d'accueil, sans retoucher la fiche du module.
  const visible = applySelection(slides, selectionFor(config, 4), { titleKey: 'title' })
    .map((slide) => ({ slide, patch: overrideFor(config, slide.id) }))
    .filter(({ patch }) => patch.enabled !== false && patch.enabled !== 'false')
    .map(({ slide, patch }) => ({
      ...slide,
      title: orOverride(patch, 'title', slide.title),
      subtitle: orOverride(patch, 'subtitle', slide.subtitle || ''),
      description: orOverride(patch, 'description', slide.description || ''),
      image: orOverride(patch, 'image', slide.image),
      cta: orOverride(patch, 'cta', slide.cta || ctaFallback),
      ctaLink: orOverride(patch, 'ctaLink', slide.ctaLink || ''),
    }));
  const count = visible.length;

  const go = useCallback(
    (step: number) => setCurrentSlide((prev) => (count ? (prev + step + count) % count : 0)),
    [count],
  );

  useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % count), Math.max(1500, interval));
    return () => clearInterval(timer);
  }, [autoplay, paused, count, interval]);

  useEffect(() => {
    if (currentSlide >= count) setCurrentSlide(0);
  }, [count, currentSlide]);

  if (!isSectionVisible(config) || count === 0) return null;

  return (
    <BuilderBlock config={config} sectionKey="hero">
      <section
        className={`relative slider-container ${HEIGHT_CLASS[height] || HEIGHT_CLASS.screen}`}
        id="home-hero"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <ScopedStyle sectionKey="hero" config={config} />
        {visible.map((slide, idx) => (
          <div key={String(slide.id)} className={`slider-slide ${idx === currentSlide ? 'active' : ''}`}>
            <div className="absolute inset-0 parallax-bg" style={{ backgroundImage: `url(${slide.image})` }}>
              <div className="absolute inset-0 bg-sari-dark" style={{ opacity: overlay / 100 }} />
            </div>
            <div className="absolute inset-0 grid-pattern-bg opacity-20" />
            <div
              className={`relative z-10 h-full container mx-auto px-6 flex ${
                H_ALIGN_CLASS[align] || H_ALIGN_CLASS.start
              } ${V_ALIGN_CLASS[vertical] || V_ALIGN_CLASS.middle}`}
              style={
                vertical === 'top' && firstOnPage
                  ? { paddingTop: `calc(var(--site-header-h, 122px) + ${Math.max(0, topGap)}px)` }
                  : undefined
              }
            >
              <div className="max-w-3xl text-white">
                {badge ? (
                  <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-6 animate-fade-in-up">
                    {badge}
                  </span>
                ) : null}
                <h1
                  className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-fade-in-up"
                  style={{ animationDelay: '0.2s' }}
                >
                  {slide.title}
                </h1>
                {slide.subtitle ? (
                  <p className="text-xl text-gray-200 mb-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                    {slide.subtitle}
                  </p>
                ) : null}
                {slide.description ? (
                  <p className="text-lg text-gray-300 mb-8 max-w-2xl animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                    {slide.description}
                  </p>
                ) : null}
                <div className="animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                  <Link
                    // Un lien relatif est préfixé de la langue ; une URL absolue (campagne externe)
                    // est conservée telle quelle.
                    href={localizeHref(slide.ctaLink, locale, `/${locale}/solutions`)}
                    className="btn-primary text-white px-8 py-4 font-semibold shadow-2xl inline-flex items-center gap-2"
                  >
                    {slide.cta || ctaFallback}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {showArrows && count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('previous', { defaultMessage: 'Précédent' })}
              className="absolute start-4 md:start-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('next', { defaultMessage: 'Suivant' })}
              className="absolute end-4 md:end-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        ) : null}

        {showDots && count > 1 ? (
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex gap-3 z-20">
            {visible.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={t('slideNumber', { number: idx + 1, defaultMessage: `Slide ${idx + 1}` })}
                className={`transition-all ${idx === currentSlide ? 'bg-sari-lime w-12 h-3' : 'bg-white/50 w-3 h-3 hover:bg-white/80'}`}
              />
            ))}
          </div>
        ) : null}
      </section>
    </BuilderBlock>
  );
}
