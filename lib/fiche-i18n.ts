type Bundle = Record<string, Record<string, Record<string, string>>>;

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

export function loadFicheLocale(resource: string, id: string, locale: string): Record<string, string> {
  return read()[ficheKey(resource, id)]?.[locale] || {};
}

export function saveFicheLocale(resource: string, id: string, locale: string, fields: Record<string, string>) {
  const bundle = read();
  const key = ficheKey(resource, id);
  bundle[key] = { ...(bundle[key] || {}), [locale]: fields };
  write(bundle);
}

export function resolveField(
  value: unknown,
  resource: string,
  id: string | undefined,
  locale: string,
  defaultLocale: string,
  field: string,
): string {
  const primary = String(value ?? '');
  if (locale === defaultLocale) return primary;
  if (!id) return primary;
  const translated = loadFicheLocale(resource, id, locale)[field];
  return translated || primary;
}
