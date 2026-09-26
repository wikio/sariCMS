'use client';

/**
 * Conversion d'un montant numérique en toutes lettres (français / arabe / anglais).
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

// ---- Arabe ----

const UNITS_AR = ['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
const TENS_AR = ['','عشرة','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
const HUNDREDS_AR = ['','مائة','مئتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];

function below100Ar(n: number): string {
  if (n < 20) return UNITS_AR[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return TENS_AR[t];
  return `${UNITS_AR[u]} و${TENS_AR[t]}`;
}

function below1000Ar(n: number): string {
  if (n < 100) return below100Ar(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hWord = HUNDREDS_AR[h];
  if (r === 0) return hWord;
  return `${hWord} و${below100Ar(r)}`;
}

export function numberToArabicWords(n: number): string {
  const value = Math.floor(Math.abs(n));
  if (value === 0) return 'صفر';
  const scales: Array<{value:number; one:string; two:string; few:string; many:string}> = [
    { value: 1_000_000_000, one: 'مليار', two: 'ملياران', few: 'مليارات', many: 'مليار' },
    { value: 1_000_000, one: 'مليون', two: 'مليونان', few: 'ملايين', many: 'مليون' },
    { value: 1000, one: 'ألف', two: 'ألفان', few: 'آلاف', many: 'ألف' },
  ];
  let remaining = value;
  let out = '';
  for (const sc of scales) {
    if (remaining >= sc.value) {
      const q = Math.floor(remaining / sc.value);
      if (q === 1) out += `${sc.one} `;
      else if (q === 2) out += `${sc.two} `;
      else if (q >= 3 && q <= 10) out += `${below1000Ar(q)} ${sc.few} `;
      else out += `${below1000Ar(q)} ${sc.many} `;
      remaining %= sc.value;
    }
  }
  if (remaining > 0) {
    const remStr = below1000Ar(remaining);
    if (out.trim()) out = out.trim() + ' و' + remStr + ' ';
    else out += `${remStr} `;
  }
  return out.trim().replace(/\s+/g, ' ');
}

// ---- Anglais ----

const UNITS_EN = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS_EN = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

function below100En(n: number): string {
  if (n < 20) return UNITS_EN[n];
  const t = Math.floor(n/10);
  const u = n % 10;
  if (u === 0) return TENS_EN[t];
  return `${TENS_EN[t]}-${UNITS_EN[u]}`;
}
function below1000En(n: number): string {
  if (n < 100) return below100En(n);
  const h = Math.floor(n/100);
  const r = n % 100;
  const hundred = `${UNITS_EN[h]} hundred`;
  if (r === 0) return hundred;
  return `${hundred} ${below100En(r)}`;
}
export function numberToEnglishWords(n: number): string {
  const value = Math.floor(Math.abs(n));
  if (value === 0) return 'zero';
  const scales = [
    { value: 1_000_000_000, name: 'billion' },
    { value: 1_000_000, name: 'million' },
    { value: 1000, name: 'thousand' },
  ];
  let remaining = value;
  let out = '';
  for (const sc of scales) {
    if (remaining >= sc.value) {
      const q = Math.floor(remaining / sc.value);
      out += `${below1000En(q)} ${sc.name} `;
      remaining %= sc.value;
    }
  }
  if (remaining > 0) out += `${below1000En(remaining)} `;
  return out.trim().replace(/\s+/g, ' ');
}

/**
 * Montant en lettres, avec devise « dinar(s) » et centimes.
 * Ex. 4500 → « quatre mille cinq cents dinars ».
 * Si locale ar → arabe, en → anglais, sinon français.
 */
export function amountInWords(amount: number, currency = 'dinar', locale?: string): string {
  const isAr = locale === 'ar';
  const isEn = locale === 'en';
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);

  if (isAr) {
    const cur = currency === 'dinar' ? 'دينار' : currency;
    let curWord = cur;
    if (whole === 2) curWord = 'ديناران';
    else if (whole >= 3 && whole <= 10) curWord = 'دنانير';
    const wholeStr = numberToArabicWords(whole);
    if (cents === 0) return `${wholeStr} ${curWord} جزائري`;
    const centsStr = numberToArabicWords(cents);
    const centWord = cents === 1 ? 'سنتيم' : cents === 2 ? 'سنتيمان' : 'سنتيم';
    return `${wholeStr} ${curWord} جزائري و${centsStr} ${centWord}`;
  }
  if (isEn) {
    const wholeStr = numberToEnglishWords(whole);
    const currencyWhole = whole === 1 ? currency : `${currency}s`;
    if (cents === 0) return `${wholeStr} ${currencyWhole}`;
    const centsStr = numberToEnglishWords(cents);
    const currencyCents = cents === 1 ? 'cent' : 'cents';
    return `${wholeStr} ${currencyWhole} and ${centsStr} ${currencyCents}`;
  }

  const wholeStr = numberToFrenchWords(whole);
  const currencyWhole = whole === 1 ? currency : `${currency}s`;

  if (cents === 0) return `${wholeStr} ${currencyWhole}`;

  const centsStr = numberToFrenchWords(cents);
  const currencyCents = cents === 1 ? 'centime' : 'centimes';
  return `${wholeStr} ${currencyWhole} et ${centsStr} ${currencyCents}`;
}
