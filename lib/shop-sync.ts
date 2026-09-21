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
  removedIds,
  taxFromApi,
  taxToApi,
} from '@/lib/shop-mapping';
import {
  loadCoupons,
  loadTaxes,
  registerShopSaveHook,
  type Coupon,
  type TaxRule,
} from '@/lib/shop-store';

type Row = Record<string, unknown>;

/* -------------------------------------------------------------------------- *
 * Synchronisation administrateur
 * -------------------------------------------------------------------------- */

/** Télécharge le catalogue et remplit le cache local. */
export async function pullCoupons(): Promise<Coupon[]> {
  const rows = await cmsAdminFetch<Row[]>('/coupons/all');
  const coupons = (Array.isArray(rows) ? rows : []).map(couponFromApi);
  if (typeof window !== 'undefined') {
    localStorage.setItem('sari_coupons', JSON.stringify(coupons));
  }
  return coupons;
}

/** Télécharge le jeu de taxes et remplit le cache local. */
export async function pullTaxes(): Promise<TaxRule[]> {
  const rows = await cmsAdminFetch<Row[]>('/taxes/all');
  const taxes = (Array.isArray(rows) ? rows : []).map(taxFromApi);
  if (typeof window !== 'undefined') {
    localStorage.setItem('sari_taxes', JSON.stringify(taxes));
  }
  return taxes;
}

export async function pushCoupons(rows: Coupon[], removed: number[] = []): Promise<void> {
  await cmsAdminFetch('/coupons/sync', {
    method: 'POST',
    json: { coupons: rows.map(couponToApi), removed },
  });
}

export async function pushTaxes(rows: TaxRule[], removed: number[] = []): Promise<void> {
  await cmsAdminFetch('/taxes/sync', {
    method: 'POST',
    json: { taxes: rows.map(taxToApi), removed },
  });
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
      void pushCoupons(next as Coupon[], removed).catch(() => {
        /* hors ligne : le cache local reste, la synchronisation reprend au prochain chargement */
      });
      return;
    }
    void pushTaxes(next as TaxRule[], removed).catch(() => {
      /* idem */
    });
  });
}

/**
 * Amorçage des écrans d'administration du E-shop : branche la réplication puis
 * recharge coupons et taxes depuis la base. Les échecs sont tolérés — le cache
 * local rend l'écran utilisable hors ligne.
 */
export async function hydrateShop(): Promise<{ coupons: number; taxes: number }> {
  installShopSync();
  const result = { coupons: loadCoupons().length, taxes: loadTaxes().length };
  await Promise.all([
    pullCoupons()
      .then((rows) => {
        result.coupons = rows.length;
      })
      .catch(() => undefined),
    pullTaxes()
      .then((rows) => {
        result.taxes = rows.length;
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
