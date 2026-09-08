/**
 * Les 58 wilayas d'Algérie.
 *
 * Le champ « wilaya » était une simple zone de texte : « Alger », « alger »,
 * « ALGER » ou « Algier » y cohabitaient, rendant impossible tout regroupement
 * fiable (statistiques, filtres, export). Cette liste sert de référentiel à
 * l'autocomplétion : la valeur enregistrée est un libellé normalisé.
 *
 * Le code officiel est conservé : il sert au tri géographique et reste la clé
 * stable si les libellés évoluent.
 */

export interface Wilaya {
  /** Code officiel (1 à 58), sur deux chiffres à l'affichage. */
  code: number;
  fr: string;
  en: string;
  ar: string;
}

export const WILAYAS: Wilaya[] = [
  { code: 1, fr: 'Adrar', en: 'Adrar', ar: 'أدرار' },
  { code: 2, fr: 'Chlef', en: 'Chlef', ar: 'الشلف' },
  { code: 3, fr: 'Laghouat', en: 'Laghouat', ar: 'الأغواط' },
  { code: 4, fr: 'Oum El Bouaghi', en: 'Oum El Bouaghi', ar: 'أم البواقي' },
  { code: 5, fr: 'Batna', en: 'Batna', ar: 'باتنة' },
  { code: 6, fr: 'Béjaïa', en: 'Bejaia', ar: 'بجاية' },
  { code: 7, fr: 'Biskra', en: 'Biskra', ar: 'بسكرة' },
  { code: 8, fr: 'Béchar', en: 'Bechar', ar: 'بشار' },
  { code: 9, fr: 'Blida', en: 'Blida', ar: 'البليدة' },
  { code: 10, fr: 'Bouira', en: 'Bouira', ar: 'البويرة' },
  { code: 11, fr: 'Tamanrasset', en: 'Tamanrasset', ar: 'تمنراست' },
  { code: 12, fr: 'Tébessa', en: 'Tebessa', ar: 'تبسة' },
  { code: 13, fr: 'Tlemcen', en: 'Tlemcen', ar: 'تلمسان' },
  { code: 14, fr: 'Tiaret', en: 'Tiaret', ar: 'تيارت' },
  { code: 15, fr: 'Tizi Ouzou', en: 'Tizi Ouzou', ar: 'تيزي وزو' },
  { code: 16, fr: 'Alger', en: 'Algiers', ar: 'الجزائر' },
  { code: 17, fr: 'Djelfa', en: 'Djelfa', ar: 'الجلفة' },
  { code: 18, fr: 'Jijel', en: 'Jijel', ar: 'جيجل' },
  { code: 19, fr: 'Sétif', en: 'Setif', ar: 'سطيف' },
  { code: 20, fr: 'Saïda', en: 'Saida', ar: 'سعيدة' },
  { code: 21, fr: 'Skikda', en: 'Skikda', ar: 'سكيكدة' },
  { code: 22, fr: 'Sidi Bel Abbès', en: 'Sidi Bel Abbes', ar: 'سيدي بلعباس' },
  { code: 23, fr: 'Annaba', en: 'Annaba', ar: 'عنابة' },
  { code: 24, fr: 'Guelma', en: 'Guelma', ar: 'قالمة' },
  { code: 25, fr: 'Constantine', en: 'Constantine', ar: 'قسنطينة' },
  { code: 26, fr: 'Médéa', en: 'Medea', ar: 'المدية' },
  { code: 27, fr: 'Mostaganem', en: 'Mostaganem', ar: 'مستغانم' },
  { code: 28, fr: "M'Sila", en: "M'Sila", ar: 'المسيلة' },
  { code: 29, fr: 'Mascara', en: 'Mascara', ar: 'معسكر' },
  { code: 30, fr: 'Ouargla', en: 'Ouargla', ar: 'ورقلة' },
  { code: 31, fr: 'Oran', en: 'Oran', ar: 'وهران' },
  { code: 32, fr: 'El Bayadh', en: 'El Bayadh', ar: 'البيض' },
  { code: 33, fr: 'Illizi', en: 'Illizi', ar: 'إليزي' },
  { code: 34, fr: 'Bordj Bou Arréridj', en: 'Bordj Bou Arreridj', ar: 'برج بوعريريج' },
  { code: 35, fr: 'Boumerdès', en: 'Boumerdes', ar: 'بومرداس' },
  { code: 36, fr: 'El Tarf', en: 'El Tarf', ar: 'الطارف' },
  { code: 37, fr: 'Tindouf', en: 'Tindouf', ar: 'تندوف' },
  { code: 38, fr: 'Tissemsilt', en: 'Tissemsilt', ar: 'تيسمسيلت' },
  { code: 39, fr: 'El Oued', en: 'El Oued', ar: 'الوادي' },
  { code: 40, fr: 'Khenchela', en: 'Khenchela', ar: 'خنشلة' },
  { code: 41, fr: 'Souk Ahras', en: 'Souk Ahras', ar: 'سوق أهراس' },
  { code: 42, fr: 'Tipaza', en: 'Tipaza', ar: 'تيبازة' },
  { code: 43, fr: 'Mila', en: 'Mila', ar: 'ميلة' },
  { code: 44, fr: 'Aïn Defla', en: 'Ain Defla', ar: 'عين الدفلى' },
  { code: 45, fr: 'Naâma', en: 'Naama', ar: 'النعامة' },
  { code: 46, fr: 'Aïn Témouchent', en: 'Ain Temouchent', ar: 'عين تموشنت' },
  { code: 47, fr: 'Ghardaïa', en: 'Ghardaia', ar: 'غرداية' },
  { code: 48, fr: 'Relizane', en: 'Relizane', ar: 'غليزان' },
  { code: 49, fr: 'Timimoun', en: 'Timimoun', ar: 'تيميمون' },
  { code: 50, fr: 'Bordj Badji Mokhtar', en: 'Bordj Badji Mokhtar', ar: 'برج باجي مختار' },
  { code: 51, fr: 'Ouled Djellal', en: 'Ouled Djellal', ar: 'أولاد جلال' },
  { code: 52, fr: 'Béni Abbès', en: 'Beni Abbes', ar: 'بني عباس' },
  { code: 53, fr: 'In Salah', en: 'In Salah', ar: 'عين صالح' },
  { code: 54, fr: 'In Guezzam', en: 'In Guezzam', ar: 'عين قزام' },
  { code: 55, fr: 'Touggourt', en: 'Touggourt', ar: 'تقرت' },
  { code: 56, fr: 'Djanet', en: 'Djanet', ar: 'جانت' },
  { code: 57, fr: "El M'Ghair", en: "El M'Ghair", ar: 'المغير' },
  { code: 58, fr: 'El Meniaa', en: 'El Meniaa', ar: 'المنيعة' },
];

