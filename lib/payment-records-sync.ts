'use client';

/**
 * lib/payment-records-sync.ts — réplication du relevé d'encaissements.
 *
 * Même contrat que `lib/shop-sync.ts` : le `localStorage` reste le cache que les
 * écrans lisent et écrivent de façon synchrone (dix-huit points d'appel, dont un
 * parcours de commande — les passer en `await` aurait été une réécriture à haut
 * risque), la base fait autorité, et chaque écriture est réplifiée en arrière-plan.
 *
 * Deux différences assumées avec les coupons, parce qu'un relevé comptable n'est
 * pas un catalogue :
 *
 * 1. **Les retraits sont calculés, pas déclarés par l'écran.** `savePaymentRecords`
 *    est l'unique porte de sortie (saisie, validation, refus, suppression,
 *    alignement depuis une commande), donc le hook reçoit l'avant et l'après et en
 *    déduit la liste `removed`. Un écran qui oublierait de le dire laisserait un
 *    encaissement fantôme dans les totaux — c'est le seul défaut qui ne se voit pas.
 * 2. **Une poussée qui échoue ne vide rien.** Le cache conserve ses lignes et la
 *    reprise se fait au prochain montage. `planPull` garde la règle du premier
 *    contact (la base fait autorité dès qu'une ligne `payment_records` existe ;
 *    sinon c'est le poste qui remonte), héritée de `decidePull`.
 */

import { cmsAdminFetch } from '@/lib/cms-admin';
import { planPull } from '@/lib/shop-mapping';
import { planPaymentRemoved, recordFromApi, recordToApi } from '@/lib/payment-records-mapping';
import {
  PAYMENT_EVENT,
  registerPaymentRecordsSaveHook,
  type PaymentRecord,
} from '@/lib/payments';

const CACHE_KEY = 'sari_payment_records';
const SYNCED_KEY = 'sari_payment_records_synced';
const BACKUP_KEY = 'sari_payment_records_backup';

type Row = Record<string, unknown>;

function readCached(): PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as PaymentRecord[]) : [];
  } catch {
    return [];
  }
}

/** Écrit le cache sans repasser par `savePaymentRecords`, pour ne pas redéclencher la poussée. */
function writeCache(rows: PaymentRecord[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    /* quota atteint : la liste serveur reste disponible en mémoire pour ce chargement */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PAYMENT_EVENT));
}

/** Pousse le relevé et repart de la liste que le serveur vient de reconstruire. */
async function pushRecords(rows: PaymentRecord[], removed: string[] = []): Promise<PaymentRecord[]> {
  const answer = await cmsAdminFetch<Partial<Record<string, Row[]>>>(
    '/payment-records/sync',
    {
      method: 'POST',
      json: { records: rows.map(recordToApi), removed },
    },
  );
  const fresh = answer?.records;
  return Array.isArray(fresh) ? fresh.map(recordFromApi) : [];
}

/**
 * Télécharge le relevé et remplit le cache — sans écraser le poste au passage.
 *
 * Le piège est celui des coupons, transposé : `setItem(cache, [])` sur une base
 * neuve effaçait des écritures locales qui n'avaient jamais été envoyées. Ici le
 * coût serait un encaissement réel perdu, et non une ligne de catalogue à ressaisir.
 */
export async function pullPaymentRecords(): Promise<{ rows: PaymentRecord[]; seeded: number }> {
  const answer = await cmsAdminFetch<Row[]>('/payment-records/all');
  const fromServer = (Array.isArray(answer) ? answer : []).map(recordFromApi);
  if (typeof window === 'undefined') return { rows: fromServer, seeded: 0 };

  const local = readCached();
  const plan = planPull({
    serverRows: fromServer,
    localRows: local,
    hasSyncedBefore: localStorage.getItem(SYNCED_KEY) !== null,
  });
  if (plan.backup) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(plan.backup));
    } catch {
      /* une copie de sûreté ne doit jamais faire échouer un chargement */
    }
  }

  if (plan.seed) {
    // Base vide et poste jamais synchronisé : c'est la reprise de l'existant.
    const pushed = await pushRecords(local).catch(() => [] as PaymentRecord[]);
    const rows = pushed.length ? pushed : local;
    writeCache(rows);
    localStorage.setItem(SYNCED_KEY, new Date().toISOString());
    return { rows, seeded: local.length };
  }

  localStorage.setItem(SYNCED_KEY, new Date().toISOString());
  if (plan.write) writeCache(plan.write as PaymentRecord[]);
  return { rows: (plan.write ?? local) as PaymentRecord[], seeded: 0 };
}

let installed = false;

/**
 * Branche la réplication sur `savePaymentRecords()`.
 *
 * Installé une seule fois par chargement, et depuis le gabarit d'administration
 * seulement : le parcours de commande écrit des encaissements sans jamais ouvrir
 * cet écran, et sa poussée passerait par une route gardée `payments:*` — elle
 * échouerait en 403 à chaque paiement. Le cache local reste donc, pour lui, la
 * file d'attente : les lignes partiront au premier montage d'écran
 * d'administration, via le même `planPull`. C'est un différé, pas une perte.
 */
export function installPaymentRecordsSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  registerPaymentRecordsSaveHook(({ previous, next }) => {
    const removed = planPaymentRemoved(previous, next);
    void pushRecords(next, removed)
      .then((rows) => {
        // La liste du serveur fait foi : identifiants attribués, montants et
        // statuts normalisés, dates remises à leur forme.
        if (rows.length || next.length === 0) writeCache(rows);
      })
      .catch(() => {
        /* hors ligne : le cache garde la saisie, la reprise se fait au prochain chargement */
      });
  });
}

/** Amorçage : branche la réplication, puis recharge depuis la base. */
export async function hydratePaymentRecords(): Promise<{ rows: number; seeded: number }> {
  installPaymentRecordsSync();
  try {
    const { rows, seeded } = await pullPaymentRecords();
    return { rows: rows.length, seeded };
  } catch {
    // Base injoignable : l'écran reste lisible sur le cache local.
    return { rows: readCached().length, seeded: 0 };
  }
}
