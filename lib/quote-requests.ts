'use client';

import { loadQuotes, saveQuotes, type Quote, type QuoteStatus } from '@/lib/crm-store';

/** Métadonnées de workflow (badge + libellé) pour les demandes de devis. */
export const QUOTE_STATUS_META: Array<{ value: QuoteStatus; label: string }> = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'submitted', label: 'Soumis' },
  { value: 'processing', label: 'En cours de traitement' },
  { value: 'replied', label: 'Répondu' },
  { value: 'revision', label: 'Révision demandée' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'rejected', label: 'Refusé' },
  { value: 'transformed', label: 'Transformé en commande' },
  { value: 'expired', label: 'Expiré' },
  { value: 'cancelled', label: 'Annulé' },
];

export const QUOTE_NATURES = [
  { value: 'vente', label: 'Vente' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'appel-offre', label: 'Appel d’offre' },
  { value: 'vente-gros', label: 'Vente en gros' },
  { value: 'autre', label: 'Autre' },
];

export const QUOTE_UNITS = ['pièce', 'kg', 'carton', 'm²', 'mètre', 'litre', 'palette', 'unité'];

export function quoteStatusLabel(status: QuoteStatus): string {
  return QUOTE_STATUS_META.find((s) => s.value === status)?.label || status;
}

/** Couleur de badge par statut. */
export function quoteStatusColor(status: QuoteStatus): string {
  switch (status) {
    case 'accepted':
    case 'transformed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'replied':
    case 'processing':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'revision':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'submitted':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    default:
      return 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** Génère un numéro de référence unique DV-YYYY-NNNNN. */
export function generateQuoteReference(existing: Quote[]): string {
  const year = new Date().getFullYear();
  const prefix = `DV-${year}-`;
  const nums = existing
    .map((q) => (q.reference || '').startsWith(prefix) ? Number((q.reference || '').slice(prefix.length)) : 0)
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

/** Liste des demandes d'un client (par email). */
export function loadClientQuotes(email: string): Quote[] {
  return loadQuotes()
    .filter((q) => String(q.email || '').toLowerCase() === String(email || '').toLowerCase())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function saveQuote(quote: Quote) {
  const all = loadQuotes();
  const idx = all.findIndex((q) => q.id === quote.id);
  if (idx >= 0) all[idx] = quote;
  else all.push(quote);
  saveQuotes(all);
}

export function nextQuoteId(): number {
  const all = loadQuotes();
  return (all.length ? Math.max(...all.map((q) => Number(q.id) || 0)) : 2000) + 1;
}

/** Statut réel (mappe les statuts legacy du backoffice vers le workflow client). */
export function normalizeStatus(status: QuoteStatus): QuoteStatus {
  if (status === 'pending') return 'draft';
  if (status === 'sent') return 'submitted';
  return status;
}
