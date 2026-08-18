// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '../lib/i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  // Récupère la locale demandée (ex: 'fr', 'en', 'ar')
  let locale = await requestLocale;

  // Fallback vers la langue par défaut si la locale est invalide ou manquante
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  console.log(`🌍 [i18n] getRequestConfig appelé avec locale: ${locale}`);

  return {
    locale,
    
    // ✅ Charge le fichier JSON fusionné généré par le script
    messages: (await import(`../translate/${locale}.json`)).default,
    
    // Configuration optionnelle mais recommandée
    timeZone: 'Africa/Algiers',
    
    formats: {
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      },
      number: {
        currency: {
          style: 'currency',
          currency: 'DZD',
          minimumFractionDigits: 2
        }
      }
    },

    // Gestion des erreurs de traduction en développement
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Message manquant: ${error.message}`);
        }
      } else {
        console.error('❌ Erreur next-intl:', error);
      }
    }
  };
});