/** Libellé d'une wilaya dans la langue demandée (repli français). */
export function wilayaName(w: Wilaya, locale: string): string {
  if (locale === 'ar') return w.ar;
  if (locale === 'en') return w.en;
  return w.fr;
}

/** Code officiel formaté sur deux chiffres, comme sur les plaques. */
export function wilayaCode(w: Wilaya): string {
  return String(w.code).padStart(2, '0');
}

/**
 * Comparaison tolérante : accents, casse et espaces multiples ignorés, afin
 * que « bejaia », « Béjaïa » et « BEJAIA » désignent la même wilaya.
 */
function normaliser(v: string): string {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

/** Retrouve une wilaya à partir d'un libellé (toute langue) ou d'un code. */
export function findWilaya(input: unknown): Wilaya | null {
  const brut = String(input ?? '').trim();
  if (!brut) return null;
  if (/^\d{1,2}$/.test(brut)) {
    return WILAYAS.find((w) => w.code === Number(brut)) || null;
  }
  const cible = normaliser(brut);
  return (
    WILAYAS.find((w) => normaliser(w.fr) === cible || normaliser(w.en) === cible || w.ar === brut) || null
  );
}

/**
 * Suggestions pour l'autocomplétion. Les correspondances par préfixe passent
 * devant : en tapant « ora », Oran arrive avant Ouargla.
 */
export function searchWilayas(query: string, locale: string, limit = 8): Wilaya[] {
  const q = normaliser(query);
  if (!q) return WILAYAS.slice(0, limit);

  // Recherche par code : « 16 » doit proposer Alger.
  if (/^\d{1,2}$/.test(q)) {
    const parCode = WILAYAS.filter((w) => wilayaCode(w).startsWith(q.padStart(q.length, '0')) || String(w.code).startsWith(q));
    if (parCode.length) return parCode.slice(0, limit);
  }

  const prefixes: Wilaya[] = [];
  const contenus: Wilaya[] = [];
  for (const w of WILAYAS) {
    const noms = [normaliser(w.fr), normaliser(w.en), normaliser(w.ar)];
    const nomLocal = normaliser(wilayaName(w, locale));
    if (noms.some((n) => n.startsWith(q)) || nomLocal.startsWith(q)) prefixes.push(w);
    else if (noms.some((n) => n.includes(q)) || nomLocal.includes(q)) contenus.push(w);
  }
  return [...prefixes, ...contenus].slice(0, limit);
}
