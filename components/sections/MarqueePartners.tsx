// components/sections/MarqueePartners.tsx
'use client';

/**
 * Bandeau défilant de la page d'accueil — éléments, pas seulement des logos.
 *
 * Ce qui défile vient de la configuration du bloc : les fiches d'un module du
 * site (partenaires, actualités, événements, offres d'emploi, produits), un
 * mélange de plusieurs modules, ou les blocs libres saisis dans le studio
 * (texte seul, image seule, texte + image). Le mélange des deux est possible :
 * les blocs libres suivent ou précèdent la liste, au réglage près.
 *
 * Trois familles de réglages, toutes dans le studio :
 * - **ce qui s'affiche** : `source`, `itemKind`, image/titre/texte, séparateur ;
 * - **la taille** : hauteur d'un élément, largeur de l'image (0 = la largeur
 *   suit le ratio de l'image à cette hauteur), cadrage, arrondi, et la hauteur
 *   du bandeau en découle ;
 * - **l'air autour** : espace entre les éléments, inside padding, marges
 *   haute et basse, fondu sur les bords, vitesse et sens du défilement.
 *
 * Le défilement est de la pure CSS (`@keyframes marquee`, la liste est dupliquée
 * une fois) : sans image qui charge, le bandeau n'est jamais vide — un élément
 * dont l'image est morte reprend son titre, ou ses initiales pour un
 * partenaire. Aucune requête n'est lancée ici : les fiches viennent de la page.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { Partner } from '@/types';
import {
  BACKGROUND_CLASS,
  boolSetting,
  localizeHref,
  numberSetting,
  setting,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import { marqueeRows, resolveKind, type MarqueeKind, type MarqueePools, type MarqueeRow } from '@/lib/home/marquee';
import {
  BuilderBlock,
  ScopedStyle,
  SectionHeader,
  isSectionVisible,
  sectionInlineStyle,
} from '@/components/sections/SectionFrame';

interface MarqueePartnersProps {
  /** Conservé pour les appels existants : repli sur la liste des partenaires. */
  partners?: Partner[];
  /** Fiches des modules que le bandeau sait lire, chargées par la page. */
  pools?: MarqueePools;
  config?: HomeSectionConfig;
}

const TEXT_SIZE_CLASS: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const VALIGN_CLASS: Record<string, string> = {
  top: 'items-start',
  middle: 'items-center',
  bottom: 'items-end',
};

/** Alignement vertical des éléments dans la bande, en style en ligne : la règle
    `.marquee-content` de `globals.css` est hors couche et battrait une
    utilitaire Tailwind. */
const VALIGN_STYLE: Record<string, React.CSSProperties['alignItems']> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

const clampStyle = (lines: number): React.CSSProperties | undefined =>
  lines > 0
    ? ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties)
    : undefined;

/** Deux initiales, pour un partenaire dont le fichier logo est absent ou mort. */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Un élément du bandeau.
 *
 * L'image passe d'abord ; si elle ne charge pas, `broken` la retire du rendu et
 * le titre (ou un monogramme, pour un partenaire) occupe sa place. C'est le
 * filet qui empêche un lien de logo périmé de laisser un cadre cassé au milieu
 * du défilé — et de faire croire que le bloc entier est vide.
 */
