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
