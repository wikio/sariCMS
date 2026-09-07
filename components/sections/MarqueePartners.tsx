// components/sections/MarqueePartners.tsx
'use client';

/**
 * Bandeau défilant des partenaires, juste sous le slider.
 *
 * Bloc indépendant dans le studio : on choisit les logos/noms affichés, leur
 * ordre, la vitesse, le sens, le libellé d'accroche et le fond. Il peut aussi
 * être remplacé par le HTML du constructeur de page.
 *
 * Le logo vient de la fiche du partenaire (`logo`) — en mode manuel, de l'étiquette
 * enregistrée dans le bloc, avec la fiche en secours. Un fichier qui ne répond
 * pas (lien périmé, image retirée, hébergeur qui refuse le lien direct) n'affiche
 * pas de cadre vide : `MarqueeItem` retire l'image au premier échec et le nom de
 * la marque reste seul à défiler, comme avant.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Partner } from '@/types';
import {
  BACKGROUND_CLASS,
  applySelection,
  boolSetting,
  limitOf,
  numberSetting,
  setting,
  txt,
  visibleItems,
  type HomeSectionConfig,
} from '@/lib/home/config';
import {
  BuilderBlock,
  ScopedStyle,
  isSectionVisible,
  sectionInlineStyle,
} from '@/components/sections/SectionFrame';

interface MarqueePartnersProps {
  partners: Partner[];
  config?: HomeSectionConfig;
}

/** Une marque du bandeau : un nom, et un logo quand on en a un de lisible. */
interface MarqueeRow {
  name: string;
  image: string;
}

/** Deux initiales, pour le cas où le fichier logo est absent ou mort. */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Une marque du bandeau.
 *
 * Le logo passe d'abord ; s'il est absent ou ne charge pas (lien de démonstration
 * périmé, image retirée, hébergeur qui refuse le lien direct), le bloc ne montre
 * pas un carré cassé au milieu du défilé — la place du logo est tenue par un
 * monogramme, et le nom suit si l'administrateur l'a demandé. C'est ce filet qui
 * faisait croire le bandeau vide : sans lui, une seule adresse morte suffisait à
 * ne plus rien afficher de lisible.
 */
function MarqueeItem({ row, showLogo, showName, logoHeight }: {
  row: MarqueeRow;
  showLogo: boolean;
  showName: boolean;
  logoHeight: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = showLogo && !broken && Boolean(row.image);
  const showMonogram = showLogo && !showImage && Boolean(row.name);
  const compact = !showName || !row.name;

  return (
    <span className={`flex items-center ${showLogo && showName && row.name ? 'gap-3' : ''}`}>
      {showImage ? (
        <img
          src={row.image}
          alt={compact ? row.name : ''}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="w-auto object-contain flex-shrink-0"
          style={{ height: `${logoHeight}px`, maxWidth: `${Math.round(logoHeight * 5)}px` }}
        />
      ) : null}
      {showMonogram ? (
        <span
          aria-hidden
          className="flex items-center justify-center rounded-md border border-current bg-current/5 font-black tracking-wide flex-shrink-0"
          style={{ height: `${logoHeight}px`, minWidth: `${logoHeight}px`, paddingInline: `${Math.round(logoHeight / 3)}px`, fontSize: `${Math.round(logoHeight * 0.5)}px` }}
        >
          {initials(row.name)}
        </span>
      ) : null}
      {showName && row.name ? <span>{row.name}</span> : null}
    </span>
  );
}

export default function MarqueePartners({ partners, config }: MarqueePartnersProps) {
  const t = useTranslations('components.sections.MarqueePartners');
  if (!isSectionVisible(config)) return null;

  const style = config?.style || {};
  const pool = Array.isArray(partners) ? partners : [];
  const manual = config?.selection?.mode === 'manual' && (config?.selection?.ids?.length ?? 0) > 0;
  // En mode manuel le bandeau accepte plus de logos que le nombre « vitrine » :
  // c'est le défilement qui les montre, pas la place disponible.
  const selected = manual
    ? applySelection(pool, { ...config!.selection!, limit: 0 }, { titleKey: 'name' })
    : (() => {
        const limit = limitOf(config, 12);
        return limit > 0 ? pool.slice(0, limit) : pool;
      })();

  const byId = new Map(pool.map((partner) => [String(partner.id), partner]));
  // Une fiche peut être choisie dans le studio sans que l'étiquette du bloc
  // n'ait son logo (reprise ancienne, import partiel) : on va le chercher.
  const rows: MarqueeRow[] = (
    manual
      ? visibleItems(config).map((item) => {
          const name = String(item.label ?? item.name ?? '');
          const partner = byId.get(String(item.id));
          return {
            name: name || String(partner?.name || ''),
            image: String(item.image ?? item.logo ?? partner?.logo ?? ''),
          };
        })
      : selected.map((partner) => ({
          name: String(partner?.name || ''),
          image: String(partner?.logo || (partner as { image?: string })?.image || ''),
        }))
  )
    .filter((row) => row.name || row.image)
    .map((row) => ({ ...row, name: row.name || row.image.split('/').pop()?.replace(/\.[a-z]+$/i, '') || '' }));

  if (!rows.length) return null;

  const duration = numberSetting(config, 'speed', 30);
  const direction = String(setting<string>(config, 'direction', 'left')) === 'right' ? 'reverse' : 'normal';
  const pauseOnHover = setting(config, 'pauseOnHover', true);
  const showLogo = boolSetting(config, 'showLogos', true);
  const showName = boolSetting(config, 'showNames', true);
  const logoHeight = Math.max(16, Math.min(96, numberSetting(config, 'logoHeight', 40)));
  const logoGap = Math.max(0, Math.min(96, numberSetting(config, 'logoGap', 32)));
  const separator = String(config?.settings?.separator ?? ' • ').trim() || '•';
  const label = txt(config, 'label', t('label'));
  const loop = [...rows, ...rows];

  return (
    <BuilderBlock config={config} sectionKey="partners-marquee">
      <section
        id="home-partners-marquee"
        className={`overflow-hidden ${BACKGROUND_CLASS[style.background || 'blue'] || 'bg-sari-blue text-white'}`}
        style={sectionInlineStyle(config)}
      >
        <ScopedStyle sectionKey="partners-marquee" config={config} />
        {label ? (
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-80">{label}</p>
        ) : null}
        <div
          className={`marquee ${pauseOnHover ? 'hover:[&_.marquee-content]:[animation-play-state:paused]' : ''}`}
        >
          <div className="marquee-content" style={{ animationDirection: direction, animationDuration: `${duration}s` }}>
            {loop.map((row, i) => (
              <span
                // Le séparateur est un signe typographique, pas une espacement :
                // c'est `logoGap` qui règle l'air entre deux marques.
                key={`${row.name}-${i}`}
                className="flex items-center text-xl font-bold opacity-80"
                style={{ marginInlineEnd: `${logoGap}px` }}
              >
                <MarqueeItem row={row} showLogo={showLogo} showName={showName} logoHeight={logoHeight} />
                {showName ? (
                  <span aria-hidden className="opacity-50 ms-2">
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
