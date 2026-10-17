/**
 * lib/ged/client.ts — parler à la GED depuis le back-office.
 *
 * Deux chemins mènent à la même GED : les routes Next (`/api/admin/ged/*`, qui
 * écrivent sous `public/uploads`), et le module NestJS (`/api/v1/ged/*`, qui lit le
 * même arbre). La surface est choisie une seule fois par session, d'après
 * `cmsHealth()` — la sonde que l'administration interroge déjà ailleurs :
 *
 * - l'API métier répond → on l'utilise, parce qu'elle porte l'authentification, les
 *   permissions et l'audit ;
 * - sinon on retombe sur les routes Next, qui marchent sans backend. C'est le cas de
 *   ce dépôt en développement, où `backend/` n'est pas forcément démarré — et le cas
 *   de toute installation mono-conteneur.
 *
 * Les deux répondent sous la même forme (`lib/ged/types.d.ts`), donc aucun écran ne
 * connaît la différence. C'est ce qui permet à l'atelier graphique d'enregistrer dans
 * la GED backend vivant ou non.
 *
 * Le choix est mémorisé volontairement : réinterroger la sonde à chaque clic coûterait
 * plus cher que ce qu'il apporte, et un backend qui redémarre entre deux
 * enregistrements ne doit pas changer la destination des fichiers en cours.
 */

import { cmsAdminFetch, cmsHealth } from '@/lib/cms-admin';
import type {
  GedAssetSummary,
  GedCanvasExportPayload,
  GedManifest,
  GedTemplateSummary,
  GedListResult,
} from '@/lib/ged/types';

export type {
  GedAssetSummary,
  GedCanvasExportPayload,
  GedHistoryEntry,
  GedManifest,
  GedSlot,
  GedSource,
  GedTemplateSummary,
  GedListResult,
} from '@/lib/ged/types';

/** Les types que la GED connaît — extensible par la table de préfixes, sans code. */
export type GedKindFilter = 'image' | 'svg' | 'canvas' | 'doc';

/**
 * Ce qu'un composant de page stocke pour pointer un asset : l'URL à afficher, la
 * référence à réouvrir, et les dimensions pour que la mise en page tienne avant
 * le chargement. C'est le contrat du trait `data-sari-canvas` de GrapesJS.
 */
export interface GedReference {
  file: string;
  url: string;
  kind: string;
  prefix: string;
  width: number;
  height: number;
  version: number;
}

/** Un import depuis le poste : le fichier brut, avec son intention de classement. */
export async function uploadGedAsset(input: {
  file?: File;
  dataUrl?: string;
  kind?: GedKindFilter;
  module?: string;
  prefix?: string;
  title?: string;
  alt?: string;
  tags?: string[];
  width?: number;
  height?: number;
  state?: unknown;
  /** La référence à réécrire : sans elle, une création prend un nom neuf. */
  overwrite?: string;
}): Promise<GedAssetSummary> {
  const blob = input.file ?? (input.dataUrl ? await (await fetch(input.dataUrl)).blob() : null);
  if (!blob) throw new GedClientError('Aucun fichier à envoyer.', 400);
  const saved = await saveGedBlob({
    blob,
    filename: input.file?.name,
    kind: input.kind,
    module: input.module,
    prefix: input.prefix,
    title: input.title,
    alt: input.alt,
    tags: input.tags,
    width: input.width,
    height: input.height,
    state: input.state,
    overwrite: input.overwrite,
    source: { origin: 'atelier' },
  });
  return saved.asset;
}

