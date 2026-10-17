// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { locales, defaultLocale, type Locale } from '../lib/i18n';

/**
 * Les chaînes de l'interface, lues là où elles vivent — pas dans une copie à générer.
 *
 * Avant, ce fichier faisait `import('../translate/<locale>.json')`, le fichier plat
 * que `npm run merge:translations` fabrique à partir de `messages/` à chaque
 * démarrage. Trois conséquences, toutes vraies en même temps : un `git pull` qui
 * ajoutait des clés laissait le site sur la copie d'hier tant que le script n'avait
 * pas rejoué ; une retouche enregistrée depuis l'écran « Traductions » — qui écrit
 * dans l'arborescence, pas dans le plat — ne passait jamais ; et l'`import()` étant
 * mis en cache par le bundler, redémarrer était de toute façon nécessaire.
 *
 * Donc : lecture du fichier à chaque requête, avec un cache par date de modification
 * — une `stat` par requête, pas un parse de 4 000 clés. `messages/<locale>.json`
 * d'abord (la source, celle que l'écran tient à jour et que git suit), `translate/
 * <locale>.json` ensuite pour les déploiements qui n'embarquent que la copie, et en
 * dernier ressort l'`import()` compilé dans le bundle.
 */
const cache = new Map<string, { mtime: number; messages: Record<string, unknown> }>();

function readFresh(file: string): Record<string, unknown> | null {
  try {
    if (!existsSync(file)) return null;
    const { mtimeMs } = statSync(file);
    const hit = cache.get(file);
    if (hit && hit.mtime === mtimeMs) return hit.messages;
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    cache.set(file, { mtime: mtimeMs, messages: parsed });
    return parsed;
  } catch (error) {
    console.error(`❌ [i18n] ${file} illisible:`, error);
    return null;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Récupère la locale demandée (ex: 'fr', 'en', 'ar')
  let locale = await requestLocale;

  // Fallback vers la langue par défaut si la locale est invalide ou manquante
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  const messages =
    readFresh(join(process.cwd(), 'messages', `${locale}.json`)) ??
    readFresh(join(process.cwd(), 'translate', `${locale}.json`)) ??
    // Dernier recours : la copie compilée dans le bundle (déploiement sans les
    // fichiers à côté du serveur). En dev et en `next start` classiques, on n'y
    // arrive pas.
    ((await import(`../translate/${locale}.json`).catch(() => null)) as { default?: Record<string, unknown> } | null)
      ?.default ??
    {};

  return {
    locale,
    messages,

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
      if ((error as { code?: string }).code === 'MISSING_MESSAGE') {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Message manquant: ${error.message}`);
        }
      } else {
        console.error('❌ Erreur next-intl:', error);
      }
    }
  };
});
