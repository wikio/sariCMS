// lib/use-currency.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_EVENT,
  FALLBACK_CURRENCY,
  defaultCurrency,
  formatAmount,
  loadCurrencies,
  replaceCurrencySymbol,
  type Currency,
} from '@/lib/currencies';

/**
 * Devise configurée dans l'administration (page Devises).
 *
 * Les devises vivent dans `localStorage`, indisponible au rendu serveur : le
 * premier rendu utilise donc la devise de repli, puis un effet applique le
 * réglage réel. Cela évite toute divergence d'hydratation, exactement comme
 * `useDateFormat` pour le format de date.
 */
export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>(FALLBACK_CURRENCY);

  useEffect(() => {
    const read = () => setCurrency(defaultCurrency(loadCurrencies()));
    read();

    // Mise à jour immédiate après enregistrement, et synchronisation entre onglets.
    window.addEventListener(CURRENCY_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CURRENCY_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  /** Formate un montant numérique : `1234` → « 1 234 DA ». */
  const format = useCallback(
    (value: number, options: { locale?: string; decimals?: number } = {}) =>
      formatAmount(value, currency, options),
    [currency],
  );

  /** Remplace le symbole d'un prix déjà écrit : « 2 450 € HT » → « 2 450 DA HT ». */
  const withSymbol = useCallback(
    (price: unknown) => replaceCurrencySymbol(String(price ?? ''), currency),
    [currency],
  );

  return useMemo(
    () => ({ currency, symbol: currency.symbol, code: currency.code, format, withSymbol }),
    [currency, format, withSymbol],
  );
}
