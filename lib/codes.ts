'use client';

import { loadAdminSettings } from '@/lib/admin-settings';

/**
 * Génération des codes de pièces (devis, commande, facture, produit).
 * Les formats sont configurables dans Paramètres → Commerce → Format des codes.
 *
 * Jetons disponibles :
 *   {ID} → identifiant sur 5 chiffres (ex. 00007)
 *   {XX} → année de la pièce sur 2 chiffres (ex. 26)
 *   {YY} → alias de {XX} (accepté aussi)
 */

export type CodeKind = 'quote' | 'order' | 'invoice' | 'product';

export const CODE_KIND_LABELS: Record<CodeKind, string> = {
  quote: 'Devis',
  order: 'Commande',
  invoice: 'Facture',
  product: 'Produit',
};

/** Template par défaut pour chaque type de pièce. */
export function templateFor(kind: CodeKind): string {
  const s = loadAdminSettings();
  return s.codes?.[kind] || DEFAULT_TEMPLATES[kind];
}

export const DEFAULT_TEMPLATES: Record<CodeKind, string> = {
  quote: 'SARI-WDEV-{ID}',
  order: 'SARI-WCMD{XX}-{ID}',
  invoice: 'SARI-WFAV{XX}-{ID}',
  product: 'SARI-WPRO{XX}-{ID}',
};

/** Remplace les jetons {ID}, {XX}, {YY} d'un template. */
export function formatCode(template: string, id: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const yy = String(y % 100).padStart(2, '0');
  return template
    .replace(/\{XX\}/g, yy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{ID\}/g, String(Math.floor(id)).padStart(5, '0'));
}

/** Extrait le suffixe numérique terminal d'un code (ex. « …-00007 » → 7). */
export function numericSuffix(code: string): number {
  const m = String(code || '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

/** Prévisualise un code (sans incrément) pour affichage dans les réglages. */
export function previewCode(kind: CodeKind, template?: string): string {
  return formatCode(template || templateFor(kind), 1);
}

/**
 * Génère le prochain code d'un type donné, en déduisant l'incrément des codes
 * existants (même préfixe / même année).
 */
export function nextCodeFor(kind: CodeKind, existing: string[], year?: number): string {
  const template = templateFor(kind);
  const y = year ?? new Date().getFullYear();
  const yy = String(y % 100).padStart(2, '0');
  const prefix = template
    .replace(/\{ID\}/g, '')
    .replace(/\{XX\}/g, yy)
    .replace(/\{YY\}/g, yy);
  const max = existing
    .filter((c) => c && String(c).startsWith(prefix))
    .reduce((m, c) => Math.max(m, numericSuffix(String(c))), 0);
  return formatCode(template, max + 1, y);
}
