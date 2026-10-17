// components/sections/ParallaxSection.tsx
'use client';

/**
 * Bloc « Notre mission » : texte sur image de fond, avec un bouton.
 *
 * Tout est réglable dans le studio de la page d'accueil — textes par langue,
 * image, voile, hauteur, alignement, taille de titre, CSS libre — et le bloc
 * peut être repris tel quel par le constructeur de page (HTML + CSS), ce qui
 * laisse la main sur la mise en page sans toucher au code.
 */
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  BACKGROUND_CLASS,
  TITLE_SIZE_CLASS,
  localizeHref,
  numberSetting,
  setting,
  styleVars,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import { BuilderBlock, ScopedStyle, isSectionVisible } from '@/components/sections/SectionFrame';

interface ParallaxSectionProps {
  /** @deprecated Ancienne interface, conservée pour les autres pages qui appellent le bloc. */
  image?: string;
  subtitle?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaLink?: string;
  locale?: string;
  config?: HomeSectionConfig;
}

export default function ParallaxSection({
  image,
  subtitle,
  title,
  description,
  ctaLabel,
  ctaLink,
  locale: localeProp,
  config,
}: ParallaxSectionProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.ParallaxSection');
  if (!isSectionVisible(config)) return null;

  const style = config?.style || {};
  const backgroundImage = style.backgroundImage || image || 'https://images.unsplash.com/photo-1519494026892-88bb237b200d?w=1920';
  // `overlay` se règle dans l'onglet Apparence (style) ; les anciens blocages
  // le rangeaient dans les réglages : les deux sont lus, style en priorité.
  const overlay = style.overlay !== undefined ? Number(style.overlay) : numberSetting(config, 'overlay', 88);
  const height = numberSetting(config, 'height', 480);
  const parallax = setting(config, 'parallax', true);
  const align = style.align === 'start' ? 'start' : 'center';
  const link = localizeHref(config?.settings?.ctaHref ?? ctaLink, locale, `/${locale}/about`);
  const button = txt(config, 'ctaLabel', ctaLabel || t('defaultCta'));

  return (
    <BuilderBlock config={config} sectionKey="mission">
      <section
        id="home-mission"
        className={`relative overflow-hidden ${BACKGROUND_CLASS[style.background || 'dark'] || 'bg-sari-dark'}`}
        style={{
          ...styleVars(config),
          backgroundImage: `url("${backgroundImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: parallax ? 'fixed' : 'scroll',
          minHeight: `${height}px`,
          paddingTop: `${style.paddingY ?? 128}px`,
          paddingBottom: `${style.paddingY ?? 128}px`,
        }}
      >
        <ScopedStyle sectionKey="mission" config={config} />
        <div className="absolute inset-0 bg-sari-dark" style={{ opacity: overlay / 100 }} aria-hidden />
        <div className="absolute inset-0 grid-pattern-bg opacity-10" aria-hidden />
        <div className="container mx-auto px-6 relative z-10">
          <div className={align === 'center' ? 'text-center' : 'text-start'}>
            <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
              {txt(config, 'subtitle', subtitle || t('defaultSubtitle'))}
            </span>
            <h2
              className={`font-bold text-white mt-4 mb-8 max-w-4xl ${align === 'center' ? 'mx-auto' : ''} ${TITLE_SIZE_CLASS[style.titleSize || 'xl']}`}
            >
              {txt(config, 'title', title || t('defaultTitle'))}
            </h2>
            <p className={`text-xl text-gray-300 mb-12 max-w-2xl ${align === 'center' ? 'mx-auto' : ''}`}>
              {txt(config, 'description', description || t('defaultDescription'))}
            </p>
            {button ? (
              <Link
                href={link}
                className="btn-primary text-white px-10 py-4 font-semibold text-lg inline-flex items-center gap-2"
              >
                {button}
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </BuilderBlock>
  );
}
