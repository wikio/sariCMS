'use client';

/**
 * Pont de persistance entre les écrans CRM et l'API.
 *
 * Commandes, devis et candidatures ne vivaient que dans le localStorage du
 * navigateur : invisibles d'un poste à l'autre, perdus au vidage du cache.
 * Les tables `orders`, `quotes` et `job_applications` existent désormais et
 * l'API expose le CRUD correspondant.
 *
 * Une soixantaine d'appels synchrones (`loadOrders()`, `saveQuotes(...)`)
 * étaient répartis dans une douzaine d'écrans. Les convertir un à un en
 * `await` aurait signifié réécrire chaque composant. Ce module conserve donc
 * l'interface synchrone en traitant le localStorage comme un cache local :
 *
 *   - `pullAll()` télécharge la base et remplit le cache (au montage) ;
 *   - les écrans lisent et écrivent le cache comme avant, sans changement ;
 *   - chaque écriture est répliquée vers l'API en arrière-plan.
 *
 * La base fait autorité : en cas d'échec réseau l'écran reste utilisable, et
 * la synchronisation reprend au prochain chargement.
 */

import { cmsFetch, CmsError } from '@/lib/cms';
import { cmsAdminFetch } from '@/lib/cms-admin';
import { ORDERS_KEY, QUOTES_KEY, type Order, type Quote } from '@/lib/crm-store';
import { APPS_KEY, type Application } from '@/lib/recruitment';

type Row = Record<string, unknown>;

/** Ressources synchronisées et clé de cache associée. */
const RESOURCES = {
  orders: ORDERS_KEY,
  quotes: QUOTES_KEY,
  applications: APPS_KEY,
} as const;

export type SyncResource = keyof typeof RESOURCES;

/** Correspondance id local (numérique, historique) → id serveur. */
const idMapKey = (resource: SyncResource) => `sari_sync_ids_${resource}`;

function readIdMap(resource: SyncResource): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(idMapKey(resource)) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeIdMap(resource: SyncResource, map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(idMapKey(resource), JSON.stringify(map));
}

/** Récupère toutes les pages (l'API plafonne `limit` à 100). */
async function fetchAll(resource: SyncResource): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const payload = await cmsAdminFetch<{ data?: Row[]; meta?: { totalPages?: number } } | Row[]>(
      // `view=block` renvoie l'enregistrement complet ; `list` tronque aux
      // colonnes de liste et ferait perdre items, history, response…
      `/${resource}?limit=100&page=${page}&view=block`,
    );
    const chunk = Array.isArray(payload) ? payload : payload?.data || [];
    out.push(...chunk);
    if (chunk.length < 100) break;
  }
  return out;
}

/** Champs internes à ne pas renvoyer au serveur. */
const STRIP = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy', 'legacyId']);

/**
 * Une colonne date de l'API est un DATETIME : une valeur « 2026-07-15 », telle
 * que le cache local la garde, était refusée par Prisma avant même la base —
 * `POST /applications` répondait 500 et la rangée entière restait perdue. Les
 * écrans CRM écrivent donc un horodatage complet ; minuit UTC, parce que la
 * liste affiche un jour, pas une heure.
 */
