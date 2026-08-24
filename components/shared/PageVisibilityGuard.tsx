// components/shared/PageVisibilityGuard.tsx
'use client';

import { useVisibility } from '@/lib/site-visibility';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

interface PageVisibilityGuardProps {
  /** Clé de visibilité, ex : 'page.about', 'module.products' */
  visibilityKey: string;
  children: ReactNode;
}

/**
 * Si la page est masquée dans la config de visibilité vitrine, affiche
 * une page 404 élégante au lieu du contenu (évite les erreurs).
 * Sinon, affiche le contenu normalement.
 */
export default function PageVisibilityGuard({ visibilityKey, children }: PageVisibilityGuardProps) {
  const visibility = useVisibility();
  const locale = useLocale();
  const t = useTranslations('pages.visibility404');

  if (visibility[visibilityKey] === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f0f0f] pt-32 pb-24">
        <div className="text-center max-w-lg mx-auto px-6">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-6xl font-black text-sari-dark dark:text-white mb-4">404</h1>
          <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-4">
            {t('pageUnavailable')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            {t('pageUnavailableDesc')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-2 bg-sari-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-sari-blue/90 transition-colors"
            >
              <Home className="w-4 h-4" />
              {t('backHome')}
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sari-dark dark:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('previousPage')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
