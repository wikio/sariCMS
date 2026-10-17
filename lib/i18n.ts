// lib/i18n.ts
export const locales = ['fr', 'en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

// Accepte une chaîne quelconque : la locale provient souvent des params de
// route, typés `string`, avant toute validation.
export function isRtl(locale: Locale | string): boolean {
  return locale === 'ar';
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}