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
 * Traduit un slug en fonction de la langue cible
 * @param resource - Le nom de la ressource (ex: 'solutions', 'services')
 * @param currentSlug - Le slug actuel
 * @param currentLocale - La langue actuelle
 * @param targetLocale - La langue cible
 * @returns Le slug traduit ou le slug original si pas de traduction
 */
export function translateSlug(
  resource: string,
  currentSlug: string,
  currentLocale: string,
  targetLocale: string
): string {
  if (currentLocale === targetLocale) return currentSlug;
  
  const bundle = read();
  
  // Chercher dans toutes les fiches de la ressource
  for (const [key, translations] of Object.entries(bundle)) {
    if (!key.startsWith(`${resource}:`)) continue;
    
    const currentTranslation = translations[currentLocale];
    const targetTranslation = translations[targetLocale];
    
    // Si on trouve la fiche avec le slug actuel
    if (currentTranslation?.slug === currentSlug && targetTranslation?.slug) {
      return targetTranslation.slug as string;
    }
  }
  
  // Pas de traduction trouvée, retourner le slug original
  return currentSlug;
}
