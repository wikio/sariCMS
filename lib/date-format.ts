// lib/date-format.ts
/**
 * Formatage des dates piloté par les paramètres du site.
 *
 * Le format choisi dans « Paramètres → Général → Dates & heures » s'applique
 * partout : administration (consultation, édition, tableaux) et vitrine.
 *
 * Deux familles de formats :
 *
 * 1. **Préréglages** (`short`, `medium`, `long`, `full`, `iso`, `relative`) —
 *    délégués à `Intl.DateTimeFormat`, donc traduits et adaptés à la langue
 *    active (y compris l'arabe).
 * 2. **Motif libre** — composé de jetons : `DD/MM/YYYY`, `D MMMM YYYY HH:mm`…
 *    Les noms de mois et de jours restent localisés.
 *
 * Les valeurs sont tolérantes : ISO-8601 (`2026-09-19T09:00:00.000Z`),
 * horodatage, `Date`, ou texte déjà mis en forme par un ancien jeu de données
 * (« 15 Janvier 2024 »), qui est alors renvoyé tel quel plutôt que transformé
 * en « Invalid Date ».
 */

export type SupportedLocale = 'fr' | 'en' | 'ar';

export interface DateFormatOptions {
  /** Préréglage ou motif libre. Par défaut : `medium`. */
  format?: string;
  /** Forcer l'affichage de l'heure. Par défaut : détecté sur la valeur. */
  includeTime?: boolean;
  /** Ne jamais afficher l'heure, même si la valeur en contient une. */
  dateOnly?: boolean;
  /** N'afficher que l'heure (flux d'activité, horodatages du jour). */
  timeOnly?: boolean;
  /** Valeur de repli si la date est absente ou illisible. */
  fallback?: string;
}

/** Préréglages proposés dans les paramètres. */
export interface DateFormatPreset {
  value: string;
  /** Libellé court affiché dans le sélecteur. */
  label: string;
  /** Explication affichée sous l'option. */
  note: string;
}

const LOCALE_TAGS: Record<SupportedLocale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  // `ar-DZ` suit le calendrier grégorien et des mois en chiffres latins,
  // contrairement à `ar-SA` (calendrier hégirien) qui dérouterait ici.
  ar: 'ar-DZ',
};

const PRESET_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: 'numeric', month: 'long', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  compact: { day: '2-digit', month: '2-digit', year: '2-digit' },
};

/**
 * Catalogue présenté dans les paramètres. `example` est calculé à l'affichage
 * pour que l'administrateur voie le rendu réel dans sa langue.
 */
export const DATE_FORMAT_PRESETS: DateFormatPreset[] = [
  { value: 'short', label: 'Court', note: 'Chiffres uniquement, compact.' },
  { value: 'medium', label: 'Moyen', note: 'Mois en toutes lettres. Recommandé.' },
  { value: 'long', label: 'Long', note: 'Avec le jour de la semaine.' },
  { value: 'iso', label: 'ISO 8601', note: 'Norme technique, tri alphabétique fiable.' },
  { value: 'relative', label: 'Relatif', note: '« il y a 3 jours », « dans 2 mois ».' },
  { value: 'DD/MM/YYYY', label: 'JJ/MM/AAAA', note: 'Usage courant en France et en Algérie.' },
  { value: 'MM/DD/YYYY', label: 'MM/JJ/AAAA', note: 'Usage nord-américain.' },
  { value: 'YYYY-MM-DD', label: 'AAAA-MM-JJ', note: 'Format trié, sans ambiguïté.' },
  { value: 'D MMMM YYYY', label: '5 janvier 2026', note: 'Mois en toutes lettres, sans zéro initial.' },
  { value: 'DD MMM YYYY', label: '05 janv. 2026', note: 'Mois abrégé.' },
  { value: 'dddd D MMMM YYYY', label: 'lundi 5 janvier 2026', note: 'Complet, avec le jour.' },
];

