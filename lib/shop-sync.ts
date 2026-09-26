'use client';

/**
 * Pont de persistance entre les écrans E-shop et l'API, pour coupons et taxes.
 *
 * Même contrat que `lib/crm-sync.ts` : le `localStorage` reste le cache que les
 * écrans lisent et écrivent de façon synchrone, la base fait autorité, et chaque
 * écriture est répliquée en arrière-plan. Un échec réseau ne bloque pas l'écran.
 *
 * Ce module ne fait que des entrées/sorties ; les conversions sont dans
 * `lib/shop-mapping.ts`, testées par `scripts/test-shop-sync.mjs`.
 *
 * Deux points diffèrent du CRM :
 *   - l'envoi se fait par **lot** (`POST /coupons/sync`), pas ligne par ligne :
 *     les écrans raisonnaient déjà en tableau entier (`saveCoupons(rows)`) ;
 *   - les suppressions sont **explicites** (`removed`), jamais déduites des
 *     absences — un envoi partiel ne peut donc pas vider le catalogue.
 */

import { cmsAdminFetch } from '@/lib/cms-admin';
import { cmsFetch, CmsError } from '@/lib/cms';
import {
  couponFromApi,
  couponToApi,
  planPull,
  removedIds,
  taxFromApi,
  taxToApi,
} from '@/lib/shop-mapping';
import {
  registerShopSaveHook,
  type Coupon,
  type TaxRule,
} from '@/lib/shop-store';

type Row = Record<string, unknown>;

type ShopResource = 'coupons' | 'taxes';

/**
 * Une entrée par table : clé de cache, segment d'URL, et nom du champ attendu
 * par le serveur dans le corps du `sync` — `/coupons/sync` veut `{coupons:[…]}`,
 * `/taxes/sync` veut `{taxes:[…]}`.
 */
const RESOURCES: Record<
  ShopResource,
  { cache: string; endpoint: string; field: 'coupons' | 'taxes' }
> = {
  coupons: { cache: 'sari_coupons', endpoint: '/coupons', field: 'coupons' },
  taxes: { cache: 'sari_taxes', endpoint: '/taxes', field: 'taxes' },
};

/** Marque « ce poste a déjà échangé avec la base » — voit `decidePull`. */
const syncedKey = (resource: ShopResource) => `sari_shop_synced_${resource}`;
/** Copie du cache juste avant qu'on le remplace. */
const backupKey = (resource: ShopResource) => `sari_shop_backup_${resource}`;

/* -------------------------------------------------------------------------- *
 * Synchronisation administrateur
 * -------------------------------------------------------------------------- */

/**
 * Envoi par lot ; renvoie la liste que le serveur vient de reconstruire.
 *
 * Le serveur répond `{created, updated, removed, coupons|taxes}` : on repart de
 * sa liste plutôt que de celle envoyée, parce qu'elle contient les identifiants
 * attribués et les valeurs normalisées (code en majuscules, défaut unique).
 */
async function pushRows<T>(
  resource: ShopResource,
  rows: T[],
  toApi: (row: T) => Row,
  fromApi: (row: Row) => T,
  removed: number[] = [],
): Promise<T[]> {
  const conf = RESOURCES[resource];
  const answer = await cmsAdminFetch<Partial<Record<string, Row[]>>>(`${conf.endpoint}/sync`, {
    method: 'POST',
    json: { [conf.field]: rows.map(toApi), removed },
  });
  const fresh = answer?.[conf.field];
  return Array.isArray(fresh) ? fresh.map(fromApi) : [];
}

function readCached<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Télécharge une table et remplit le cache — sans écraser le poste au passage.
 *
 * Le piège, c'était `localStorage.setItem(cache, [])` sur une base neuve : la
 * première ouverture de l'écran effaçait le catalogue local sans jamais l'avoir
 * envoyé, et détruisait ce que la mise en base devait préserver. C'est
 * `decidePull()` (lib/shop-mapping.ts) qui tranche.
 */
async function pull<T>(options: {
  resource: ShopResource;
  fromApi: (row: Row) => T;
  toApi: (row: T) => Row;
}): Promise<{ rows: T[]; seeded: number }> {
  const { resource, fromApi, toApi } = options;
  const conf = RESOURCES[resource];
  const answer = await cmsAdminFetch<Row[]>(`${conf.endpoint}/all`);
  const fromServer = (Array.isArray(answer) ? answer : []).map(fromApi);
  if (typeof window === 'undefined') return { rows: fromServer, seeded: 0 };

  const local = readCached<T>(conf.cache);
  const plan = planPull({
    serverRows: fromServer,
    localRows: local,
    hasSyncedBefore: localStorage.getItem(syncedKey(resource)) !== null,
  });

  // Copie du cache avant toute réécriture : `setItem` est définitif et, pour
  // ces lignes, le navigateur est parfois le seul endroit où elles existent.
  if (plan.backup) localStorage.setItem(backupKey(resource), JSON.stringify(plan.backup));

  if (plan.seed) {
    // La base est vide et ce poste ne s'est jamais synchronisé : c'est la
    // migration. On pousse d'abord, on ne remplace jamais par un tableau vide.
    const pushed = await pushRows(resource, local, toApi, fromApi).catch(() => [] as T[]);
    const rows = pushed.length ? pushed : local;
    localStorage.setItem(conf.cache, JSON.stringify(rows));
    localStorage.setItem(syncedKey(resource), new Date().toISOString());
    return { rows, seeded: local.length };
  }

  localStorage.setItem(syncedKey(resource), new Date().toISOString());
  if (plan.write) localStorage.setItem(conf.cache, JSON.stringify(plan.write));
  return { rows: (plan.write ?? local) as T[], seeded: 0 };
}

