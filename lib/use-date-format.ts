// lib/use-date-format.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { loadAdminSettings, DEFAULT_SETTINGS } from '@/lib/admin-settings';
import {
  formatDateWith,
  formatDateRangeWith,
  valueHasTime,
  type DateFormatOptions,
  type SupportedLocale,
} from '@/lib/date-format';

/** Événement émis à l'enregistrement des paramètres, pour rafraîchir sans recharger. */
export const DATE_SETTINGS_EVENT = 'sari:date-settings-changed';

/**
 * Format de date configuré dans l'administration.
 *
 * Les paramètres vivent dans `localStorage`, indisponible au rendu serveur :
 * le premier rendu utilise donc la valeur par défaut, puis un effet applique
 * le réglage réel. Cela évite toute divergence d'hydratation.
 */
export function useDateFormat() {
  const locale = useLocale() as SupportedLocale;
  const [settings, setSettings] = useState(DEFAULT_SETTINGS.dates);

  useEffect(() => {
    const read = () => setSettings(loadAdminSettings().dates);
    read();

    // Mise à jour immédiate après enregistrement, et synchronisation entre onglets.
    window.addEventListener(DATE_SETTINGS_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(DATE_SETTINGS_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  const format = useCallback(
    (value: unknown, options: DateFormatOptions = {}) =>
      formatDateWith(value, locale, {
        format: settings.format,
        ...options,
        // `showTime: false` masque l'heure partout, sauf demande explicite.
        dateOnly: options.dateOnly ?? (!settings.showTime && options.includeTime !== true),
      }),
    [locale, settings],
  );

  const formatRange = useCallback(
    (start: unknown, end: unknown, options: DateFormatOptions = {}) =>
      formatDateRangeWith(start, end, locale, {
        format: settings.format,
        ...options,
        dateOnly: options.dateOnly ?? (!settings.showTime && options.includeTime !== true),
      }),
    [locale, settings],
  );

  return useMemo(
    () => ({ format, formatRange, locale, settings }),
    [format, formatRange, locale, settings],
  );
}

/**
 * Variante réactive de `lib/date-utils`, avec des signatures identiques.
 *
 * Les pages de la vitrine sont des composants clients rendus une première fois
 * sur le serveur : y lire `localStorage` pendant le rendu casserait
 * l'hydratation. Ce hook expose donc les mêmes fonctions, mais alimentées par
 * l'état du hook — le format réel s'applique juste après le montage et se met
 * à jour dès qu'il est modifié dans les paramètres.
 */
export function useDateUtils() {
  const { format, formatRange, settings } = useDateFormat();

  /** Préréglages génériques : le réglage de l'administration l'emporte. */
  const generic = new Set(['short', 'medium', 'long', 'full', 'compact']);
  const resolve = (requested?: 'short' | 'medium' | 'long') =>
    generic.has(settings.format) ? requested || settings.format : settings.format;

  const formatDate = useCallback(
    (
      value: unknown,
      _locale?: unknown,
      options: { includeTime?: boolean; format?: 'short' | 'medium' | 'long' } = {},
    ) =>
      format(value, {
        format: resolve(options.format),
        includeTime: options.includeTime === true ? true : undefined,
        dateOnly: options.includeTime === true ? false : !settings.showTime,
      }),
    [format, settings],
  );

  const formatDateRange = useCallback(
    (start: unknown, end?: unknown, _locale?: unknown) =>
      formatRange(start, end, { format: resolve('medium') }),
    [formatRange, settings],
  );

  const formatDateParts = useCallback(
    (value: unknown, _locale?: unknown) => ({
      day: format(value, { format: 'D', dateOnly: true }),
      month: format(value, { format: 'MMM', dateOnly: true }),
      year: format(value, { format: 'YYYY', dateOnly: true }),
    }),
    [format],
  );

  return useMemo(
    () => ({ formatDate, formatDateRange, formatDateParts, hasTime: valueHasTime }),
    [formatDate, formatDateRange, formatDateParts],
  );
}

/** Notifie l'application qu'un format de date vient d'être enregistré. */
export function notifyDateSettingsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DATE_SETTINGS_EVENT));
  }
}
