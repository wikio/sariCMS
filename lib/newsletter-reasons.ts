/**
 * Motifs de désinscription de la newsletter.
 *
 * Ce qui est enregistré en base est un **code court et stable** ; le libellé
 * appartient à l'interface, donc à la langue du visiteur comme à celle de
 * l'écran d'administration. Un code inconnu s'affiche tel quel : une valeur
 * venue d'ailleurs (import, intégration) ne disparaît pas de la fiche pour
 * autant.
 *
 * Les libellés vivent une seule fois, sous `common.newsletterReasons` : la
 * vitrine et le back-office traduisent le même code avec le même dictionnaire,
 * ce qui évite qu'un motif apparaisse sous deux noms selon l'écran.
 */

/** Les motifs proposés au visiteur, dans l'ordre d'affichage du formulaire. */
export const UNSUBSCRIBE_REASONS = [
  'no-longer-wants',
  'too-many-emails',
  'not-relevant',
  'never-subscribed',
  'other',
] as const;

export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number];

/** Une fonction `t` de next-intl, avec son test d'existence de clé. */
export type Translate = ((key: string) => string) & { has: (key: string) => boolean };

export const UNSUBSCRIBE_REASONS_LIST: readonly string[] = UNSUBSCRIBE_REASONS;

/** Libellé traduit d'un code, avec repli sur le code lui-même. */
export function reasonLabel(reason: string | null | undefined, t: Translate): string {
  const code = String(reason || '').trim();
  if (!code) return '—';
  return t.has(code) ? t(code) : code;
}

/** Même repli, pour les phrases où un code absent doit rester discret. */
export function reasonLabelOr(reason: string | null | undefined, t: Translate, fallback: string): string {
  const code = String(reason || '').trim();
  if (!code) return fallback;
  return t.has(code) ? t(code) : code;
}
