// components/sections/PartnersSection.tsx
'use client';

/**
 * Partenaires en vedette.
 *
 * La sélection (quelles fiches, dans quel ordre) et le nombre affiché se
 * règlent dans le studio ; les logos gardent l'effet « noir et blanc puis
 * couleur au survol » tant que l'administrateur ne le désactive pas.
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { Partner } from '@/types';
import ImageWithFallback from '@/components/shared/ImageWithFallback';
import {
  applySelection,
  limitOf,
  localizeHref,
  numberSetting,
  setting,
  selectionFor,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import SectionFrame, { HS_CARD_RADIUS, gridProps } from '@/components/sections/SectionFrame';

interface PartnersSectionProps {
  partners: Partner[];
  config?: HomeSectionConfig;
}

export default function PartnersSection({ partners, config }: PartnersSectionProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.PartnersSection');

  const source = Array.isArray(partners) ? partners : [];
  const selected = applySelection(source, selectionFor(config, 6), { titleKey: 'name' });
  if (selected.length === 0) return null;

  const grayscale = setting(config, 'grayscale', true);
  const withBorder = setting(config, 'showBorder', true);
  const logoHeight = numberSetting(config, 'logoHeight', 64);
  const columns = limitOf(config, 6);
  const radius = config?.style?.radius ?? 12;

  return (
    <SectionFrame
      sectionKey="partners"
      config={config}
      header={{
        align: 'center',
        fallbacks: { subtitle: t('subtitle'), title: t('title'), description: t('description') },
      }}
    >
      <div
        {...gridProps(config, columns, 32)}
        className={`${gridProps(config, columns, 32).className} items-center stagger-children`}
      >
        {selected.map((partner) => {
          const card = (
            <div
              className={`${HS_CARD_RADIUS} bg-gray-50 dark:bg-[#111111] p-8 flex flex-col items-center justify-center transition-all duration-300 group hover:shadow-lg ${
                withBorder ? 'border border-gray-200 dark:border-gray-800 hover:border-sari-blue' : ''
              }`}
              style={{ borderRadius: `${radius}px` }}
            >
              {/* La hauteur du logo se règle dans le studio : la boîte borne
                  l'image, l'image garde ses proportions. */}
              <span className="w-full flex items-center justify-center overflow-hidden" style={{ maxHeight: `${logoHeight}px` }}>
                <ImageWithFallback
                  src={partner.logo}
                  alt={partner.name}
                  fallbackText={partner.name}
                  className={`h-full w-auto transition-all duration-300 group-hover:scale-110 ${grayscale ? 'opacity-70 grayscale group-hover:opacity-100 group-hover:grayscale-0' : 'opacity-100'}`}
                  objectFit="contain"
                />
              </span>
            </div>
          );
          // La fiche partenaire n'a pas de lien en base : le logo reste une
          // vignette, cliquable seulement si l'administrateur a lié une page.
          const href = localizeHref(config?.settings?.logoHref, locale, '');
          return href ? (
            <Link key={String(partner.id)} href={href} className="block">
              {card}
            </Link>
          ) : (
            <div key={String(partner.id)}>{card}</div>
          );
        })}
      </div>
      {txt(config, 'note') ? (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{txt(config, 'note')}</p>
      ) : null}
    </SectionFrame>
  );
}
