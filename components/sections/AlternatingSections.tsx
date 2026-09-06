// components/sections/AlternatingSections.tsx
'use client';

/**
 * « Blocs impairs » de la page d'accueil : une liste d'éléments image/texte
 * alternés, entièrement composés dans le studio (ajouter, supprimer, réordonner,
 * alterner image à gauche ou à droite).
 *
 * Chaque élément porte son propre titre, sa description, son étiquette et son
 * bouton ; les textes sont stockés par langue. Tant qu'aucun élément n'est
 * enregistré, le bloc retombe sur les trois visées historiques issues des
 * traductions, pour que la page ne se vide pas au premier déploiement.
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import ImageWithFallback from '@/components/shared/ImageWithFallback';
import {
  localizeHref,
  numberSetting,
  setting,
  txt,
  visibleItems,
  type HomeItem,
  type HomeSectionConfig,
} from '@/lib/home/config';
import SectionFrame, { HS_CARD_RADIUS } from '@/components/sections/SectionFrame';

interface AlternatingSectionsProps {
  config?: HomeSectionConfig;
}

const PLACEHOLDER = [
  {
    image: 'https://images.unsplash.com/photo-1519494026892-88bb237b200d?w=800',
    title: 'Usine intelligente',
    desc: 'IoT industriel et maintenance prédictive',
    img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800',
  },
  {
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800',
    title: 'Santé connectée',
    desc: 'Équipements médicaux et télémédecine',
    img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
  },
  {
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    title: 'Commerce digital',
    desc: 'Plateformes e-commerce et paiement',
    img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
  },
];

function itemField(item: HomeItem, key: string): string {
  return String(item[key] ?? '').trim();
}

function itemChecks(item: HomeItem): string[] {
  const raw = item.bullets ?? item.checks;
  if (Array.isArray(raw)) return raw.map((line) => String(line)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((line) => String(line)).filter(Boolean);
    } catch {
      /* liste texte libre, ligne à ligne */
    }
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

export default function AlternatingSections({ config }: AlternatingSectionsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.AlternatingSections');

  const blocks = visibleItems(config);
  const fallbackViewAll = setting(config, 'showViewAll', true);
  const ctaLabel = txt(config, 'ctaLabel', t('ctaText'));
  const ctaHref = localizeHref(config?.settings?.ctaHref, locale, `/${locale}/solutions`);
  const gap = numberSetting(config, 'gap', 60);
  const invert = config?.style?.invert === true;

  const items = blocks.length
    ? blocks
    : PLACEHOLDER.map((legacy, index) => ({
        id: `legacy-${index}`,
        badge: t('title'),
        title: legacy.title,
        description: legacy.desc,
        image: legacy.img,
        checks: [],
      }));

  if (!items.length) return null;

  const renderChecks = (checks: string[], withIcon: boolean) => {
    if (!checks.length) return null;
    return (
      <ul className="space-y-4 mb-8">
        {checks.map((check, checkIndex) => (
          <li key={checkIndex} className={`flex gap-3 ${invert ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
            {withIcon ? <CheckCircle2 className="w-5 h-5 text-sari-lime flex-shrink-0 mt-0.5" /> : null}
            <span>{check}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <SectionFrame
      sectionKey="blocks"
      config={config}
      header={{
        fallbacks: { subtitle: t('subtitle'), title: t('title') },
        action: fallbackViewAll ? (
          <Link href={ctaHref} className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2">
            {ctaLabel}
            <ArrowRight className="w-5 h-5" />
          </Link>
        ) : null,
      }}
    >
      <div className="space-y-[var(--hs-gap,60px)]" style={{ ['--hs-gap' as string]: `${gap}px` }}>
        {items.map((item: HomeItem, index: number) => {
          const imageFirst = itemField(item, 'position') === 'image-right' ? index % 2 === 0 : index % 2 !== 0;
          const checks = itemField(item, 'mode') === 'list' ? itemChecks(item) : [];
          const radius = config?.style?.radius ?? 16;
          const media = (
            <div className={`w-full lg:w-1/2 ${imageFirst ? 'lg:order-first' : 'lg:order-last'}`}>
              <div className={`relative overflow-hidden ${HS_CARD_RADIUS}`} style={{ borderRadius: `${radius}px` }}>
                <ImageWithFallback
                  src={itemField(item, 'image') || PLACEHOLDER[index % PLACEHOLDER.length].image}
                  alt={itemField(item, 'title') || t('title')}
                  className="w-full h-96 object-cover"
                  aspectRatio="4:3"
                />
              </div>
            </div>
          );
          return (
            <div key={String(item.id ?? index)} className="flex flex-col lg:flex-row gap-12 items-center">
              {media}
              <div className="w-full lg:w-1/2">
                <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-6">
                  {itemField(item, 'badge') || txt(config, 'subtitle', t('subtitle'))}
                </span>
                <h2 className={`text-4xl font-bold mb-6 ${invert ? 'text-white' : 'text-sari-dark dark:text-white'}`}>
                  {itemField(item, 'title') || t('title')}
                </h2>
                <p className={`text-xl mb-8 ${invert ? 'text-blue-50' : 'text-gray-600 dark:text-gray-400'}`}>
                  {itemField(item, 'description') || t('description')}
                </p>
                {renderChecks(checks, true)}
                <Link
                  href={localizeHref(itemField(item, 'ctaHref') || String(config?.settings?.ctaHref || ''), locale, `/${locale}/solutions`)}
                  className="btn-primary text-white px-8 py-4 font-semibold inline-flex items-center gap-2"
                >
                  {itemField(item, 'ctaLabel') || ctaLabel}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}
