// components/layout/FloatingCartButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export default function FloatingCartButton() {
  const [isHovered, setIsHovered] = useState(false);
  const locale = useLocale();
  const t = useTranslations('components.layout.FloatingCartButton');
  const { items: cart } = useCart();

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cartCount === 0) return null;

  // ✅ Correction des clés de traduction
  const itemText = cartCount === 1 ? t('item') : t('items');

  return (
    <div 
      className="fixed bottom-8 right-8 z-40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={`/${locale}/cart`}
        className="relative bg-sari-blue text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300"
        aria-label={`${t('viewQuote')} (${cartCount} ${itemText})`}
      >
        <ShoppingCart className="w-7 h-7" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold animate-pulse">
          {cartCount > 9 ? '9+' : cartCount}
        </span>
      </Link>
      
      {isHovered && (
        <div className="absolute bottom-full right-0 mb-2 bg-sari-dark text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl animate-fade-in-up">
          {t('viewQuote')} ({cartCount} {itemText})
          <div className="absolute top-full right-6 w-2 h-2 bg-sari-dark transform rotate-45 -mt-1"></div>
        </div>
      )}
    </div>
  );
}