export interface GedListQuery {
  module?: string;
  kind?: string;
  prefix?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GedSaveResult {
  asset: GedAssetSummary;
  file: string;
  url: string;
  version: number;
  /** Les fichiers écrits au passage (le rendu, son SVG, la fiche) — pour le message de confirmation. */
  written: string[];
  reference?: { file: string; url: string; kind: string; prefix: string; width: number; height: number; version: number };
}

export type GedSurface = 'next' | 'cms';

let surface: GedSurface | null = null;
let probe: Promise<GedSurface> | null = null;

/** La clé de forçage, documentée dans `docs/GED-MYSQL.md`. */
export const GED_SURFACE_OVERRIDE_KEY = 'sari_ged_surface';

/** Sur quelle API tape la GED, maintenant et pour le reste de la session. */
export async function gedSurface(): Promise<GedSurface> {
  if (surface) return surface;
  // Un forçage manuel gagne toujours : sur un déploiement séparé (deux conteneurs,
  // un mutualisé), l'API répond au `health` mais son `public/uploads` n'est pas le
  // même arbre que celui que Next sert — et écrire là-bas produit des images
  // introuvables. `localStorage.setItem('sari_ged_surface','next')` dans la console
  // de l'administration le règle sans toucher au code ; toute autre valeur
  // (y compris une faute de frappe) retombe sur l'auto-détection.
  const forced = typeof localStorage !== 'undefined' ? localStorage.getItem(GED_SURFACE_OVERRIDE_KEY) : null;
  if (forced === 'next' || forced === 'cms') {
    surface = forced;
    return surface;
  }
  probe ??= (async () => {
    const health = await cmsHealth();
    surface = health ? 'cms' : 'next';
    probe = null;
    return surface;
  })();
  return probe;
}

/** Imposer la surface : l'écran de configuration sait, lui, où va le projet. */
export function setGedSurface(value: GedSurface | null) {
  surface = value;
  probe = null;
}

export class GedClientError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status = 0, detail?: unknown) {
    super(message);
    this.name = 'GedClientError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Une requête GED, sur la surface choisie.
 *
 * Le chemin Nest passe par `cmsAdminFetch` — jeton, rafraîchissement du jeton,
 * en-tête d'erreur, tout ce que l'administration fait déjà partout ailleurs. Le
 * chemin Next est un `fetch` simple : ces routes sont internes au back-office, sans
 * jeton, comme l'était `/api/admin/upload` avant elles.
 */
async function request<T>(paths: { next: string; cms?: string }, init?: { method?: string; body?: BodyInit | null; json?: unknown }): Promise<T> {
  const active = await gedSurface();
  // Un `FormData` n'a rien à faire dans `cmsAdminFetch`, qui pose un
  // `Content-Type: application/json` : le multipart part sur les routes Next,
  // qui sont écrites pour lui.
  const multipart = init?.body instanceof FormData;
  if (active === 'cms' && paths.cms && !multipart) {
    try {
      return await cmsAdminFetch<T>(paths.cms, {
        method: init?.method,
        json: init?.json,
        body: init?.body,
        timeoutMs: 30000,
      });
    } catch (error) {
      // Le backend est vivant mais ne sait pas faire CECI (route absente, méthode
      // non gérée, ou réponse illisible) : on refait le coup depuis les routes
      // Next, qui connaissent la GED par cœur. Sans ce repli, un backend partiel
      // casse l'atelier et la médiathèque alors que le fichier, lui, est là.
      if (!isMissingOnCms(error)) throw asGedError(error);
      const missing = String(paths.cms);
      if (!cmsGaps.has(missing)) cmsGaps.add(missing);
    }
  }
  const response = await fetch(`/api/admin/ged${paths.next}`, {
    method: init?.method || 'GET',
    body: init?.json !== undefined ? JSON.stringify(init.json) : (init?.body ?? undefined),
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  const payload = text ? parse(text) : null;
  if (!response.ok) {
    throw new GedClientError(messageOf(payload) || `GED indisponible (${response.status})`, response.status, payload);
  }
  return (payload ?? null) as T;
}

/** Les routes Nest qui ont répondu « je ne connais pas » — pour le journal de debug. */
const cmsGaps = new Set<string>();

/** Ce que les routes Next savent faire, et pas (encore) le backend : gabarits, fiches, multipart. */
export function gedCmsGaps(): string[] {
  return [...cmsGaps];
}

/**
 * Une erreur qui veut dire « le backend ne sert pas cette route » : 404, 405,
 * 501 — ou une réponse HTML (le proxy du back-office qui renvoie la page
 * d'administration à la place du JSON). Une 401 n'en fait PAS partie : c'est la
 * session qui est en cause, pas la surface, et un repli sur Next écrirait au
 * mauvais endroit en silence.
 */
function isMissingOnCms(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 404 || status === 405 || status === 501) return true;
  const body = (error as { body?: unknown })?.body;
  if (!body || typeof body !== 'object') {
    // Une erreur réseau sans corps (`fetch` qui échoue) : Next est encore possible.
    return status === undefined || status === 0;
  }
  const message = messageOf(body);
  return /cannot\s.*(find|match)|not\s*found|404|html/i.test(message);
}

/** Un corps de réponse, quelle que soit sa forme : on ne fait jamais confiance au serveur. */
function parse(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : { error: String(value) };
  } catch {
    // Une page HTML d'erreur (proxy, maintenance) arrive ici : le premier fragment de
    // texte vaut mieux qu'un `JSON.parse` qui jette et masque le vrai problème.
    return { error: text.replace(/\s+/g, ' ').slice(0, 200) };
  }
}

function messageOf(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const raw = payload as { error?: unknown; message?: unknown };
  if (Array.isArray(raw.message)) return raw.message.join(' ');
  return String(raw.error ?? raw.message ?? '');
}

function asGedError(error: unknown): GedClientError {
  if (error instanceof GedClientError) return error;
  const status = (error as { status?: number })?.status || 0;
  return new GedClientError(messageOf((error as { body?: unknown })?.body) || (error as Error)?.message || 'GED indisponible', status, error);
}

/* ---------------------------------------------------------------------- assets */

/** Lister la GED : pagination, recherche, filtres module / type / tag / préfixe. */
export function listGedAssets(query: GedListQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return request<GedListResult>({ next: `/assets${qs ? `?${qs}` : ''}`, cms: `/ged/assets${qs ? `?${qs}` : ''}` });
}

/** Un asset : sa fiche complète, état éditable compris. */
export function readGedAsset(file: string) {
  const qs = new URLSearchParams({ file }).toString();
  return request<{ asset: GedAssetSummary; manifest: GedManifest | null; state: unknown | null }>({
    next: `/asset?${qs}`,
    cms: `/ged/asset?${qs}`,
  });
}

/** Le JSON rejouable d'un asset, ou `null` s'il n'a jamais été enregistré depuis l'atelier. */
export function readGedAssetState(file: string) {
  const qs = new URLSearchParams({ file }).toString();
  return request<{ file: string; state: unknown | null }>({ next: `/asset/state?${qs}`, cms: `/ged/asset/state?${qs}` });
}

/**
 * Écrire un asset depuis un Blob — le chemin de la retouche (recadrage, filtres,
 * détourage) et de l'import. `kind` décide du préfixe ; `overwrite` décide de la
 * version.
 */
export function saveGedBlob(input: {
  blob: Blob;
  filename?: string;
  kind?: string;
  module?: string;
  name?: string;
  prefix?: string;
  file?: string;
  overwrite?: string;
  title?: string;
  alt?: string;
  tags?: string[];
  width?: number;
  height?: number;
  state?: unknown;
  source?: GedCanvasExportPayload['source'];
}) {
  const form = new FormData();
  form.append('file', input.blob, input.filename || `${input.name || 'visuel'}`);
  // La destination porte un autre nom que `file`, qui est déjà pris par le fichier
  // lui-même : la route l'aurait lu comme une chaîne et écrit « [object File] ».
  if (input.file) form.append('target', input.file);
  for (const [key, value] of Object.entries(input)) {
    if (key === 'file' || key === 'blob') continue;
    if (value === undefined || value === null || value === '') continue;
    form.append(key, Array.isArray(value) ? value.join(',') : typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return request<GedSaveResult>({ next: '/assets', cms: '/ged/assets' }, { method: 'POST', body: form });
}

/**
 * Enregistrer un rendu de l'atelier : PNG, SVG quand le document est vectoriel, et
 * l'état Fabric rejouable — en une requête, pour que les trois partagent le même nom
 * et la même version. C'est le `POST /ged/canvas-export` du besoin.
 */
export function exportCanvas(payload: GedCanvasExportPayload) {
  return request<GedSaveResult>({ next: '/canvas-export', cms: '/ged/canvas-export' }, { method: 'POST', json: payload });
}

/** Pousser un nouvel état éditable sur un asset déjà rendu (brouillon, sans nouveau PNG). */
export function saveGedState(input: { file: string; state: unknown; format?: 'fabric' | 'svg' }) {
  return request<GedSaveResult>({ next: '/asset/state', cms: '/ged/asset/state' }, { method: 'POST', json: input });
}

/** Corriger les métadonnées d'un asset — ce que le `PATCH` historique ne savait pas faire. */
export function patchGedAsset(input: { file: string; title?: string; alt?: string; tags?: string[]; width?: number; height?: number }) {
  return request<GedSaveResult>({ next: '/asset', cms: '/ged/asset' }, { method: 'PATCH', json: input });
}

/** Renommer un asset ; la réponse porte la nouvelle URL à réécrire dans les pages. */
export function renameGedAsset(file: string, newName: string) {
  return request<{ file: string; url: string }>({ next: '/asset', cms: '/ged/asset' }, { method: 'PUT', json: { file, newName } });
}

export function deleteGedAsset(file: string, options: { purgeHistory?: boolean } = {}) {
  const params = new URLSearchParams({ file });
  if (options.purgeHistory) params.set('history', '1');
  return request<{ removed: string[]; file: string }>({ next: `/asset?${params}`, cms: `/ged/asset?${params}` }, { method: 'DELETE' });
}

/* -------------------------------------------------------------------- gabarits */

export function listGedTemplates() {
  return request<{ version: number; templates: GedTemplateSummary[] }>({ next: '/templates', cms: '/ged/templates' });
}

export function readGedTemplate(id: string) {
  return request<{ meta: GedTemplateSummary; template: Record<string, unknown> }>({
    next: `/templates?id=${encodeURIComponent(id)}`,
    cms: `/ged/templates/${encodeURIComponent(id)}`,
  });
}

/** Publier le canvas courant comme gabarit réutilisable (écrit dans `public/canvas`). */
export function saveGedTemplate(input: { id: string; meta?: Partial<GedTemplateSummary>; template: unknown }) {
  return request<GedTemplateSummary>({ next: '/templates', cms: '/ged/templates' }, { method: 'POST', json: input });
}

export function deleteGedTemplate(id: string) {
  return request<{ removed: string }>({ next: `/templates?id=${encodeURIComponent(id)}`, cms: `/ged/templates/${encodeURIComponent(id)}` }, { method: 'DELETE' });
}

/* ---------------------------------------------------------------------- divers */

/**
 * Un `data:` URL ou une URL de la GED → Blob.
 *
 * Les deux se lisent de la même façon en navigateur (`fetch` sait ouvrir une data URL)
 * ; l'utilité est de permettre à la retouche et à l'atelier d'envoyer leur rendu sans
 * passer par un fichier temporaire.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl, { cache: 'no-store' });
  if (!response.ok) throw new GedClientError(`Image illisible : ${dataUrl.slice(0, 40)}`, response.status);
  return response.blob();
}

/** Les dimensions naturelles d'une image de la GED, pour calibrer un plan de travail dessus. */
export function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.decoding = 'async';
    image.src = src;
  });
}

/** Une image chargée est-elle exportable (sinon le canvas est « taché » et `toDataURL` lève). */
export function canReadPixels(source: HTMLImageElement | HTMLCanvasElement): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.drawImage(source, 0, 0, 1, 1);
    context.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}
