// lib/entity-url.ts
/**
 * URLs « id-slug » et résolution multilingue.
 *
 * Format retenu pour la vitrine :  /{locale}/solutions/{id}-{slug}
 *   fr → /fr/solutions/3-bloc-operatoire-connecte
 *   ar → /ar/solutions/3-غرفة-العمليات-المتصلة
 *
 * L'ID en tête rend l'URL résoluble même si le slug change ou n'est pas
 * traduit ; le slug reste lisible. Au changement de langue, on utilise
 * l’id et le slug de la fiche sœur, retrouvée via son `legacyId`.
 */

import { slugify } from '@/lib/slugify';

export interface RoutableEntity {
  id?: unknown;
  slug?: unknown;
  legacyId?: unknown;
  title?: unknown;
  name?: unknown;
  locale?: unknown;
}

/** Un seul décodage, que le segment provienne du navigateur ou de Next. */
function routeParts(segment: string) {
  let raw: string;
  try {
    raw = decodeURIComponent(String(segment || '')).trim();
  } catch {
    // Un favori mal encodé ne doit pas interrompre le rendu de la page.
    return { raw: '', id: '', slug: '' };
  }
  const head = raw.split('-', 1)[0];
  return /^\d+$/.test(head)
    ? { raw, id: head, slug: raw.slice(head.length + 1) }
    : { raw, id: raw, slug: raw };
}

/**
 * Extrait la partie identifiante d'un segment d'URL.
 *
 *   `12-mon-slug`     → `12`               (ID numérique en préfixe)
 *   `bloc-operatoire` → `bloc-operatoire`  (jeux JSON à ID textuel : le
 *                                           segment entier EST l'identifiant)
 */
export function routeId(segment: string): string {
  return routeParts(segment).id;
}

/** Extrait la partie slug d'un segment `12-mon-slug` → `mon-slug`. */
export function routeSlug(segment: string): string {
  return routeParts(segment).slug;
}

/** Identifiant public d'une entité, sous forme de chaîne. */
export function entityId(entity: RoutableEntity | null | undefined): string {
  if (!entity) return '';
  return String(entity.id ?? '');
}

/** Slug d'une entité (celui stocké, sinon dérivé du titre). */
export function entitySlug(entity: RoutableEntity | null | undefined): string {
  if (!entity) return '';
  const stored = String(entity.slug ?? '').trim();
  if (stored) return stored;
  const label = String(entity.title ?? entity.name ?? '').trim();
  return label ? slugify(label) : '';
}

/**
 * Construit le segment d'URL d'une entité.
 *
 * - ID numérique  → `12-mon-slug` (l'ID préfixe, le slug reste lisible/SEO)
 * - ID textuel    → `mon-slug` (les jeux de données JSON utilisent déjà un
 *                   identifiant de type slug, inutile de le dupliquer)
 */
export function entityRouteKey(entity: RoutableEntity | null | undefined): string {
  const id = entityId(entity);
  const slug = entitySlug(entity);
  if (id && /^\d+$/.test(id)) return slug ? `${id}-${slug}` : id;
  return slug || id;
}

/**
 * Retrouve la contrepartie d'une entité dans une autre langue.
 * On tente d'abord `legacyId` (fiches sœurs créées par langue), puis l'ID
 * (traductions stockées en surcouche sur la même fiche).
 */
export function matchTranslation<T extends RoutableEntity>(
  source: RoutableEntity | null | undefined,
  targetItems: T[],
): T | null {
  if (!source || !Array.isArray(targetItems) || !targetItems.length) return null;

  const legacy = source.legacyId != null ? String(source.legacyId) : '';
  if (legacy) {
    const byLegacy = targetItems.find(
      (item) => item.legacyId != null && String(item.legacyId) === legacy,
    );
    if (byLegacy) return byLegacy;
  }

  const id = entityId(source);
  if (id) {
    const byId = targetItems.find((item) => entityId(item) === id);
    if (byId) return byId;
  }

  return null;
}

/** URL complète et localisée d'une entité, ex. `/fr/solutions/3-imagerie`. */
export function entityUrl(
  locale: string,
  basePath: string,
  entity: RoutableEntity | null | undefined,
): string {
  const path = String(basePath || '').replace(/^\/+|\/+$/g, '');
  const key = entityRouteKey(entity);
  return `/${locale}/${path}${key ? `/${key}` : ''}`;
}

/**
 * Retrouve l'entité correspondant à un segment d'URL.
 * D'abord l'adresse exacte, puis l'identifiant stable (même si le slug a
 * changé). Les anciennes adresses composées ne servent qu'en dernier recours.
 */
