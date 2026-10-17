// app/[locale]/not-found.tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  const locale = useLocale();
  const t = useTranslations('pages.visibility404');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f0f0f] pt-32 pb-24">
      <div className="text-center max-w-lg mx-auto px-6">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-7xl font-black text-sari-dark dark:text-white mb-4">404</h1>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-4">
          {t('pageNotFound')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('pageNotFoundDesc')}
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
        <div className="mt-10">
          <Link
            href={`/${locale}/search`}
            className="inline-flex items-center gap-2 text-sari-blue hover:underline font-medium"
          >
            <Search className="w-4 h-4" />
            {t('searchSite')}
          </Link>
        </div>
      </div>
    </div>
  );
}
