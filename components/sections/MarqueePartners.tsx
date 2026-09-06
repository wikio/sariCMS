// components/sections/MarqueePartners.tsx
'use client';

/**
 * Bandeau défilant des partenaires, juste sous le slider.
 *
 * Bloc indépendant dans le studio : on choisit les logos/noms affichés, leur
 * ordre, la vitesse, le sens, le libellé d'accroche et le fond. Il peut aussi
 * être remplacé par le HTML du constructeur de page.
 */
import { useTranslations } from 'next-intl';
import type { Partner } from '@/types';
import {
  BACKGROUND_CLASS,
  applySelection,
  numberSetting,
  setting,
  styleVars,
  txt,
  visibleItems,
  type HomeSectionConfig,
} from '@/lib/home/config';
import { BuilderBlock, ScopedStyle, isSectionVisible } from '@/components/sections/SectionFrame';

interface MarqueePartnersProps {
  partners: Partner[];
  config?: HomeSectionConfig;
}

export default function MarqueePartners({ partners, config }: MarqueePartnersProps) {
  const t = useTranslations('components.sections.MarqueePartners');
  if (!isSectionVisible(config)) return null;

  const style = config?.style || {};
  const manual = config?.selection?.mode === 'manual' && (config?.selection?.ids?.length ?? 0) > 0;
  // En mode manuel le bandeau accepte plus de logos que le nombre « vitrine » :
  // c'est le défilement qui les montre, pas la place disponible.
  const selected = manual
    ? applySelection(Array.isArray(partners) ? partners : [], { ...config!.selection!, limit: 0 }, { titleKey: 'name' })
    : (Array.isArray(partners) ? partners : []).slice(0, numberSetting(config, 'limit', 8));
  const logos = visibleItems(config).map((item) => ({
    name: String(item.label ?? item.name ?? ''),
    image: String(item.image ?? item.logo ?? ''),
  }));
  const rows = manual && logos.length ? logos : selected.map((partner) => ({ name: partner.name, image: '' }));
  if (!rows.length) return null;

  const duration = numberSetting(config, 'speed', 30);
  const direction = String(setting<string>(config, 'direction', 'left')) === 'right' ? 'reverse' : 'normal';
  const pauseOnHover = setting(config, 'pauseOnHover', true);
  const separator = String(config?.settings?.separator ?? ' • ');
  const label = txt(config, 'label', t('label'));
  const loop = [...rows, ...rows];

  return (
    <BuilderBlock config={config} sectionKey="partners-marquee">
      <section
        id="home-partners-marquee"
        className={`py-8 overflow-hidden ${BACKGROUND_CLASS[style.background || 'blue'] || 'bg-sari-blue text-white'}`}
        style={styleVars(config)}
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
              <span key={i} className="inline-block mx-8 text-xl font-bold opacity-80 items-center gap-3 flex">
                {row.image ? (
                  <img src={row.image} alt={row.name} className="h-8 w-auto object-contain" />
                ) : null}
                <span>
                  {row.name}
                  {separator}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </BuilderBlock>
  );
}
