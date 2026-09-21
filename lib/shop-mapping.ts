/**
 * Conversions entre la forme « écran » et la forme « API » des coupons et des
 * règles de taxes.
 *
 * Module volontairement **sans import exécuté** : `lib/shop-sync.ts` fait les
 * entrées/sorties (fetch, localStorage), ici il n'y a que des fonctions pures.
 * C'est ce qui permet de les tester réellement depuis Node
 * (`node --experimental-strip-types`) au lieu de rejouer l'algorithme à la main.
 *
 * Les deux formes diffèrent sur trois points :
 *   - `id` est numérique côté base, texte côté écran ;
 *   - `start`/`end` sont des chaînes `AAAA-MM-JJ` côté écran, `startDate`/
 *     `endDate` des horodatages côté base ;
 *   - les champs optionnels (`maxDiscount`, `minOrder`…) sont `null` côté base
 *     et absents côté écran, pour que `commerce-math.ts` continue de tester
 *     `coupon.maxDiscount ?` plutôt que `!= null`.
 */

import type { Coupon, TaxRule } from './shop-store';

type Row = Record<string, unknown>;

const SHORT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `AAAA-MM-JJ` → horodatage complet.
 *
 * La colonne est un `DATETIME` : Prisma refuse la date courte avant même
 * d'atteindre la base — c'est le même écueil que documente `lib/crm-sync.ts`.
 * Minuit UTC, parce que l'interface compare des jours et non des heures.
 */
export function toTimestamp(value?: string | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (SHORT_DATE.test(raw)) return `${raw}T00:00:00.000Z`;
  return raw;
}

/** Horodatage → `AAAA-MM-JJ`, le format que `couponStatus()` compare. */
export function toShortDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => v != null).map((v) => String(v)) : [];
}

/**
 * Coercition numérique.
 *
 * Accepte une chaîne — c'est ce que renverrait une colonne `DECIMAL`, et ce que
 * renvoyaient déjà les anciens exports `Decimal` Prisma. Sans cela
 * `coupon.amount / 100` produirait `NaN` en silence.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Identifiant serveur si la ligne vient de la base, sinon `undefined`. */
