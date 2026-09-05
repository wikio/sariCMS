/**
 * Liste de pays pour les champs de saisie.
 *
 * Le nom est fourni dans les trois langues de la vitrine : un client arabophone
 * doit pouvoir chercher « الجزائر » aussi bien que « Algérie ». Le code ISO
 * sert de valeur stable, indépendante de la langue d'affichage.
 *
 * La liste privilégie l'Algérie, le Maghreb et les principaux partenaires
 * commerciaux, puis complète par les pays les plus courants. Elle n'a pas
 * vocation à être exhaustive : la saisie libre reste possible.
 */

export interface Country {
  code: string;
  fr: string;
  en: string;
  ar: string;
  /** Indicatif téléphonique, utile pour pré-remplir un numéro. */
  dial?: string;
}

export const COUNTRIES: Country[] = [
  { code: 'DZ', fr: 'Algérie', en: 'Algeria', ar: 'الجزائر', dial: '+213' },
  { code: 'MA', fr: 'Maroc', en: 'Morocco', ar: 'المغرب', dial: '+212' },
  { code: 'TN', fr: 'Tunisie', en: 'Tunisia', ar: 'تونس', dial: '+216' },
  { code: 'LY', fr: 'Libye', en: 'Libya', ar: 'ليبيا', dial: '+218' },
  { code: 'MR', fr: 'Mauritanie', en: 'Mauritania', ar: 'موريتانيا', dial: '+222' },
  { code: 'EG', fr: 'Égypte', en: 'Egypt', ar: 'مصر', dial: '+20' },
  { code: 'FR', fr: 'France', en: 'France', ar: 'فرنسا', dial: '+33' },
  { code: 'ES', fr: 'Espagne', en: 'Spain', ar: 'إسبانيا', dial: '+34' },
  { code: 'IT', fr: 'Italie', en: 'Italy', ar: 'إيطاليا', dial: '+39' },
  { code: 'DE', fr: 'Allemagne', en: 'Germany', ar: 'ألمانيا', dial: '+49' },
  { code: 'BE', fr: 'Belgique', en: 'Belgium', ar: 'بلجيكا', dial: '+32' },
  { code: 'CH', fr: 'Suisse', en: 'Switzerland', ar: 'سويسرا', dial: '+41' },
  { code: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom', ar: 'المملكة المتحدة', dial: '+44' },
  { code: 'NL', fr: 'Pays-Bas', en: 'Netherlands', ar: 'هولندا', dial: '+31' },
  { code: 'PT', fr: 'Portugal', en: 'Portugal', ar: 'البرتغال', dial: '+351' },
  { code: 'TR', fr: 'Turquie', en: 'Turkey', ar: 'تركيا', dial: '+90' },
  { code: 'CA', fr: 'Canada', en: 'Canada', ar: 'كندا', dial: '+1' },
  { code: 'US', fr: 'États-Unis', en: 'United States', ar: 'الولايات المتحدة', dial: '+1' },
  { code: 'SA', fr: 'Arabie saoudite', en: 'Saudi Arabia', ar: 'السعودية', dial: '+966' },
  { code: 'AE', fr: 'Émirats arabes unis', en: 'United Arab Emirates', ar: 'الإمارات', dial: '+971' },
  { code: 'QA', fr: 'Qatar', en: 'Qatar', ar: 'قطر', dial: '+974' },
  { code: 'KW', fr: 'Koweït', en: 'Kuwait', ar: 'الكويت', dial: '+965' },
  { code: 'JO', fr: 'Jordanie', en: 'Jordan', ar: 'الأردن', dial: '+962' },
  { code: 'LB', fr: 'Liban', en: 'Lebanon', ar: 'لبنان', dial: '+961' },
  { code: 'SN', fr: 'Sénégal', en: 'Senegal', ar: 'السنغال', dial: '+221' },
  { code: 'CI', fr: "Côte d'Ivoire", en: 'Ivory Coast', ar: 'ساحل العاج', dial: '+225' },
  { code: 'ML', fr: 'Mali', en: 'Mali', ar: 'مالي', dial: '+223' },
  { code: 'NE', fr: 'Niger', en: 'Niger', ar: 'النيجر', dial: '+227' },
  { code: 'NG', fr: 'Nigéria', en: 'Nigeria', ar: 'نيجيريا', dial: '+234' },
  { code: 'ZA', fr: 'Afrique du Sud', en: 'South Africa', ar: 'جنوب أفريقيا', dial: '+27' },
  { code: 'CN', fr: 'Chine', en: 'China', ar: 'الصين', dial: '+86' },
  { code: 'JP', fr: 'Japon', en: 'Japan', ar: 'اليابان', dial: '+81' },
  { code: 'IN', fr: 'Inde', en: 'India', ar: 'الهند', dial: '+91' },
  { code: 'AU', fr: 'Australie', en: 'Australia', ar: 'أستراليا', dial: '+61' },
  { code: 'BR', fr: 'Brésil', en: 'Brazil', ar: 'البرازيل', dial: '+55' },
];

/** Nom du pays dans la langue demandée, avec repli sur le français. */
export function countryName(country: Country, locale: string): string {
  if (locale === 'ar') return country.ar;
  if (locale === 'en') return country.en;
  return country.fr;
}

/**
 * Retrouve un pays à partir d'une saisie : code ISO ou nom dans l'une des
 * trois langues. La comparaison ignore la casse et les espaces superflus.
 */
export function findCountry(input: string): Country | undefined {
  const q = (input || '').trim().toLowerCase();
  if (!q) return undefined;
  return COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === q ||
      c.fr.toLowerCase() === q ||
      c.en.toLowerCase() === q ||
      c.ar === input.trim(),
  );
}

/**
 * Pays correspondant à une recherche partielle, triés : les noms qui
 * commencent par la saisie d'abord, puis ceux qui la contiennent.
 */
export function searchCountries(query: string, locale: string, limit = 8): Country[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return COUNTRIES.slice(0, limit);

  const correspond = COUNTRIES.filter((c) =>
    [c.fr, c.en, c.ar, c.code].some((n) => n.toLowerCase().includes(q)),
  );

  return correspond
    .sort((a, b) => {
      const na = countryName(a, locale).toLowerCase();
      const nb = countryName(b, locale).toLowerCase();
      const da = na.startsWith(q) ? 0 : 1;
      const db = nb.startsWith(q) ? 0 : 1;
      if (da !== db) return da - db;
      return na.localeCompare(nb);
    })
    .slice(0, limit);
}
