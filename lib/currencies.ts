export interface Currency {
  id: string;
  code: string;
  symbol: string;
  name: string;
  rate: number;
  active: boolean;
}

const KEY = 'sari_currencies';

export const DEFAULT_CURRENCIES: Currency[] = [
  { id: 'cur-dzd', code: 'DZD', symbol: 'DA', name: 'Dinar algérien', rate: 1, active: true },
  { id: 'cur-eur', code: 'EUR', symbol: '€', name: 'Euro', rate: 145, active: true },
  { id: 'cur-usd', code: 'USD', symbol: '$', name: 'Dollar US', rate: 134, active: true },
  { id: 'cur-mad', code: 'MAD', symbol: 'DH', name: 'Dirham marocain', rate: 13.5, active: true },
  { id: 'cur-tnd', code: 'TND', symbol: 'DT', name: 'Dinar tunisien', rate: 43, active: false },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCurrencies() {
  return read(KEY, DEFAULT_CURRENCIES);
}

export function saveCurrencies(rows: Currency[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent('sari-currencies'));
}

export function activeCurrencies() {
  return loadCurrencies().filter((c) => c.active);
}
