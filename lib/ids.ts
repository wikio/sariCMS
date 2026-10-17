/** Compare an entity id/slug with a route param (number from JSON or UUID/slug from the API). */
export function matchesEntity(
  item: { id?: unknown; slug?: unknown; legacyId?: unknown } | null | undefined,
  rawId: unknown,
): boolean {
  if (!item || rawId === undefined || rawId === null || rawId === '') return false;
  const needle = String(rawId);
  if (item.id !== undefined && item.id !== null && String(item.id) === needle) return true;
  if (item.slug !== undefined && item.slug !== null && String(item.slug) === needle) return true;
  const n = Number(rawId);
  if (!Number.isNaN(n) && Number(item.id) === n) return true;
  // URL de type `<id>-<slug>` : on retente avec la tête numérique (ex. "14" de "14-directeur").
  const prefix = needle.split('-')[0];
  if (prefix !== needle && prefix) {
    if (item.id !== undefined && item.id !== null && String(item.id) === prefix) return true;
    const pn = Number(prefix);
    if (!Number.isNaN(pn) && Number(item.id) === pn) return true;
  }

  // Dernier recours : le legacyId, partagé par toutes les versions
  // linguistiques d'une fiche. Sans lui, une URL portant l'id d'une autre
  // langue (cas du changement de langue) ne trouvait aucune correspondance
  // et la page affichait « introuvable ».
  if (item.legacyId !== undefined && item.legacyId !== null) {
    const legacy = String(item.legacyId);
    if (legacy === needle || (prefix && legacy === prefix)) return true;
  }
  return false;
}

export function asPublicId(row: { id?: unknown; legacyId?: unknown; slug?: unknown }): string | number {
  if (typeof row.legacyId === 'number') return row.legacyId;
  if (typeof row.id === 'number') return row.id;
  if (typeof row.id === 'string' && /^\d+$/.test(row.id)) return Number(row.id);
  if (typeof row.id === 'string') return row.id;
  if (typeof row.slug === 'string') return row.slug;
  return String(row.id ?? '');
}
