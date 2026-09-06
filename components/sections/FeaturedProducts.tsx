// components/sections/FeaturedProducts.tsx
'use client';

/**
 * Produits phares de la page d'accueil.
 *
 * Le titre, la description, le nombre de produits et la liste des fiches
 * affichées se règlent dans le studio (`lib/home/catalog.ts`). En mode
 * « automatique » on prend les N premiers produits du catalogue ; en mode
 * « choisi », les fiches sélectionnées, dans l'ordre où l'administrateur les a
 * rangées. Une fiche retirée du catalogue disparaît de la page sans laisser de
 * trou.
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ProductCard from '@/components/cards/ProductCard';
import type { Product } from '@/types';
import {
  applySelection,
  limitOf,
  localizeHref,
  setting,
  selectionFor,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';
import SectionFrame, { gridProps } from '@/components/sections/SectionFrame';

interface FeaturedProductsProps {
  products: Product[];
  count?: number;
  config?: HomeSectionConfig;
}

export default function FeaturedProducts({ products, count = 4, config }: FeaturedProductsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.FeaturedProducts');

  const safeProducts = Array.isArray(products) ? products : [];
  const featured = applySelection(safeProducts, selectionFor(config, count), {
    titleKey: 'name',
  });

  const showAll = setting(config, 'showViewAll', true);
  const viewAllHref = localizeHref(config?.settings?.ctaHref, locale, `/${locale}/products`);
  const variant = (setting(config, 'cardVariant', 'featured') as 'featured' | 'standard' | 'compact') || 'featured';
  const grid = gridProps(config, limitOf(config, count) >= 4 ? 4 : limitOf(config, count), 24);

  if (featured.length === 0) return null;

  return (
    <SectionFrame
      sectionKey="products"
      config={config}
      header={{
        fallbacks: { subtitle: t('subtitle'), title: t('title'), description: t('description') },
        action: showAll ? (
          <Link
            href={viewAllHref}
            className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            {txt(config, 'viewAllLabel', t('viewAll'))}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        ) : null,
      }}
    >
      <div {...grid} className={`${grid.className} stagger-children`}>
        {featured.map((product) => (
          <ProductCard
            key={String(product.id)}
            product={product}
            variant={variant}
            showPrice={setting(config, 'showPrice', true)}
            showStock={setting(config, 'showStock', true)}
          />
        ))}
      </div>
    </SectionFrame>
  );
}
