type Bundle = Record<string, Record<string, Record<string, unknown>>>;

const KEY = 'sari_fiche_i18n';

function read(): Bundle {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Bundle;
  } catch {
    return {};
  }
}

function write(bundle: Bundle) {
  localStorage.setItem(KEY, JSON.stringify(bundle));
}

export function ficheKey(resource: string, id: string) {
  return `${resource}:${id}`;
}

export function loadFicheLocale(resource: string, id: string, locale: string): Record<string, unknown> {
  if (!id) return {};
  return { ...(read()[ficheKey(resource, id)]?.[locale] || {}) };
}

export function saveFicheLocale(resource: string, id: string, locale: string, fields: Record<string, unknown>) {
  if (!id) return;
  const bundle = read();
  const key = ficheKey(resource, id);
  bundle[key] = { ...(bundle[key] || {}), [locale]: fields };
  write(bundle);
}

export function isTranslatableField(kind: string, flagged?: boolean) {
  if (flagged) return true;
  return ['text', 'textarea', 'html', 'slug', 'list', 'tags', 'faq', 'specs', 'options', 'agenda', 'slides', 'sections', 'process'].includes(kind);
}

/**
 * Récupère le slug traduit d'une fiche identifiée par son ID.
 * C'est la voie la plus fiable : l'ID est stable entre les langues.
 *
 * @param resource - Ressource CMS (ex: 'solutions', 'services')
 * @param id - Identifiant de la fiche
 * @param targetLocale - Langue cible
 * @returns Le slug traduit, ou null si aucune traduction enregistrée
 */
export function ficheSlug(resource: string, id: string, targetLocale: string): string | null {
  if (!id) return null;
  const value = loadFicheLocale(resource, id, targetLocale).slug;
  const slug = typeof value === 'string' ? value.trim() : '';
  return slug || null;
}

/**
 * Traduit un slug en fonction de la langue cible.
 *
 * Deux stratégies, dans l'ordre :
 *   1. par ID   — le segment d'URL commence par l'ID de la fiche (`12-mon-slug`)
 *   2. par slug — on retrouve la fiche dont le slug de la langue courante
 *                 correspond, puis on lit son slug dans la langue cible
 *
 * @param resource - Le nom de la ressource (ex: 'solutions', 'services')
 * @param currentSlug - Le slug (ou segment `id-slug`) actuel
 * @param currentLocale - La langue actuelle
 * @param targetLocale - La langue cible
 * @param id - Identifiant de la fiche, si connu (recherche directe)
 * @returns Le slug traduit ou le slug original si pas de traduction
 */
export function translateSlug(
  resource: string,
  currentSlug: string,
  currentLocale: string,
  targetLocale: string,
  id?: string,
): string {
  if (currentLocale === targetLocale) return currentSlug;

  // 1) Recherche directe par ID (le plus fiable)
  const head = String(currentSlug || '').split('-')[0];
  const lookupId = id || (/^\d+$/.test(head) ? head : '');
  if (lookupId) {
    const translated = ficheSlug(resource, lookupId, targetLocale);
    if (translated) return translated;
  }

  const bundle = read();

  // 2) Recherche par correspondance de slug dans la langue courante
  for (const [key, translations] of Object.entries(bundle)) {
    if (!key.startsWith(`${resource}:`)) continue;

    const currentTranslation = translations[currentLocale];
    const targetTranslation = translations[targetLocale];

    if (currentTranslation?.slug === currentSlug && targetTranslation?.slug) {
      return targetTranslation.slug as string;
    }
  }

  // Pas de traduction trouvée, retourner le slug original
  return currentSlug;
}
