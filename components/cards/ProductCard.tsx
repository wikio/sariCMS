// components/cards/ProductCard.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { BadgeCheck, Clock, ShoppingCart, ChevronRight, Package } from 'lucide-react';
import { slugify } from '@/lib/slugify';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  variant?: 'standard' | 'compact' | 'featured';
  onClick?: (product: Product) => void;
}

export default function ProductCard({ product, variant = 'standard', onClick }: ProductCardProps) {
  const locale = useLocale();
  const t = useTranslations('components.cards.ProductCard');

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(product);
    }
  };

  // ✅ URL avec slug SEO
  const productUrl = `/${locale}/products/${product.id}-${slugify(product.name)}`;

  // === Variante COMPACT ===
  if (variant === 'compact') {
    return (
      <Link
        href={productUrl}
        onClick={handleClick}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-all cursor-pointer flex gap-4 group"
      >
        <div className="w-24 h-24 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Package className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-block px-2 py-0.5 bg-sari-blue/10 text-sari-blue text-xs font-semibold rounded mb-1">
            {product.category}
          </span>
          <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-1">
            {product.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
            {product.shortDesc}
          </p>
          <div className="text-sari-lime font-bold mt-2">{product.price}</div>
        </div>
      </Link>
    );
  }

  // === Variante FEATURED ===
  if (variant === 'featured') {
    return (
      <Link
        href={productUrl}
        onClick={handleClick}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 overflow-hidden card-hover group flex flex-col h-full"
      >
        <div className="aspect-square overflow-hidden relative">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
              <Package className="w-16 h-16" />
            </div>
          )}
          <div className="absolute top-4 right-4">
            <span className="bg-sari-lime text-sari-dark px-2 py-1 text-xs font-bold rounded">
              {product.price}
            </span>
          </div>
          {!product.inStock && (
            <div className="absolute top-4 left-4">
              <span className="bg-red-500 text-white px-2 py-1 text-xs font-bold rounded flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('outOfStock')}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-sari-blue/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="bg-white text-sari-blue px-6 py-3 font-semibold transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              {t('viewDetails')}
            </span>
          </div>
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <span className="inline-block px-2 py-0.5 bg-sari-blue/10 text-sari-blue text-xs font-semibold rounded mb-2 w-fit">
            {product.category}
          </span>
          <h3 className="text-lg font-bold text-sari-dark dark:text-white mb-2 line-clamp-2 group-hover:text-sari-blue transition-colors">
            {product.name}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
            {product.shortDesc}
          </p>
        </div>
      </Link>
    );
  }

  // === Variante STANDARD (par défaut) ===
  return (
    <Link
      href={productUrl}
      onClick={handleClick}
      className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 rounded-xl hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full"
    >
      {/* Image */}
      <div className="aspect-[4/3] mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package className="w-16 h-16" />
          </div>
        )}
      </div>

      {/* Badge catégorie */}
      <span className="inline-block px-2 py-0.5 bg-sari-blue/10 text-sari-blue text-xs font-semibold rounded mb-2 w-fit">
        {product.category}
      </span>

      {/* Titre */}
      <h3 className="font-bold text-sari-dark dark:text-white text-lg mb-2 group-hover:text-sari-blue transition-colors line-clamp-2 min-h-[3.5rem]">
        {product.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 min-h-[2.5rem]">
        {product.shortDesc}
      </p>

      {/* Prix et stock */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sari-lime font-bold text-xl">{product.price}</div>
        {product.inStock ? (
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 text-xs font-semibold rounded flex items-center gap-1">
            <BadgeCheck className="w-3 h-3" />
            {t('inStock')}
          </span>
        ) : (
          <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 text-xs font-semibold rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {product.deliveryTime || t('deliveryTime')}
          </span>
        )}
      </div>

      {/* Bouton */}
      <button className="w-full bg-sari-blue hover:bg-sari-blue/90 text-white px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-auto">
        {t('viewDetails')}
        <ChevronRight className="w-4 h-4" />
      </button>
    </Link>
  );
}