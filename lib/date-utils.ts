/**
 * Utilitaires de formatage de dates — usage hors composants React.
 *
 * ⚠️ Dans un composant, préférer `useDateUtils()` (`lib/use-date-format.ts`) :
 * ces fonctions lisent `localStorage` de façon synchrone, ce qui provoquerait
 * une divergence d'hydratation dans une page rendue côté serveur. Elles sont
 * conservées pour le code non-React (scripts, exports, utilitaires).
 *
 * Le formatage est délégué à `lib/date-format.ts`, piloté par le format choisi
 * dans « Paramètres → Général → Dates & heures ».
 *
 * Les préréglages historiques (`short` / `medium` / `long`) ne sont plus des
 * formats figés : ils indiquent seulement une intention de densité. Le format
 * de l'administration l'emporte, sauf quand il est lui-même un préréglage
 * générique — auquel cas l'intention d'origine est respectée.
 *
 * Ces fonctions sont appelées pendant le rendu de composants clients ; elles
 * lisent donc les paramètres de façon synchrone plutôt que par un hook, afin
 * de rester utilisables dans les `.map()` et les expressions JSX.
 */

import { loadAdminSettings, DEFAULT_SETTINGS } from '@/lib/admin-settings';
import {
  formatDateWith,
  formatDateRangeWith,
  valueHasTime,
  type SupportedLocale,
} from '@/lib/date-format';

export type Locale = SupportedLocale;

/** Préréglages « génériques » : le réglage admin prime sur l'intention locale. */
const GENERIC_PRESETS = new Set(['short', 'medium', 'long', 'full', 'compact']);

/** Format configuré, avec repli sûr côté serveur (localStorage indisponible). */
function configuredFormat(): string {
  try {
    return loadAdminSettings().dates.format || DEFAULT_SETTINGS.dates.format;
  } catch {
    return DEFAULT_SETTINGS.dates.format;
  }
}

function configuredShowTime(): boolean {
  try {
    return loadAdminSettings().dates.showTime;
  } catch {
    return DEFAULT_SETTINGS.dates.showTime;
  }
}

/**
 * Détermine le format effectif.
 *
 * Si l'administrateur a choisi un motif précis (`DD/MM/YYYY`, `iso`,
 * `relative`…), il s'applique partout. S'il est resté sur un préréglage
 * générique, l'intention du site (`short` pour une vignette, `medium` pour un
 * titre) est conservée.
 */
function effectiveFormat(requested?: 'short' | 'medium' | 'long'): string {
  const configured = configuredFormat();
  if (!GENERIC_PRESETS.has(configured)) return configured;
  return requested || configured;
}

/**
 * Formate une date selon la locale et le format configuré.
 *
 * @param date - Date à formater (chaîne, `Date` ou horodatage)
 * @param locale - Langue (fr, en, ar)
 * @param options - `includeTime` force l'heure, `format` exprime une intention
 */
export function formatDate(
  date: string | Date | number,
  locale: Locale = 'fr',
  options: {
    includeTime?: boolean;
    format?: 'short' | 'medium' | 'long';
  } = {},
): string {
  const { includeTime, format } = options;
  const showTime = configuredShowTime();

  return formatDateWith(date, locale, {
    format: effectiveFormat(format),
    // L'heure s'affiche si elle est demandée explicitement, ou si la valeur en
    // porte une et que les paramètres l'autorisent.
    includeTime: includeTime === true ? true : undefined,
    dateOnly: includeTime === true ? false : !showTime,
  });
}

/**
 * Formate une plage de dates (« du 5 au 8 janvier 2026 »).
 * Si les deux dates sont identiques, une seule est renvoyée.
 */
export function formatDateRange(
  startDate: string | Date | number,
  endDate?: string | Date | number,
  locale: Locale = 'fr',
): string {
  return formatDateRangeWith(startDate, endDate, locale, {
    format: effectiveFormat('medium'),
    dateOnly: !configuredShowTime(),
  });
}

/** Indique si une date porte une heure significative (autre que minuit). */
export function hasTime(date: string | Date | number): boolean {
  return valueHasTime(date);
}

/**
 * Extrait jour / mois / année séparément, pour les vignettes « calendrier ».
 * Indépendant du format global : ces trois blocs ont leur propre mise en page.
 */
export function formatDateParts(
  date: string | Date | number,
  locale: Locale = 'fr',
): { day: string; month: string; year: string } {
  const day = formatDateWith(date, locale, { format: 'D', dateOnly: true });
  const month = formatDateWith(date, locale, { format: 'MMM', dateOnly: true });
  const year = formatDateWith(date, locale, { format: 'YYYY', dateOnly: true });
  return { day, month, year };
}