export async function pullCoupons(): Promise<Coupon[]> {
  const { rows } = await pull<Coupon>({ resource: 'coupons', fromApi: couponFromApi, toApi: couponToApi });
  return rows;
}

export async function pullTaxes(): Promise<TaxRule[]> {
  const { rows } = await pull<TaxRule>({ resource: 'taxes', fromApi: taxFromApi, toApi: taxToApi });
  return rows;
}

export async function pushCoupons(rows: Coupon[], removed: number[] = []): Promise<void> {
  await pushRows('coupons', rows, couponToApi, couponFromApi, removed);
}

export async function pushTaxes(rows: TaxRule[], removed: number[] = []): Promise<void> {
  await pushRows('taxes', rows, taxToApi, taxFromApi, removed);
}

/**
 * Branche la réplication sur `saveCoupons()`/`saveTaxes()`.
 *
 * À appeler une fois, au montage d'un écran d'administration du E-shop. Sans
 * cet appel les écritures restent locales — volontairement : la vitrine ne doit
 * jamais pousser vers une route d'administration.
 */
let installed = false;
export function installShopSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  registerShopSaveHook(({ kind, previous, next }) => {
    const removed = removedIds(previous, next);
    if (kind === 'coupons') {
      void pushRows('coupons', next as Coupon[], couponToApi, couponFromApi, removed).catch(() => {
        /* hors ligne : le cache local reste, la synchronisation reprend au prochain chargement */
      });
      return;
    }
    void pushRows('taxes', next as TaxRule[], taxToApi, taxFromApi, removed).catch(() => {
      /* idem */
    });
  });
}

export type ShopHydration = {
  coupons: number;
  taxes: number;
  /** Lignes remontées d'office parce que la base était vide — à annoncer. */
  seededCoupons: number;
  seededTaxes: number;
};

/**
 * Amorçage des écrans d'administration du E-shop : branche la réplication puis
 * recharge coupons et taxes depuis la base. Les échecs sont tolérés — le cache
 * local rend l'écran utilisable hors ligne.
 */
export async function hydrateShop(): Promise<ShopHydration> {
  installShopSync();
  const result: ShopHydration = { coupons: 0, taxes: 0, seededCoupons: 0, seededTaxes: 0 };
  await Promise.all([
    pull<Coupon>({ resource: 'coupons', fromApi: couponFromApi, toApi: couponToApi })
      .then(({ rows, seeded }) => {
        result.coupons = rows.length;
        result.seededCoupons = seeded;
      })
      .catch(() => undefined),
    pull<TaxRule>({ resource: 'taxes', fromApi: taxFromApi, toApi: taxToApi })
      .then(({ rows, seeded }) => {
        result.taxes = rows.length;
        result.seededTaxes = seeded;
      })
      .catch(() => undefined),
  ]);
  return result;
}

/* -------------------------------------------------------------------------- *
 * Vitrine (public)
 * -------------------------------------------------------------------------- */

/**
 * Vérifie un code promo saisi par un client.
 *
 * `null` si le code n'existe pas : le panier affiche « Coupon introuvable »
 * comme avant. L'endpoint est volontairement unitaire — il n'existe pas de
 * liste publique des coupons, qui reviendrait à publier tous les codes.
 */
export async function validateCouponCode(code: string): Promise<Coupon | null> {
  try {
    const payload = await cmsFetch<{ coupon?: Row }>('/public/coupons/validate', {
      method: 'POST',
      json: { code },
      timeoutMs: 8000,
    });
    const row = payload?.coupon;
    return row ? couponFromApi(row) : null;
  } catch (err) {
    if (err instanceof CmsError && err.status === 404) return null;
    throw err;
  }
}

/** Taxes actives, pour le calcul des totaux côté client. */
export async function fetchPublicTaxes(): Promise<TaxRule[]> {
  const payload = await cmsFetch<{ taxes?: Row[] }>('/public/taxes', { timeoutMs: 8000 });
  return (payload?.taxes ?? []).map(taxFromApi);
}