export function serverId(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/* -------------------------------------------------------------------------- *
 * Coupons
 * -------------------------------------------------------------------------- */

export function couponToApi(coupon: Coupon): Row {
  const id = serverId(coupon.id);
  return {
    ...(id ? { id } : {}),
    code: coupon.code,
    type: coupon.type === 'fixed' ? 'fixed' : 'percent',
    amount: toNumber(coupon.amount),
    maxDiscount: coupon.maxDiscount === undefined ? null : toNumber(coupon.maxDiscount),
    minOrder: coupon.minOrder === undefined ? null : toNumber(coupon.minOrder),
    startDate: toTimestamp(coupon.start),
    endDate: toTimestamp(coupon.end),
    limitGlobal: coupon.limitGlobal === undefined ? null : toNumber(coupon.limitGlobal),
    limitPerClient: coupon.limitPerClient === undefined ? null : toNumber(coupon.limitPerClient),
    used: toNumber(coupon.used),
    scope: coupon.scope === 'category' || coupon.scope === 'product' ? coupon.scope : 'all',
    scopeValues: toStringArray(coupon.scopeValues),
    excludeValues: toStringArray(coupon.excludeValues),
    stackable: Boolean(coupon.stackable),
    active: Boolean(coupon.active),
    revenue: toNumber(coupon.revenue),
  };
}

export function couponFromApi(row: Row): Coupon {
  const optional = (key: string): number | undefined => {
    const value = row[key];
    return value === null || value === undefined || value === '' ? undefined : toNumber(value);
  };
  const maxDiscount = optional('maxDiscount');
  const minOrder = optional('minOrder');
  const limitGlobal = optional('limitGlobal');
  const limitPerClient = optional('limitPerClient');
  return {
    id: String(row.id ?? ''),
    code: String(row.code ?? ''),
    type: row.type === 'fixed' ? 'fixed' : 'percent',
    amount: toNumber(row.amount),
    ...(maxDiscount === undefined ? {} : { maxDiscount }),
    ...(minOrder === undefined ? {} : { minOrder }),
    start: toShortDate(row.startDate),
    end: toShortDate(row.endDate),
    ...(limitGlobal === undefined ? {} : { limitGlobal }),
    ...(limitPerClient === undefined ? {} : { limitPerClient }),
    used: toNumber(row.used),
    scope: row.scope === 'category' || row.scope === 'product' ? row.scope : 'all',
    scopeValues: toStringArray(row.scopeValues),
    excludeValues: toStringArray(row.excludeValues),
    stackable: Boolean(row.stackable),
    active: Boolean(row.active),
    revenue: toNumber(row.revenue),
  };
}

/* -------------------------------------------------------------------------- *
 * Taxes
 * -------------------------------------------------------------------------- */

export function taxToApi(tax: TaxRule): Row {
  const id = serverId(tax.id);
  return {
    ...(id ? { id } : {}),
    name: tax.name,
    names: tax.names && typeof tax.names === 'object' ? tax.names : { fr: tax.name },
    labels: tax.labels && typeof tax.labels === 'object' ? tax.labels : { fr: tax.name },
    mode: tax.mode === 'fixed' ? 'fixed' : 'percent',
    rate: toNumber(tax.rate),
    zone: tax.zone || 'DZ',
    category: tax.category === undefined ? null : tax.category,
    scope: tax.scope === 'category' || tax.scope === 'product' ? tax.scope : 'all',
    scopeValues: toStringArray(tax.scopeValues),
    included: Boolean(tax.included),
    priority: toNumber(tax.priority),
    active: Boolean(tax.active),
    isDefault: Boolean(tax.isDefault),
    startDate: toTimestamp(tax.start),
    endDate: toTimestamp(tax.end),
  };
}

export function taxFromApi(row: Row): TaxRule {
  const names =
    row.names && typeof row.names === 'object' ? (row.names as Record<string, string>) : undefined;
  const labels =
    row.labels && typeof row.labels === 'object' ? (row.labels as Record<string, string>) : undefined;
  const category =
    row.category === null || row.category === undefined || row.category === ''
      ? undefined
      : String(row.category);
  const scopeValues = toStringArray(row.scopeValues);
  // Avant l'ajout de `scope`, le périmètre se déduisait de `category`. Le
  // serveur applique ce repli à l'écriture (`TaxesService.toEntity`) ; le faire
  // aussi ici évite qu'une ligne ancienne s'affiche sans périmètre tant qu'elle
  // n'a pas été réenregistrée.
  const scope =
    row.scope === 'all' || row.scope === 'category' || row.scope === 'product'
      ? row.scope
      : category
        ? 'category'
        : 'all';
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    ...(names ? { names } : {}),
    ...(labels ? { labels } : {}),
    mode: row.mode === 'fixed' ? 'fixed' : 'percent',
    rate: toNumber(row.rate),
    zone: String(row.zone ?? 'DZ'),
    ...(category === undefined ? {} : { category }),
    scope,
    scopeValues: scopeValues.length ? scopeValues : category ? [category] : [],
    included: Boolean(row.included),
    priority: toNumber(row.priority),
    active: Boolean(row.active),
    isDefault: Boolean(row.isDefault),
    start: toShortDate(row.startDate),
    end: toShortDate(row.endDate),
  };
}

/* -------------------------------------------------------------------------- *
 * Différentiel de suppression
 * -------------------------------------------------------------------------- */

/**
 * Identifiants présents dans `previous` et absents de `next` : les lignes que
 * l'écran vient de supprimer.
 *
 * Deux garde-fous :
 *   - seuls les identifiants numériques comptent, une ligne jamais synchronisée
 *     n'existe pas côté serveur ;
 *   - une ligne dont le **code** subsiste n'est pas supprimée. Sans cela,
 *     renommer un coupon arriverait comme « suppression + création » et le
 *     serveur enverrait l'ancienne ligne en corbeille, perdant son historique.
 */
export function removedIds(previous: unknown[], next: unknown[]): number[] {
  const keep = new Set(
    (next as Row[]).map((row) => serverId(row?.id)).filter((v): v is number => v !== undefined),
  );
  const keepCodes = new Set(
    (next as Row[]).map((row) => String(row?.code ?? '')).filter(Boolean),
  );
  const out: number[] = [];
  for (const row of previous as Row[]) {
    const id = serverId(row?.id);
    if (id === undefined || keep.has(id)) continue;
    if (row?.code && keepCodes.has(String(row.code))) continue;
    out.push(id);
  }
  return out;
}
