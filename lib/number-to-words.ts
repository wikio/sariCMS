'use client';

/**
 * Conversion d'un montant numérique en toutes lettres (français).
 * Utilisé pour la mention « Arrêté la présente facture à la somme de … » sur les PDF.
 */

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;

  if (t === 8) {
    if (u === 0) return 'quatre-vingts';
    return `quatre-vingt-${UNITS[u]}`;
  }
  if (t === 7 || t === 9) {
    const rest = n - (t - 1) * 10; // 10..19
    const prefix = TENS[t - 1]; // soixante / quatre-vingt
    if (rest === 11) return `${prefix} et onze`;
    return `${prefix}-${UNITS[rest]}`;
  }
  if (u === 0) return TENS[t];
  if (u === 1) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
}

function below1000(n: number): string {
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hundred = h === 1 ? 'cent' : `${UNITS[h]} cent`;
  if (r === 0) return h === 1 ? 'cent' : `${UNITS[h]} cents`;
  return `${hundred} ${below100(r)}`;
}

/** Convertit un entier positif en toutes lettres françaises. */
export function numberToFrenchWords(n: number): string {
  const value = Math.floor(Math.abs(n));
  if (value === 0) return 'zéro';

  const scales = [
    { value: 1_000_000_000, singular: 'milliard', plural: 'milliards' },
    { value: 1_000_000, singular: 'million', plural: 'millions' },
    { value: 1000, singular: 'mille', plural: 'mille' },
  ];

  let remaining = value;
  let out = '';

  for (const scale of scales) {
    if (remaining >= scale.value) {
      const q = Math.floor(remaining / scale.value);
      if (scale.singular === 'mille' && q === 1) {
        out += 'mille ';
      } else {
        out += `${below1000(q)} ${q === 1 ? scale.singular : scale.plural} `;
      }
      remaining %= scale.value;
    }
  }
  if (remaining > 0) out += `${below1000(remaining)} `;

  return out.trim().replace(/\s+/g, ' ');
}

/**
 * Montant en lettres, avec devise « dinar(s) » et centimes.
 * Ex. 4500 → « quatre mille cinq cents dinars ».
 */
export function amountInWords(amount: number, currency = 'dinar'): string {
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);

  const wholeStr = numberToFrenchWords(whole);
  const currencyWhole = whole === 1 ? currency : `${currency}s`;

  if (cents === 0) return `${wholeStr} ${currencyWhole}`;

  const centsStr = numberToFrenchWords(cents);
  const currencyCents = cents === 1 ? 'centime' : 'centimes';
  return `${wholeStr} ${currencyWhole} et ${centsStr} ${currencyCents}`;
}
