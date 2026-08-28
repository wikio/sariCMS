'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LanguageIndicatorProps {
  contentLocale: string;
  requestedLocale: string;
}

/**
 * Affiche un avertissement si le contenu n'est pas disponible dans la langue demandée
 */
export default function LanguageIndicator({ contentLocale, requestedLocale }: LanguageIndicatorProps) {
  const t = useTranslations('common');
  
  // Si le contenu est dans la langue demandée, ne rien afficher
  if (contentLocale === requestedLocale) {
    return null;
  }
  
  // Messages selon la langue demandée
  const messages: Record<string, { text: string; lang: string }> = {
    fr: {
      text: 'Ce contenu n\'est disponible qu\'en',
      lang: contentLocale === 'en' ? 'anglais' : contentLocale === 'ar' ? 'arabe' : 'français',
    },
    en: {
      text: 'This content is only available in',
      lang: contentLocale === 'fr' ? 'French' : contentLocale === 'ar' ? 'Arabic' : 'English',
    },
    ar: {
      text: 'هذا المحتوى متوفر فقط ب',
      lang: contentLocale === 'fr' ? 'الفرنسية' : contentLocale === 'en' ? 'الإنجليزية' : 'العربية',
    },
  };
  
  const message = messages[requestedLocale] || messages.fr;
  
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 py-3">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>
            {message.text} <strong>{message.lang}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
