/**
 * common/audit/audit-payload.ts — ce qui entre dans `audit_logs.payload`.
 *
 * La piste d'audit est la seule table du projet qui ne passe jamais par la
 * corbeille : elle grossit à chaque écriture. Deux leviers la bornent, et tous
 * deux vivent ici pour rester testables sans base de données.
 *
 * 1. `auditDiff` — sur une mise à jour, on ne journalise que les champs dont la
 *    valeur a réellement changé. Un `PUT` d'article renvoyait auparavant tout le
 *    DTO, corps HTML compris, pour une simple correction de titre.
 * 2. `compactAuditPayload` — ce qui reste est borné : les chaînes longues sont
 *    tronquées, les objets et tableaux volumineux remplacés par un résumé. On
 *    garde la trace du changement, on perd le volume.
 *
 * Logique pure : aucun import Nest, aucun accès base.
 */

/** Au-delà, une chaîne est tronquée : un corps d'article n'a rien à faire ici. */
export const AUDIT_MAX_STRING = 500;
/** Au-delà, un objet ou un tableau est remplacé par un résumé de sa taille. */
export const AUDIT_MAX_VALUE = 1_000;

/**
 * Champs retirés du journal. Aucun ne doit se retrouver en clair dans une table
 * interrogée par l'écran d'administration.
 */
export const AUDIT_SECRET_FIELDS: ReadonlySet<string> = new Set([
  'password',
  'passwordHash',
  'totpSecret',
  'totpCode',
  'partnerKey',
  'refreshToken',
]);

/** Tronque en signalant ce qui manque — la taille reste une information. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [+${text.length - max} car.]`;
}

function compactValue(value: unknown): unknown {
  if (typeof value === 'string') return clip(value, AUDIT_MAX_STRING);
  if (value === null || typeof value !== 'object') return value;
  let json: string;
  try {
    json = JSON.stringify(value) ?? '';
  } catch {
    return '[non sérialisable]';
  }
  if (json.length <= AUDIT_MAX_VALUE) return value;
  return Array.isArray(value)
    ? `…[tableau ${value.length} éléments, ${json.length} car.]`
    : `…[objet ${Object.keys(value as Record<string, unknown>).length} clés, ${json.length} car.]`;
}

/**
 * Rend une payload propre pour le journal : secrets retirés, valeurs bornées.
 *
 * `undefined` quand il n'y a rien à dire — le service écrit alors `payload: null`
 * plutôt qu'un `{}` qui ferait croire à un contenu vide.
 */
export function compactAuditPayload(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (AUDIT_SECRET_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = compactValue(value);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Forme comparable d'une valeur : une date et sa forme ISO doivent compter pour
 * la même chose, sinon un `PUT` qui renvoie la date telle quelle serait lu comme
 * un changement.
 */
function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

/**
 * Ne retient que les champs dont la valeur diffère entre `before` et `after`.
 *
 * Un champ absent de `before` compte comme nouveau. Un champ à `undefined` dans
 * `after` est ignoré : c'est une omission du DTO, pas une remise à zéro.
 * `undefined` quand rien n'a bougé — l'action reste journalisée, sans payload.
 */
export function auditDiff(before: unknown, after: unknown): Record<string, unknown> | undefined {
  if (!after || typeof after !== 'object') return undefined;
  const source =
    before && typeof before === 'object' ? (before as Record<string, unknown>) : {};
  const target = after as Record<string, unknown>;
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target)) {
    if (value === undefined) continue;
    if (!(key in source) || comparable(source[key]) !== comparable(value)) {
      changed[key] = value;
    }
  }
  return Object.keys(changed).length ? changed : undefined;
}
