/**
 * Coercitions partagées par les modules qui reprennent des données déjà
 * manipulées côté navigateur (coupons, taxes).
 *
 * L'interface admin envoyait des dates sous forme de chaînes `AAAA-MM-JJ` et
 * des tableaux libres ; la base attend des `DateTime` et du JSON. Ces fonctions
 * sont tolérantes à l'entrée — une valeur illisible devient `null`/`[]` plutôt
 * qu'une 500 — mais ne devinent jamais : elles ne font que normaliser.
 */

/** `AAAA-MM-JJ`, ISO complet, `Date` ou millisecondes → `Date`, sinon `null`. */
export function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `Date` → `AAAA-MM-JJ`, le format que l'interface compare par ordre lexical. */
export function toDateString(value: unknown): string {
  const d = toDateOrNull(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** N'importe quelle valeur → tableau de chaînes (jamais `undefined`). */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => v !== null && v !== undefined).map((v) => String(v));
}

/** `Float` nullable : `null`/`''`/non numérique → `null`, sinon un `number`. */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Comme `toNumberOrNull` mais avec un plancher à 0 pour les compteurs. */
export function toNumberOr(value: unknown, fallback: number): number {
  const n = toNumberOrNull(value);
  return n === null ? fallback : n;
}
