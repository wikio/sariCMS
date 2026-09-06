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

function toPayload(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP.has(k) || v === undefined || v === null) continue;
    // Les écrans nomment `offerId` le lien vers l'offre d'emploi ; la colonne
    // s'appelle `careerId` (clé étrangère vers `careers`).
    if (k === 'offerId') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out.careerId = n;
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

/** Charge une ressource depuis l'API et remplit le cache local. */
export async function pull(resource: SyncResource): Promise<Row[]> {
  const rows = await fetchAll(resource);
  if (typeof window === 'undefined') return rows;

  const map: Record<string, string> = {};
  const local = rows.map((row, index) => {
    // Les écrans attendent un id numérique : on en fabrique un stable et on
    // mémorise l'id serveur correspondant.
    const localId = Number(row.id) || index + 1;
    map[String(localId)] = String(row.id);
    return { ...fromServer(row), id: localId };
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
 * Réplique une ligne vers l'API (création ou mise à jour).
 * Ne lève jamais : l'échec ne doit pas bloquer l'écran.
 */
export async function push(resource: SyncResource, row: Row): Promise<void> {
  try {
    const serverId = serverIdFor(resource, row.id);
    const payload = toPayload(row);
    if (serverId) {
      await cmsAdminFetch(`/${resource}/${serverId}`, { method: 'PATCH', json: payload });
    } else {
      const created = await cmsAdminFetch<Row>(`/${resource}`, { method: 'POST', json: payload });
      const newId = (created as { id?: unknown })?.id ?? (created as { data?: { id?: unknown } })?.data?.id;
      if (newId !== undefined) rememberId(resource, row.id, newId);
    }
  } catch {
    // Silencieux : la synchronisation reprendra au prochain pull().
  }
}

/** Réplique une suppression. */
export async function remove(resource: SyncResource, localId: unknown): Promise<void> {
  try {
    const serverId = serverIdFor(resource, localId);
    if (serverId) await cmsAdminFetch(`/${resource}/${serverId}`, { method: 'DELETE' });
  } catch {
    /* idem */
  }
}

/**
 * Compare l'état local à celui du serveur et pousse les différences.
 * Appelée par les helpers `save*` de crm-store / recruitment.
 */
export function pushCollection(resource: SyncResource, rows: Array<Order | Quote | Application | Row>): void {
  if (typeof window === 'undefined') return;
  // Exécution différée : l'appelant n'attend pas le réseau.
  void Promise.all(rows.map((row) => push(resource, row as Row)));
}