const DATE_KEY = /(^date$|At$|Date$)/;
const SHORT_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toPayload(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP.has(k) || v === undefined || v === null) continue;
    if (DATE_KEY.test(k) && typeof v === 'string' && SHORT_DATE.test(v.trim())) {
      out[k] = `${v.trim()}T00:00:00.000Z`;
      continue;
    }
    // Les écrans nomment `offerId` le lien vers l'offre d'emploi ; la colonne
    // s'appelle `careerId` (clé étrangère vers `careers`).
    if (k === 'offerId') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out.careerId = n;
      continue;
    }
    if (k === 'items' && Array.isArray(v)) {
      // Normalise les lignes commerce : discountValue -> discount, vatRate -> taxRate (compat CommerceDesk)
      out[k] = (v as Row[]).map((it) => {
        const copy: Row = { ...it };
        if (copy.discountValue !== undefined && copy.discount === undefined) copy.discount = copy.discountValue as number;
        if (copy.vatRate !== undefined && copy.taxRate === undefined) copy.taxRate = copy.vatRate as number;
        // Le DTO accepte désormais discountValue/vatRate en compat, mais on garde la forme canonique
        return copy;
      });
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Conversion inverse, appliquée aux lignes descendues du serveur. */
function fromServer(row: Row): Row {
  if (row.careerId === undefined) return row;
  return { ...row, offerId: row.careerId };
}

/**
 * Les écrans historiques utilisent des ids numériques locaux. On conserve la
 * correspondance vers l'id serveur pour que les mises à jour retombent sur la
 * bonne ligne au lieu de créer un doublon à chaque enregistrement.
 */
function serverIdFor(resource: SyncResource, localId: unknown): string | null {
  const map = readIdMap(resource);
  return map[String(localId)] || null;
}

function rememberId(resource: SyncResource, localId: unknown, serverId: unknown) {
  const map = readIdMap(resource);
  map[String(localId)] = String(serverId);
  writeIdMap(resource, map);
}

/** Empreintes de la dernière charge utile synchronisée (évite de repousser les lignes inchangées). */
const syncedSnapshots: Record<SyncResource, Map<string, string>> = {
  orders: new Map(),
  quotes: new Map(),
  applications: new Map(),
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function payloadFingerprint(row: Row): string {
  return stableStringify(toPayload(row));
}

function isOnAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return /^\/(fr|en|ar)\/admin(\/|$)/.test(window.location.pathname);
}

/** Charge une ressource depuis l'API et remplit le cache local. */
export async function pull(resource: SyncResource): Promise<Row[]> {
  const rows = await fetchAll(resource);
  if (typeof window === 'undefined') return rows;

  const map: Record<string, string> = {};
  const snapshots = syncedSnapshots[resource];
  snapshots.clear();
  const local = rows.map((row, index) => {
    // Les écrans attendent un id numérique : on en fabrique un stable et on
    // mémorise l'id serveur correspondant.
    const localId = Number(row.id) || index + 1;
    map[String(localId)] = String(row.id);
    const normalized = { ...fromServer(row), id: localId };
    snapshots.set(String(localId), payloadFingerprint(normalized));
    return normalized;
  });
  writeIdMap(resource, map);
  localStorage.setItem(RESOURCES[resource], JSON.stringify(local));
  return local;
}

/** Charge les trois ressources. Les échecs sont tolérés (mode hors ligne). */
export async function pullAll(): Promise<Partial<Record<SyncResource, number>>> {
  const result: Partial<Record<SyncResource, number>> = {};
  await Promise.all(
    (Object.keys(RESOURCES) as SyncResource[]).map(async (resource) => {
      try {
        const rows = await pull(resource);
        result[resource] = rows.length;
      } catch {
        // Réseau indisponible ou session expirée : on garde le cache existant.
      }
    }),
  );
  return result;
}

/**
 * Exécute la réplication d'une ligne. Renvoie `'rate_limited'` si l'API répond 429
 * afin que `pushCollection` interrompe immédiatement le reste du lot.
 */
async function pushOne(resource: SyncResource, row: Row): Promise<'ok' | 'rate_limited' | 'error'> {
  const serverId = serverIdFor(resource, row.id);
  const payload = toPayload(row);
  const fingerprint = stableStringify(payload);
  const useAdmin = resource === 'applications' || isOnAdminRoute();

  const doFetch = async <T>(path: string, opts: Parameters<typeof cmsFetch>[1]): Promise<T> => {
    if (useAdmin) {
      return cmsAdminFetch<T>(path, { timeoutMs: 12000, ...opts });
    }
    // Vitrine : `orders` et `quotes` sont @Public() sur POST/PATCH. On ne retente
    // jamais via `cmsAdminFetch` (qui doublerait la charge en cas de 429/timeout
    // et redirigerait un client vers /admin en cas de 401).
    return cmsFetch<T>(path, { timeoutMs: 8000, ...opts });
  };

  try {
    if (serverId) {
      await doFetch(`/${resource}/${serverId}`, { method: 'PATCH', json: payload });
    } else {
      const created = await doFetch<Row>(`/${resource}`, { method: 'POST', json: payload });
      const newId = (created as { id?: unknown })?.id ?? (created as { data?: { id?: unknown } })?.data?.id;
      if (newId !== undefined) rememberId(resource, row.id, newId);
    }
    syncedSnapshots[resource].set(String(row.id), fingerprint);
    return 'ok';
  } catch (err) {
    if (err instanceof CmsError && err.status === 429) {
      return 'rate_limited';
    }
    // Log 400/409/422 toujours (validation), sinon seulement si debug
    const isValidation = err instanceof CmsError && [400, 409, 422, 500].includes(err.status);
    if (typeof window !== 'undefined') {
      try {
        const debug = localStorage.getItem('__SARI_DEBUG') || (window as unknown as { __SARI_DEBUG?: boolean }).__SARI_DEBUG;
        if (isValidation || debug) {
          const body = err instanceof CmsError ? err.body : null;
          const msg = err instanceof CmsError ? err.message : String(err);
          // Stringify pour que Fast Refresh ne collapse pas l'objet
          // eslint-disable-next-line no-console
          console.error(`[crm-sync] push ${resource} #${String(row.id)} ${err instanceof CmsError ? err.status : ''} ${msg}`, '\nPAYLOAD:', JSON.stringify(payload, null, 2), '\nBODY:', JSON.stringify(body, null, 2));
        }
      } catch {}
    }
    return 'error';
  }
}

/**
 * Réplique une ligne vers l'API (création ou mise à jour).
 * Ne lève jamais : l'échec ne doit pas bloquer l'écran.
 */
export async function push(resource: SyncResource, row: Row): Promise<void> {
  await pushOne(resource, row);
}

/** Réplique une suppression. */
export async function remove(resource: SyncResource, localId: unknown): Promise<void> {
  try {
    const serverId = serverIdFor(resource, localId);
    if (serverId) await cmsAdminFetch(`/${resource}/${serverId}`, { method: 'DELETE' });
    syncedSnapshots[resource].delete(String(localId));
  } catch {
    /* idem */
  }
}

/**
 * Compare l'état local à la dernière empreinte synchronisée et pousse uniquement
 * les lignes créées ou modifiées, avec concurrence bornée et arrêt immédiat sur 429.
 * Appelée par les helpers `save*` de crm-store / recruitment.
 */
export function pushCollection(
  resource: SyncResource,
  rows: Array<Order | Quote | Application | Row>,
  previousJson?: string | null,
): void {
  if (typeof window === 'undefined') return;
  const snapshots = syncedSnapshots[resource];

  // Si aucune empreinte en mémoire n'existe encore pour cette ressource (ex. avant `pull()`),
  // on initialise les empreintes des lignes déjà connues du serveur depuis l'état local précédent
  // pour ne pousser que les lignes réellement créées ou modifiées.
  if (previousJson) {
    try {
      const prevRows = JSON.parse(previousJson);
      if (Array.isArray(prevRows)) {
        for (const prev of prevRows as Row[]) {
          const key = String(prev?.id ?? '');
          if (key && !snapshots.has(key) && serverIdFor(resource, prev.id)) {
            snapshots.set(key, payloadFingerprint(prev));
          }
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const dirty = (rows as Row[]).filter((row) => {
    const key = String(row.id);
    const serverId = serverIdFor(resource, row.id);
    if (!serverId) return true;
    const prev = snapshots.get(key);
    if (prev === undefined) return true;
    return payloadFingerprint(row) !== prev;
  });
  if (!dirty.length) return;

  // Exécution différée à concurrence bornée : l'appelant n'attend pas le réseau
  // et on évite d'envoyer une rafale simultanée sur l'API.
  void (async () => {
    const CONCURRENCY = 2;
    let index = 0;
    let stop = false;
    async function worker() {
      while (!stop) {
        const i = index;
        index += 1;
        if (i >= dirty.length) return;
        const outcome = await pushOne(resource, dirty[i]);
        if (outcome === 'rate_limited') {
          stop = true;
          return;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, dirty.length) }, () => worker()));
  })();
}