/**
 * Formats acceptés pour l'analyse automatique.
 *
 * On refuse volontairement le texte libre. `new Date()` interprète en effet
 * les chaînes non normalisées de façon incohérente selon le moteur : sur V8,
 * « 15 Janvier 2024 » donne bien le 15/01/2024, mais « 15-18 Mars 2024 » (une
 * plage rédigée à la main) devient silencieusement le 15 mars **2018**, et
 * « 22 Février 2024 » échoue. Ces valeurs viennent des anciens fichiers JSON :
 * mieux vaut les réafficher telles quelles que risquer une date fausse.
 */
const MACHINE_DATE_RE =
  /^(\d{4}-\d{2}-\d{2}([T\s].*)?|\d{1,2}\/\d{1,2}\/\d{4}|\d{10,13})$/;

/** `19/09/2026` — jour en premier, convention FR/DZ. */
const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Convertit une valeur quelconque en `Date`, ou `null` si illisible. */
function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  // Seuls les formats machine sont analysés (cf. commentaire ci-dessus).
  if (!MACHINE_DATE_RE.test(raw)) return null;

  // `19/09/2026` serait lu comme mois/jour par `new Date` (et rejeté au-delà
  // de 12) : on l'analyse explicitement en jour/mois/année.
  const dmy = raw.match(DMY_RE);
  if (dmy) {
    const [, day, month, year] = dmy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(/^\d{10,13}$/.test(raw) ? Number(raw) : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Indique si la valeur porte une heure significative.
 *
 * Une date seule (`2026-09-19`) est interprétée par JS à minuit UTC : on
 * inspecte donc la chaîne d'origine plutôt que l'objet `Date`, afin de ne pas
 * afficher « 00:00 » sur une date sans heure.
 */
export function valueHasTime(value: unknown): boolean {
  if (value instanceof Date) {
    return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return d.getHours() !== 0 || d.getMinutes() !== 0;
  }
  const raw = String(value ?? '');
  if (!raw) return false;
  // Pas de composante horaire dans la chaîne → date seule.
  if (!/[T\s]\d{1,2}:\d{2}/.test(raw)) return false;
  const d = toDate(raw);
  if (!d) return false;
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
}

/** `2026-09-19T09:00:00.000Z`, `2026-09-19`, `19/09/2026`… */
function looksLikeMachineDate(raw: string): boolean {
  return MACHINE_DATE_RE.test(raw);
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0');
}

/** Écart relatif (« il y a 3 jours ») via `Intl.RelativeTimeFormat`. */
function formatRelative(date: Date, locale: SupportedLocale): string {
  const tag = LOCALE_TAGS[locale] || LOCALE_TAGS.fr;
  const diffMs = date.getTime() - Date.now();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600e3],
    ['month', 30 * 24 * 3600e3],
    ['day', 24 * 3600e3],
    ['hour', 3600e3],
    ['minute', 60e3],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    for (const [unit, ms] of units) {
      if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
    }
    return rtf.format(0, 'minute');
  } catch {
    return date.toLocaleDateString(tag);
  }
}

/**
 * Applique un motif à jetons.
 *
 * Jetons reconnus : `YYYY` `YY` `MMMM` `MMM` `MM` `M` `DD` `D` `dddd` `ddd`
 * `HH` `H` `hh` `h` `mm` `ss` `A` `a`. Le texte entre crochets `[...]` est
 * conservé littéralement.
 */
