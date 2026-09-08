/**
 * Le chemin des pages construites, et ce qu'il implique.
 *
 * Une page de type « Constructeur » est autonome : elle se lit sans bandeau de
 * navigation ni pied de page, parce qu'elle est faite pour être envoyée seule
 * (campagne, QR code, lien dans un e-mail) et qu'un menu autour d'elle ferait
 * partir le visiteur avant la fin de l'appel à l'action.
 *
 * L'autonomie est portée par le **chemin**, pas par un attribut posé après coup :
 * `components/layout/SiteWrapper.tsx` décide déjà de la coque du site selon le
 * chemin (c'est ainsi que l'administration échappe au menu public), et le même
 * test sert au rendu de la page et aux liens que l'administration propose. Une
 * page construite est donc servie sous `/{langue}/p/{slug}` — et la langue est
 * dans le chemin, comme partout sur le site, pour que le rendu reste le bon dans
 * les trois langues.
 */
export const STANDALONE_SEGMENT = 'p';

/** `/{locale}/p/{slug}` — le `slug` est déjà celui de la langue en cours. */
export function standaloneHref(locale: string, slug: string): string {
  const clean = String(slug || '').replace(/^\/+/, '').replace(/\/+$/, '');
  return `/${locale}/${STANDALONE_SEGMENT}/${clean}`;
}

/** Le chemin désigne-t-il une page autonome (sans coque de site) ? */
export function isStandalonePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // `/{langue}/p/{slug}`, et `/p/{slug}` pour les rendus sans préfixe de langue
  // (aperçu, tests) : la page est cherchée au premier ou au second segment.
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] === STANDALONE_SEGMENT || parts[1] === STANDALONE_SEGMENT;
}
