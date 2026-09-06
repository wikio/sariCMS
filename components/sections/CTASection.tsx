// components/sections/CTASection.tsx
'use client';

/**
 * Bandeau d'appel à l'action « Prêt à démarrer votre projet ? ».
 *
 * Les textes sont saisis langue par langue dans le studio de la page d'accueil
 * (fr / en / ar) et enregistrés avec le bloc ; tant qu'un champ est vide on
 * reprend la traduction du site, pour que la page reste complète même sans
 * enregistrement.
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  BACKGROUND_CLASS,
  TITLE_SIZE_CLASS,
  localizeHref,
  setting,
  styleVars,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import { BuilderBlock, ScopedStyle, isSectionVisible } from '@/components/sections/SectionFrame';

interface CTASectionProps {
  config?: HomeSectionConfig;
}

const ACCENT: Record<string, { solid: string; soft: string }> = {
  lime: { solid: 'bg-sari-lime text-sari-dark hover:bg-white', soft: 'bg-sari-lime text-sari-dark hover:bg-white' },
  white: { solid: 'bg-white text-sari-dark hover:bg-sari-lime', soft: 'bg-white/10 text-white border border-white/40 hover:bg-white/20' },
  blue: { solid: 'bg-sari-blue text-white hover:bg-sari-dark', soft: 'bg-white/10 text-white border border-white/40 hover:bg-white/20' },
};

export default function CTASection({ config }: CTASectionProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.CTASection');
  if (!isSectionVisible(config)) return null;

  const style = config?.style || {};
  const accent = String(setting(config, 'accent', 'lime'));
  const tone = ACCENT[accent] || ACCENT.lime;
  const primaryLabel = txt(config, 'primaryLabel', t('primaryLabel'));
  const secondaryLabel = txt(config, 'secondaryLabel', t('secondaryLabel'));
  const primaryHref = localizeHref(config?.settings?.primaryHref, locale, `/${locale}/contact`);
  const secondaryHref = localizeHref(config?.settings?.secondaryHref, locale, `/${locale}/products`);
  const showSecondary = setting(config, 'showSecondary', true);

  const headline = (
    <>
      <h2 className={`font-bold text-white mb-6 ${TITLE_SIZE_CLASS[style.titleSize || 'xl']}`}>
        {txt(config, 'title', t('defaultTitle'))}
      </h2>
      <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
        {txt(config, 'description', t('defaultDescription'))}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {primaryLabel ? (
          <Link href={primaryHref} className={`px-10 py-4 font-semibold text-lg rounded-lg inline-flex items-center gap-2 transition-colors ${tone.solid}`}>
            {primaryLabel}
            <ArrowRight className="w-5 h-5" />
          </Link>
        ) : null}
        {showSecondary && secondaryLabel ? (
          <Link href={secondaryHref} className={`px-8 py-4 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${tone.soft}`}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </>
  );

  return (
    <BuilderBlock config={config} sectionKey="cta">
      <section
        id="home-cta"
        className={`relative overflow-hidden ${BACKGROUND_CLASS[style.background || 'dark'] || 'bg-sari-dark'}`}
        style={{
          ...styleVars(config),
          paddingTop: `${style.paddingY ?? 96}px`,
          paddingBottom: `${style.paddingY ?? 96}px`,
          ...(style.backgroundImage
            ? {
                backgroundImage: `url("${style.backgroundImage}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
        }}
      >
        <ScopedStyle sectionKey="cta" config={config} />
        <div className="absolute inset-0 grid-pattern-bg opacity-10" />
        <div className="container mx-auto px-6 relative z-10 text-center">{headline}</div>
      </section>
    </BuilderBlock>
  );
}
