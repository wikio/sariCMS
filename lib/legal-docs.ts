/**
 * Types de documents légaux reconnus par le site.
 *
 * L'adresse publique est fixe — `/legal/mentions`, `/legal/privacy`,
 * `/legal/conditions`, `/legal/about` — tandis que le titre, le slug et le texte
 * s'écrivent dans l'administration. La correspondance entre les deux ne peut donc
 * pas reposer sur le slug seul : renommer « mentions » en « mentions-legales-2026 »
 * viderait le pied de page sans qu'aucune erreur ne le dise. Le type est ainsi
 * porté par la colonne `category`, et le slug ne sert que de repli pour les fiches
 * saisies à la main avant ce champ.
 */

export const LEGAL_DOC_TYPES = ['mentions', 'privacy', 'conditions', 'about'] as const;
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

/** Libellés de l'administration — la vitrine, elle, traduit par clé. */
export const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  mentions: 'Mentions légales',
  privacy: 'Politique de confidentialité',
  conditions: 'Conditions générales (CGV)',
  about: 'À propos',
};

/**
 * Indices de dernière chance pour les fiches où `category` est resté vide :
 * on regarde le slug, la mise en page et le titre, dans cet ordre de mots.
 */
const HINTS: Array<[LegalDocType, string[]]> = [
  ['mentions', ['mention', 'legal-notice', 'legals', 'notice']],
  ['privacy', ['privacy', 'confidential', 'donnee', 'data', 'rgpd']],
  ['conditions', ['condition', 'cgv', 'terms', 'vente']],
  ['about', ['about', 'apropos', 'a-propos', 'quipe']],
];

export function isLegalDocType(value: unknown): value is LegalDocType {
  return (LEGAL_DOC_TYPES as readonly string[]).includes(String(value ?? '').trim().toLowerCase());
}

/** Le type du document pour une ligne de la collection `pages`. */
export function legalDocTypeOf(row: Record<string, unknown>): LegalDocType {
  const category = String(row.category ?? '').trim().toLowerCase();
  if (isLegalDocType(category)) return category as LegalDocType;
  const haystack = [row.slug, row.subtype, row.title]
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ');
  for (const [type, hints] of HINTS) {
    if (hints.some((hint) => haystack.includes(hint))) return type;
  }
  return 'mentions';
}

/** Adresse publique du document, langue comprise. */
export function legalDocPath(locale: string, row: Record<string, unknown>): string {
  return `/${locale}/legal/${legalDocTypeOf(row)}`;
}
