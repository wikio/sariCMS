// components/layout/NotFound.tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Home, Search, ArrowLeft, AlertCircle } from 'lucide-react';

export default function NotFound() {
  const locale = useLocale();
  const t = useTranslations('components.layout.NotFound');

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* Icône animée */}
        <div className="relative mb-8 inline-block">
          <div className="absolute inset-0 bg-sari-blue/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative w-32 h-32 bg-gradient-to-br from-sari-blue to-sari-dark rounded-full flex items-center justify-center shadow-2xl">
            <AlertCircle className="w-16 h-16 text-white" />
          </div>
        </div>

        {/* Code 404 */}
        <h1 className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sari-blue to-sari-lime mb-4">
          404
        </h1>

        {/* Titre */}
        <h2 className="text-3xl md:text-4xl font-bold text-sari-dark dark:text-white mb-4">
          {t('title')}
        </h2>

        {/* Description */}
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {t('description')}
        </p>

        {/* Suggestions */}
        <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-6 mb-8 border border-gray-200 dark:border-gray-800">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center justify-center gap-2">
            <Search className="w-5 h-5 text-sari-blue" />
            {t('suggestions')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Link 
              href={`/${locale}/produits`}
              className="text-gray-600 dark:text-gray-400 hover:text-sari-blue dark:hover:text-sari-blue transition-colors"
            >
              → {t('browseProducts')}
            </Link>
            <Link 
              href={`/${locale}/services`}
              className="text-gray-600 dark:text-gray-400 hover:text-sari-blue dark:hover:text-sari-blue transition-colors"
            >
              → {t('ourServices')}
            </Link>
            <Link 
              href={`/${locale}/solutions`}
              className="text-gray-600 dark:text-gray-400 hover:text-sari-blue dark:hover:text-sari-blue transition-colors"
            >
              → {t('ourSolutions')}
            </Link>
            <Link 
              href={`/${locale}/contact`}
              className="text-gray-600 dark:text-gray-400 hover:text-sari-blue dark:hover:text-sari-blue transition-colors"
            >
              → {t('contactUs')}
            </Link>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`/${locale}`}
            className="btn-primary text-white px-8 py-3 font-semibold rounded-lg inline-flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            {t('backToHome')}
          </Link>
          <button
            onClick={() => window.history.back()}
            className="bg-gray-100 dark:bg-gray-800 text-sari-dark dark:text-white px-8 py-3 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('goBack')}
          </button>
        </div>

        {/* Support */}
        <p className="mt-12 text-sm text-gray-500 dark:text-gray-400">
          {t('needHelp')}{' '}
          <Link 
            href={`/${locale}/contact`}
            className="text-sari-blue hover:underline font-medium"
          >
            {t('contactSupport')}
          </Link>
        </p>
      </div>
    </div>
  );
}