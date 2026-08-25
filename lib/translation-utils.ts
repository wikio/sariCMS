/**
 * Utilitaires pour gérer les traductions et les IDs multilingues
 */

import type { Event, News } from '@/types';

/**
 * Génère un legacyId unique pour lier les versions linguistiques
 */
export function generateLegacyId(): string {
  return `lg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Trouve la traduction d'un événement par legacyId et locale
 * @param events - Liste de tous les événements
 * @param legacyId - LegacyId de l'événement recherché
 * @param targetLocale - Locale cible (fr, en, ar)
 * @returns L'événement dans la locale cible ou null si non trouvé
 */
export function findEventTranslation(
  events: Event[],
  legacyId: string,
  targetLocale: string
): Event | null {
  return events.find(
    (event) => event.legacyId === legacyId && event.locale === targetLocale
  ) || null;
}

/**
 * Trouve la traduction d'une actualité par legacyId et locale
 * @param news - Liste de toutes les actualités
 * @param legacyId - LegacyId de l'actualité recherchée
 * @param targetLocale - Locale cible (fr, en, ar)
 * @returns L'actualité dans la locale cible ou null si non trouvé
 */
export function findNewsTranslation(
  news: News[],
  legacyId: string,
  targetLocale: string
): News | null {
  return news.find(
    (article) => article.legacyId === legacyId && article.locale === targetLocale
  ) || null;
}

/**
 * Construit une URL avec legacyId pour le routage multilingue
 * @param basePath - Chemin de base (ex: '/events' ou '/news')
 * @param legacyId - LegacyId du contenu
 * @param slug - Slug du contenu
 * @returns URL formatée avec legacyId
 */
export function buildMultilingualUrl(
  basePath: string,
  legacyId: string,
  slug?: string
): string {
  if (slug) {
    return `${basePath}/${legacyId}-${slug}`;
  }
  return `${basePath}/${legacyId}`;
}

/**
 * Extrait le legacyId d'une URL
 * @param urlSegment - Segment d'URL (ex: 'lg_1234567890_abc123-salon-medical')
 * @returns Le legacyId ou null si non trouvé
 */
export function extractLegacyId(urlSegment: string): string | null {
  const match = urlSegment.match(/^(lg_[^_]+_[^-]+)/);
  return match ? match[1] : null;
}

/**
 * Assigne un legacyId à un contenu s'il n'en a pas déjà un
 * @param item - Contenu (Event ou News)
 * @returns Le contenu avec legacyId assigné
 */
export function ensureLegacyId<T extends { legacyId?: string }>(item: T): T {
  if (!item.legacyId) {
    return { ...item, legacyId: generateLegacyId() };
  }
  return item;
}

/**
 * Propage le legacyId d'un contenu source vers ses traductions
 * @param source - Contenu source avec legacyId
 * @param translations - Liste des traductions à mettre à jour
 * @returns Liste des traductions avec legacyId propagé
 */
export function propagateLegacyId<T extends { legacyId?: string }>(
  source: T,
  translations: T[]
): T[] {
  if (!source.legacyId) return translations;
  
  return translations.map((translation) => ({
    ...translation,
    legacyId: source.legacyId,
  }));
}