function MarqueeItem({
  row,
  kind,
  showImage,
  showTitle,
  showText,
  height,
  width,
  fit,
  radius,
  gap,
  textSize,
  textLines,
  invert,
}: {
  row: MarqueeRow;
  kind: Exclude<MarqueeKind, 'auto'>;
  showImage: boolean;
  showTitle: boolean;
  showText: boolean;
  height: number;
  width: number;
  fit: string;
  radius: number;
  gap: number;
  textSize: string;
  textLines: number;
  invert: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const wantImage = showImage && kind !== 'text' && Boolean(row.image);
  const showImageTag = wantImage && !broken;
  const monogram = row.source === 'partners' && !showImageTag && Boolean(row.title);
  // Une image qui manque ne doit pas faire disparaître l'élément : le titre
  // prend sa place, quitte à passer d'« image seule » à « texte seul ».
  const showTitleTag = showTitle && Boolean(row.title) && (kind === 'text' || kind === 'image-text' || !showImageTag);
  // Un bloc « texte seul » vit de son texte : c'est lui qu'on montre, avec son
  // titre en tête s'il en a un — sinon le bloc serait réduit à son accroche.
  const showTextTag = showText && kind !== 'image' && Boolean(row.text);

  const inner = (
    <span className={`flex ${height ? 'min-h-[var(--mq-h)]' : ''}`} style={{ gap: `${gap}px`, ['--mq-h' as string]: `${height}px` }} >
      {showImageTag ? (
        <img
          src={row.image}
          alt={showTitleTag ? '' : row.title || row.text}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="flex-shrink-0"
          style={{
            height: height ? `${height}px` : undefined,
            width: width > 0 ? `${width}px` : 'auto',
            maxWidth: width > 0 ? `${width}px` : `${Math.round(height * 6)}px`,
            objectFit: fit as React.CSSProperties['objectFit'],
            borderRadius: radius ? `${radius}px` : undefined,
          }}
        />
      ) : null}
      {monogram ? (
        <span
          aria-hidden
          className={`flex items-center justify-center font-black tracking-wide flex-shrink-0 ${invert ? 'bg-white/10' : 'bg-black/5'}`}
          style={{
            height: `${height}px`,
            minWidth: `${height}px`,
            paddingInline: `${Math.round(height / 3)}px`,
            fontSize: `${Math.round(height * 0.42)}px`,
            borderRadius: `${radius}px`,
          }}
        >
          {initials(row.title || row.text)}
        </span>
      ) : null}
      {showTitleTag || showTextTag ? (
        <span className="flex flex-col justify-center min-w-0" style={{ gap: `${Math.max(2, Math.round(height / 12))}px` }}>
          {showTitleTag ? (
            <span className={`font-bold leading-tight ${TEXT_SIZE_CLASS[textSize] || 'text-lg'}`} style={clampStyle(textLines)}>
              {row.title}
            </span>
          ) : null}
          {showTextTag ? (
            <span className="opacity-70 leading-snug text-xs" style={clampStyle(Math.max(1, textLines))}>
              {row.text}
            </span>
          ) : null}
          {row.meta && !showTextTag ? <span className="text-[10px] uppercase tracking-wider opacity-50">{row.meta}</span> : null}
        </span>
      ) : null}
    </span>
  );

  if (!row.href) return inner;
  return (
    <Link href={row.href} className="block hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4">
      {inner}
    </Link>
  );
}

export default function MarqueePartners({ partners, pools, config }: MarqueePartnersProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.MarqueePartners');
  if (!isSectionVisible(config)) return null;

  const allPools: MarqueePools = {
    partners: Array.isArray(pools?.partners) ? pools.partners : partners,
    news: pools?.news,
    events: pools?.events,
    careers: pools?.careers,
    products: pools?.products,
  };
  const rows = marqueeRows(config, allPools).filter((row) => {
    const kind = resolveKind(row, String(setting<string>(config, 'itemKind', 'auto')) as MarqueeKind);
    return kind === 'image' ? Boolean(row.image || row.title) : Boolean(row.title || row.text || row.image);
  });
  if (!rows.length) return null;

  const style = config?.style || {};
  const invert = Boolean(style.invert) || style.background === 'blue' || style.background === 'dark' || style.background === 'lime';
  // Les clés `logoHeight` / `logoGap` / `showLogos` / `showNames` viennent des
  // enregistrements déjà en base : elles restent lues, pour qu'une mise à jour
  // du code n'oblige personne à rouvrir chaque bloc.
  const height = Math.max(0, Math.min(240, numberSetting(config, 'itemHeight', numberSetting(config, 'logoHeight', 72))));
  const width = Math.max(0, Math.min(480, numberSetting(config, 'mediaWidth', 0)));
  const fit = String(setting<string>(config, 'mediaFit', width > 0 ? 'cover' : 'contain'));
  const radius = Math.max(0, Math.min(48, numberSetting(config, 'mediaRadius', 8)));
  const gap = Math.max(0, Math.min(64, numberSetting(config, 'mediaGap', 12)));
  const itemGap = Math.max(0, Math.min(128, numberSetting(config, 'itemGap', numberSetting(config, 'logoGap', 32))));
  const itemPadding = Math.max(0, Math.min(48, numberSetting(config, 'itemPadding', 0)));
  const textLines = Math.max(0, Math.min(4, numberSetting(config, 'textLines', 2)));
  const textSize = String(setting<string>(config, 'textSize', 'lg'));
  const valign = String(setting<string>(config, 'valign', 'middle'));
  const showImage = boolSetting(config, 'showImage', boolSetting(config, 'showLogos', true));
  const showTitle = boolSetting(config, 'showTitle', boolSetting(config, 'showNames', true));
  const showText = boolSetting(config, 'showText', true);
  const showSeparator = boolSetting(config, 'showSeparator', true);
  const separator = (String(config?.settings?.separator ?? '•').trim() || '•').slice(0, 3);
  const linkItems = boolSetting(config, 'linkItems', true);
  const edgeFade = boolSetting(config, 'edgeFade', true);
  const cardStyle = String(setting<string>(config, 'cardStyle', 'plain'));
  const duration = numberSetting(config, 'speed', 30);
  // Le sens du défilement suit l'écriture par défaut : en arabe, la bande part
  // vers la droite, comme le reste de la page.
  const directionDefault = locale === 'ar' ? 'right' : 'left';
  const direction = String(setting<string>(config, 'direction', directionDefault)) === 'right' ? 'reverse' : 'normal';
  const pauseOnHover = boolSetting(config, 'pauseOnHover', true);
  const marginTop = Math.max(0, Math.min(160, numberSetting(config, 'marginTop', 0)));
  const marginBottom = Math.max(0, Math.min(160, numberSetting(config, 'marginBottom', 0)));
  const label = txt(config, 'label', t('label'));
  const loop = [...rows, ...rows];
  const ariaLabel = txt(config, 'ariaLabel', t('ariaLabel'));

  const tileClass =
    cardStyle === 'chip'
      ? `rounded-full px-4 py-1 ${invert ? 'bg-white/10' : 'bg-black/5'}`
      : cardStyle === 'card'
        ? `rounded-lg border px-4 py-3 ${invert ? 'bg-white/5 border-white/15' : 'bg-black/[.03] border-black/10'}`
        : '';

  return (
    <BuilderBlock config={config} sectionKey="partners-marquee">
      <section
        id="home-partners-marquee"
        className={`overflow-hidden ${BACKGROUND_CLASS[style.background || 'blue'] || 'bg-sari-blue text-white'}`}
        style={{
          ...sectionInlineStyle(config),
          marginTop: marginTop ? `${marginTop}px` : undefined,
          marginBottom: marginBottom ? `${marginBottom}px` : undefined,
        }}
        aria-label={ariaLabel || undefined}
      >
        <ScopedStyle sectionKey="partners-marquee" config={config} />
        <SectionHeader
          config={config}
          fallbacks={{
            subtitle: txt(config, 'subtitle', ''),
            title: txt(config, 'title', ''),
            description: txt(config, 'description', ''),
          }}
        />
        {label ? (
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-80">{label}</p>
        ) : null}
        <div
          className={`marquee ${pauseOnHover ? 'hover:[&_.marquee-content]:[animation-play-state:paused]' : ''}`}
          style={
            edgeFade
              ? {
                  maskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
                }
              : undefined
          }
        >
          <div
            className="marquee-content"
            style={{
              alignItems: VALIGN_STYLE[valign] || 'center',
              animationDirection: direction,
              animationDuration: `${Math.max(5, duration)}s`,
            }}
          >
            {loop.map((row, i) => (
              <span
                key={`${row.source}-${row.id}-${i}`}
                className={`flex ${VALIGN_CLASS[valign] || VALIGN_CLASS.middle} ${TEXT_SIZE_CLASS[textSize] || 'text-lg'} font-bold ${tileClass}`}
                // L'espace entre deux éléments est une propriété logique : il se
                // retourne avec la page en arabe, sans seconde classe à écrire.
                style={{ marginInlineEnd: `${itemGap}px`, padding: itemPadding ? `${itemPadding}px` : undefined }}
              >
                <MarqueeItem
                  row={{ ...row, href: linkItems ? localizeHref(row.href, locale) : '' }}
                  kind={resolveKind(row, String(setting<string>(config, 'itemKind', 'auto')) as MarqueeKind)}
                  showImage={showImage}
                  showTitle={showTitle}
                  showText={showText}
                  height={height}
                  width={width}
                  fit={fit}
                  radius={radius}
                  gap={gap}
                  textSize={textSize}
                  textLines={textLines}
                  invert={invert}
                />
                {showSeparator ? (
                  <span aria-hidden className="opacity-40 ms-3 font-normal">
                    {separator}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </section>
    </BuilderBlock>
  );
}