export function findByRouteKey<T extends RoutableEntity>(
  items: T[],
  segment: string,
): T | null {
  if (!Array.isArray(items) || !items.length || !segment) return null;

  const { raw, id, slug: slugPart } = routeParts(segment);
  if (!raw) return null;

  // 1) ID exact (cas nominal : l'ID préfixe l'URL)
  const byId = items.find((item) => entityId(item) && entityId(item) === id);
  if (byId && (id === raw || entityRouteKey(byId) === raw)) return byId;

  // 2) Segment complet == slug stocké (URLs historiques sans ID)
  const byFullSlug = items.find((item) => entitySlug(item) === raw);
  if (byFullSlug) return byFullSlug;
  if (byId) return byId; // slug modifié, mais même identifiant

  // 3) Partie texte == slug stocké
  if (slugPart && slugPart !== raw) {
    const bySlug = items.find((item) => entitySlug(item) === slugPart);
    if (bySlug) return bySlug;
  }

  // 4) legacyId (lien entre versions linguistiques)
  const byLegacy = items.find(
    (item) => item.legacyId != null && String(item.legacyId) === id,
  );
  if (byLegacy) return byLegacy;

  // Les anciens liens de fiche concaténaient le legacyId et le slug, par
  // exemple `news-2-dossier-ete` ou `news-m1-abc123-dossier-ete`. Le numéro
  // du legacyId n'est PAS l'id public de la traduction. Chercher la clé
  // réellement stockée, avec son tiret de séparation, la plus précise d'abord.
  let legacyMatch: T | null = null;
  let longest = 0;
  for (const item of items) {
    const legacy = String(item.legacyId ?? '');
    if (legacy.length > longest && raw.startsWith(`${legacy}-`)) {
      legacyMatch = item;
      longest = legacy.length;
    }
    // Certaines anciennes cartes utilisaient l'id textuel + le slug du titre.
    const oldId = entityId(item);
    if (oldId && raw.startsWith(`${oldId}-`)) {
      const tail = raw.slice(oldId.length + 1);
      if (tail && (tail === entitySlug(item) || tail === slugify(String(item.title ?? item.name ?? '')))) return item;
    }
  }
  return legacyMatch;
}

/**
 * Traduit un segment `id-slug` vers une autre langue.
 * On garde l'ID (stable entre les langues) et on remplace le slug par celui
 * de la fiche traduite. Si aucune traduction n'est connue, le segment initial
 * est conservé — la page saura toujours le résoudre grâce à l'ID.
 */
export function translateRouteKey<T extends RoutableEntity>(
  segment: string,
  targetItems: T[],
  translatedSlug?: string,
): string {
  const { raw, id } = routeParts(segment);
  if (!raw) return raw;

  // a) On dispose de la liste des fiches dans la langue cible
  const match = findByRouteKey(targetItems, segment);
  if (match) return entityRouteKey(match);

  // b) Slug traduit fourni par la fiche i18n (localStorage)
  if (translatedSlug) {
    return id && /^\d+$/.test(id) ? `${id}-${translatedSlug}` : translatedSlug;
  }

  return raw;
}

/**
 * Sélectionne, dans une liste, les entités désignées par une liste d'ids.
 *
 * Les ids saisis dans l'admin (`productIds` d'une solution, par exemple)
 * pointent vers les fiches de la langue de saisie. Quand chaque langue possède
 * sa propre ligne en base, ces ids n'existent pas tels quels dans la langue
 * consultée : on rattrape alors la correspondance via `legacyId`.
 *
 * @param items    fiches disponibles dans la langue affichée
 * @param ids      identifiants enregistrés sur la fiche parente
 * @param allItems fiches toutes langues confondues (facultatif) servant à
 *                 retrouver le `legacyId` d'un id d'une autre langue
 */
export function selectByIds<T extends RoutableEntity>(
  items: T[],
  ids: Array<string | number> | undefined | null,
  allItems?: T[],
): T[] {
  if (!Array.isArray(items) || !Array.isArray(ids) || !ids.length) return [];
  const wanted = new Set(ids.map((id) => String(id)));

  // 1) Correspondance directe par id (cas courant : ids partagés entre langues)
  const direct = items.filter((item) => wanted.has(entityId(item)));
  if (direct.length === wanted.size) return direct;

  // 2) Rattrapage par legacyId pour les ids restants
  const pool = allItems && allItems.length ? allItems : items;
  const legacyWanted = new Set<string>();
  for (const id of wanted) {
    const source = pool.find((item) => entityId(item) === id);
    if (source?.legacyId != null) legacyWanted.add(String(source.legacyId));
  }
  if (!legacyWanted.size) return direct;

  const found = new Set(direct.map((item) => entityId(item)));
  const extra = items.filter(
    (item) =>
      !found.has(entityId(item)) &&
      item.legacyId != null &&
      legacyWanted.has(String(item.legacyId)),
  );

  return [...direct, ...extra];
}
