/**
 * Utilitaires de formatage de dates multi-langue
 */

export type Locale = 'fr' | 'en' | 'ar';

/**
 * Formate une date selon la locale
 * @param date - Date à formater (string, Date ou timestamp)
 * @param locale - Langue (fr, en, ar)
 * @param options - Options de formatage
 */
export function formatDate(
  date: string | Date | number,
  locale: Locale = 'fr',
  options: {
    includeTime?: boolean;
    format?: 'short' | 'medium' | 'long';
  } = {}
): string {
  const { includeTime = false, format = 'medium' } = options;

  // Convertir en objet Date
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  // Vérifier si la date est valide
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Mapper les locales vers les codes BCP 47
  const localeMap: Record<Locale, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    ar: 'ar-SA',
  };

  // Options de formatage selon le format demandé
  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
    },
    medium: {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
    long: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  };

  const selectedOptions = { ...formatOptions[format] };

  // Ajouter l'heure si demandé
  if (includeTime) {
    selectedOptions.hour = '2-digit';
    selectedOptions.minute = '2-digit';
  }

  try {
    return dateObj.toLocaleDateString(localeMap[locale], selectedOptions);
  } catch (error) {
    console.error('Erreur de formatage de date:', error);
    return dateObj.toLocaleDateString();
  }
}

/**
 * Formate une plage de dates (début - fin)
 * @param startDate - Date de début
 * @param endDate - Date de fin (optionnelle)
 * @param locale - Langue
 */
export function formatDateRange(
  startDate: string | Date | number,
  endDate?: string | Date | number,
  locale: Locale = 'fr'
): string {
  const start = formatDate(startDate, locale, { format: 'medium' });
  
  if (!endDate) {
    return start;
  }

  const end = formatDate(endDate, locale, { format: 'medium' });
  
  // Si les dates sont identiques, retourner une seule date
  if (start === end) {
    return start;
  }

  // Séparateur selon la locale
  const separators: Record<Locale, string> = {
    fr: ' au ',
    en: ' to ',
    ar: ' إلى ',
  };

  return `${start}${separators[locale]}${end}`;
}

/**
 * Vérifie si une date inclut une heure (non-midnight)
 */
export function hasTime(date: string | Date | number): boolean {
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return false;
  }

  return dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
}

/**
 * Extrait les parties d'une date (jour, mois, année) formatées selon la locale
 * @param date - Date à formater
 * @param locale - Langue
 */
export function formatDateParts(
  date: string | Date | number,
  locale: Locale = 'fr'
): { day: string; month: string; year: string } {
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return { day: '', month: '', year: '' };
  }

  const localeMap: Record<Locale, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    ar: 'ar-SA',
  };

  const day = dateObj.toLocaleDateString(localeMap[locale], { day: 'numeric' });
  const month = dateObj.toLocaleDateString(localeMap[locale], { month: 'short' });
  const year = dateObj.toLocaleDateString(localeMap[locale], { year: 'numeric' });

  return { day, month, year };
}
