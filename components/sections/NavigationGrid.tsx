// components/sections/NavigationGrid.tsx
'use client';

/**
 * Grille de navigation (« Explorez nos univers »).
 *
 * Tuiles entièrement composées dans le studio : icône, titre, description,
 * image, destination. Sans enregistrement, les six tuiles historiques du site
 * sont reprises depuis les traductions.
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLucideIcon } from '@/lib/lucide-icons';
import { localizeHref, setting, visibleItems, type HomeItem, type HomeSectionConfig } from '@/lib/home/config';
import SectionFrame, { HS_CARD_RADIUS } from '@/components/sections/SectionFrame';

interface NavigationGridProps {
  config?: HomeSectionConfig;
}

export default function NavigationGrid({ config }: NavigationGridProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.NavigationGrid');
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

  const defaults: HomeItem[] = [
    { id: 'solutions', icon: 'stethoscope', titleKey: 'solutions', descKey: 'solutionsDesc', href: '/solutions', image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800' },
    { id: 'services', icon: 'wrench', titleKey: 'services', descKey: 'servicesDesc', href: '/services', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800' },
    { id: 'products', icon: 'package', titleKey: 'products', descKey: 'productsDesc', href: '/products', image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800' },
    { id: 'events', icon: 'calendar', titleKey: 'events', descKey: 'eventsDesc', href: '/events', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800' },
    { id: 'news', icon: 'newspaper', titleKey: 'news', descKey: 'newsDesc', href: '/news', image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800' },
    { id: 'careers', icon: 'users', titleKey: 'careers', descKey: 'careersDesc', href: '/careers', image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800' },
  ];

  const custom = visibleItems(config);
  const tiles = custom.length ? custom : defaults;
  const showMore = setting(config, 'showMore', true);
  const moreLabel = t('learnMore');
  const columns = config?.style?.columns || (custom.length ? Math.min(3, Math.max(2, custom.length)) : 3);

  return (
    <SectionFrame
      sectionKey="navigation"
      config={config}
      header={{
        align: 'center',
        fallbacks: { subtitle: t('subtitle'), title: t('title'), description: t('description') },
      }}
    >
      <div
        className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:[grid-template-columns:repeat(var(--hs-cols,3),minmax(0,1fr))]"
        style={{ ['--hs-cols' as string]: String(columns), ['--hs-gap' as string]: `${config?.style?.gap ?? 32}px`, gap: `${config?.style?.gap ?? 32}px` }}
      >
        {tiles.map((tile: HomeItem, i: number) => {
          const isDefault = custom.length === 0;
          const title = isDefault
            ? t(String(tile.titleKey))
            : String(tile.title ?? (tile.titleKey ? t(String(tile.titleKey)) : ''));
          const desc = isDefault
            ? t(String(tile.descKey))
            : String(tile.description ?? (tile.descKey ? t(String(tile.descKey)) : ''));
          const href = localizeHref(tile.href ?? tile.link, locale, `/${locale}/sitemap`);
          const Icon = getLucideIcon(String(tile.icon || 'arrow-right'));
          const radius = config?.style?.radius ?? 0;
          return (
            <Link
              key={String(tile.id ?? i)}
              href={href}
              className="group bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover overflow-hidden relative block"
              style={{ borderRadius: `${radius}px` }}
            >
              <div className="h-48 overflow-hidden relative">
                <img
                  src={String(tile.image || '')}
                  alt={title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-6 relative">
                <div className={`w-12 h-12 bg-sari-blue flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 ${HS_CARD_RADIUS}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{title}</h3>
                {desc ? <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{desc}</p> : null}
                {showMore ? (
                  <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                    {String(tile.ctaLabel || '') || moreLabel}
                    <ArrowIcon className="w-4 h-4" />
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </SectionFrame>
  );
}