function formatPattern(date: Date, pattern: string, locale: SupportedLocale): string {
  const tag = LOCALE_TAGS[locale] || LOCALE_TAGS.fr;
  const monthLong = date.toLocaleDateString(tag, { month: 'long' });
  const monthShort = date.toLocaleDateString(tag, { month: 'short' });
  const weekdayLong = date.toLocaleDateString(tag, { weekday: 'long' });
  const weekdayShort = date.toLocaleDateString(tag, { weekday: 'short' });
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;

  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: pad(date.getFullYear() % 100),
    MMMM: monthLong,
    MMM: monthShort,
    MM: pad(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad(date.getDate()),
    D: String(date.getDate()),
    dddd: weekdayLong,
    ddd: weekdayShort,
    HH: pad(hours24),
    H: String(hours24),
    hh: pad(hours12),
    h: String(hours12),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    A: hours24 < 12 ? 'AM' : 'PM',
    a: hours24 < 12 ? 'am' : 'pm',
  };

  // Les jetons longs d'abord, sinon `MM` consommerait le début de `MMMM`.
  const re = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|ss|A|a/g;
  return pattern.replace(re, (match, literal) =>
    literal !== undefined ? literal : tokens[match] ?? match,
  );
}

/** Le format est-il un motif libre plutôt qu'un préréglage ? */
function isPattern(format: string): boolean {
  return /[YMDHhmsa]/.test(format) && !(format in PRESET_OPTIONS) && format !== 'iso' && format !== 'relative';
}

/**
 * Formate une date selon le format retenu.
 *
 * Une valeur déjà lisible mais non analysable (« 15 Janvier 2024 », issue des
 * anciens fichiers JSON) est renvoyée inchangée : mieux vaut le texte
 * d'origine qu'un « Invalid Date ».
 */
export function formatDateWith(
  value: unknown,
  locale: SupportedLocale = 'fr',
  options: DateFormatOptions = {},
): string {
  const { format = 'medium', includeTime, dateOnly = false, timeOnly = false, fallback = '' } = options;

  if (value == null || value === '') return fallback;

  const date = toDate(value);
  if (!date) {
    const raw = String(value).trim();
    // Texte déjà mis en forme par un ancien jeu de données → tel quel.
    return raw && !looksLikeMachineDate(raw) ? raw : fallback;
  }

  const withTime = dateOnly ? false : includeTime ?? valueHasTime(value);
  const tag = LOCALE_TAGS[locale] || LOCALE_TAGS.fr;

  // Heure seule : la date est déjà connue par le contexte (« aujourd'hui »).
  if (timeOnly) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (format === 'iso') {
    const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return withTime ? `${iso} ${pad(date.getHours())}:${pad(date.getMinutes())}` : iso;
  }

  if (format === 'relative') return formatRelative(date, locale);

  if (isPattern(format)) {
    // Le motif porte déjà ses jetons horaires : on ne rajoute rien.
    const patternHasTime = /[Hhms]/.test(format.replace(/\[[^\]]*\]/g, ''));
    const effective = patternHasTime || !withTime ? format : `${format} HH:mm`;
    return formatPattern(date, effective, locale);
  }

  const base = PRESET_OPTIONS[format] || PRESET_OPTIONS.medium;
  const intlOptions: Intl.DateTimeFormatOptions = { ...base };
  if (withTime) {
    intlOptions.hour = '2-digit';
    intlOptions.minute = '2-digit';
  }

  try {
    return new Intl.DateTimeFormat(tag, intlOptions).format(date);
  } catch {
    return date.toLocaleDateString(tag);
  }
}

/** Aperçu d'un format, pour le sélecteur des paramètres. */
export function previewFormat(format: string, locale: SupportedLocale = 'fr'): string {
  const sample = new Date(2026, 0, 5, 14, 30, 0);
  return formatDateWith(sample, locale, { format, includeTime: true });
}

/**
 * Plage de dates (« du 5 au 8 janvier 2026 »). Si les deux extrémités sont
 * identiques une fois formatées, une seule date est renvoyée.
 */
export function formatDateRangeWith(
  start: unknown,
  end: unknown,
  locale: SupportedLocale = 'fr',
  options: DateFormatOptions = {},
): string {
  const from = formatDateWith(start, locale, options);
  if (!end) return from;
  const to = formatDateWith(end, locale, options);
  if (!to || from === to) return from;

  const separators: Record<SupportedLocale, string> = {
    fr: ' au ',
    en: ' to ',
    ar: ' إلى ',
  };
  return `${from}${separators[locale] || ' – '}${to}`;
}
