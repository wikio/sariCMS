// components/sections/FeaturedProducts.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ProductCard from '@/components/cards/ProductCard';
import type { Product } from '@/types';

interface FeaturedProductsProps {
  products: Product[];
  count?: number;
}

export default function FeaturedProducts({ products, count = 4 }: FeaturedProductsProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.FeaturedProducts');

  const safeProducts = Array.isArray(products) ? products : [];
  const featured = safeProducts.slice(0, count);
console.log('featured.length : '+featured[0].id) 

//  const featured = products.slice(0, count);

  if (featured.length === 0) return null;

  return (
    <section className="py-24 bg-white dark:bg-[#1a1a1a]">
      <div className="container mx-auto px-6">
        {/* Titre de section */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
          <div>
            <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
              {t('subtitle')}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-4 mb-4">
              {t('title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
              {t('description')}
            </p>
          </div>
          <Link
            href={`/${locale}/products`}
            className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            {t('viewAll')}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>

        {/* Grille de produits */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {featured.map((product) => {
            // 🔍 DEBUG: Log avant le rendu de chaque carte
            console.log(`🎨 Rendu ProductCard pour produit ID ${product.id}:`, product.name);
            
            return (
              <ProductCard 
                key={product.id} 
                product={product} 
                variant="featured" 
              />
            );
          })}
        </div>

        {/* Grille de produits
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} variant="featured" />
          ))}
        </div>
 */}
      </div>
    </section>
  );
}