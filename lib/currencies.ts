export interface Currency {
  id: string;
  code: string;
  symbol: string;
  name: string;
  rate: number;
  active: boolean;
  /** Devise utilisée pour tous les affichages du site et de l'administration. */
  isDefault?: boolean;
}

const KEY = 'sari_currencies';

/** Événement émis à l'enregistrement, pour rafraîchir sans recharger la page. */
export const CURRENCY_EVENT = 'sari-currencies';

export const DEFAULT_CURRENCIES: Currency[] = [
  { id: 'cur-dzd', code: 'DZD', symbol: 'DA', name: 'Dinar algérien', rate: 1, active: true, isDefault: true },
  { id: 'cur-eur', code: 'EUR', symbol: '€', name: 'Euro', rate: 145, active: true },
  { id: 'cur-usd', code: 'USD', symbol: '$', name: 'Dollar US', rate: 134, active: true },
  { id: 'cur-mad', code: 'MAD', symbol: 'DH', name: 'Dirham marocain', rate: 13.5, active: true },
  { id: 'cur-tnd', code: 'TND', symbol: 'DT', name: 'Dinar tunisien', rate: 43, active: false },
];

/** Devise de repli quand rien n'est configuré (rendu serveur, stockage vide). */
export const FALLBACK_CURRENCY: Currency = DEFAULT_CURRENCIES[0];

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
  window.dispatchEvent(new CustomEvent(CURRENCY_EVENT));
}

export function activeCurrencies() {
  return loadCurrencies().filter((c) => c.active);
}

/**
 * Devise par défaut du site.
 *
 * Une devise désactivée ne peut pas rester la devise par défaut : on retombe
 * alors sur la première devise active, puis sur le dinar. Sans ce garde-fou,
 * désactiver la ligne marquée par défaut affichait un symbole vide partout.
 */
export function defaultCurrency(rows: Currency[] = loadCurrencies()): Currency {
  return (
    rows.find((c) => c.isDefault && c.active) ||
    rows.find((c) => c.active) ||
    rows.find((c) => c.isDefault) ||
    rows[0] ||
    FALLBACK_CURRENCY
  );
}

/** Marque une devise comme devise par défaut (une seule à la fois). */
export function setDefaultCurrency(rows: Currency[], id: string): Currency[] {
  return rows.map((c) => ({ ...c, isDefault: c.id === id }));
}

/**
 * Symboles susceptibles d'apparaître dans un prix saisi en texte.
 *
 * Les prix des fiches produits sont stockés sous forme de chaîne, symbole
 * compris (« 2 450 € HT », « 2,450 € بدون ضريبة »). Pour afficher la devise
 * configurée, il faut donc remplacer le symbole présent dans le texte.
 */
const KNOWN_SYMBOLS = ['€', '$', '£', '¥', 'DA', 'DH', 'DT', 'DZD', 'EUR', 'USD', 'MAD', 'TND'];

/** Échappe une chaîne pour un usage dans une expression régulière. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remplace le symbole monétaire d'un prix déjà écrit en toutes lettres.
 *
 * Seul le symbole change : le montant n'est pas converti. Une valeur sans
 * symbole (« Sur devis », « حسب العرض ») est renvoyée telle quelle, sinon on
 * collerait une devise sur un texte qui n'est pas un prix.
 */
export function replaceCurrencySymbol(price: string, currency: Currency = defaultCurrency()): string {
  const text = String(price ?? '');
  if (!text.trim()) return text;

  // Les codes ISO d'abord : « DZD » contient « DA » sur d'autres jeux de
  // données, et remplacer le fragment le plus court en premier mutilerait le
  // plus long.
  const symbols = [...KNOWN_SYMBOLS].sort((a, b) => b.length - a.length);
  for (const symbol of symbols) {
    if (!text.includes(symbol)) continue;
    if (symbol === currency.symbol) return text;
    return text.replace(new RegExp(escapeRegExp(symbol), 'g'), currency.symbol);
  }
  return text;
}

/**
 * Formate un montant numérique avec la devise configurée.
 *
 * Le montant n'est pas converti : seul le symbole suit le réglage, comme pour
 * les prix saisis en texte.
 */
export function formatAmount(
  value: number,
  currency: Currency = defaultCurrency(),
  options: { locale?: string; decimals?: number } = {},
): string {
  const { locale = 'fr-DZ', decimals } = options;
  const amount = Number.isFinite(value) ? value : 0;
  const text =
    decimals === undefined
      ? Math.round(amount).toLocaleString(locale)
      : amount.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${text} ${currency.symbol}`;
}

/** Notifie l'application qu'une devise vient d'être enregistrée. */
export function notifyCurrencyChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CURRENCY_EVENT));
  }
}
