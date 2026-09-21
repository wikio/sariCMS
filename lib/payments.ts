'use client';

import type { PaymentType } from '@/lib/shop-store';

export type PaymentStatus = 'validated' | 'pending' | 'rejected';

/** Normalise la valeur « payment » d'une commande admin vers un PaymentType. */
export function normalizeOrderPaymentType(payment?: string): PaymentType {
  const v = (payment || '').toLowerCase().trim();
  switch (v) {
    case 'pending':
    case 'en_attente':
    case 'en attente':
      return 'pending' as PaymentType;
    case 'card-intl':
    case 'credit':
    case 'visa':
    case 'mastercard':
      return 'card-intl';
    case 'cib':
      return 'cib';
    case 'transfer':
    case 'virement':
      return 'transfer';
    case 'paypal':
      return 'paypal';
    case 'check':
    case 'cheque':
      return 'check';
    case 'cod':
    case 'cash':
    case 'delivery':
      return 'cod';
    default:
      return 'other';
  }
}

export interface PaymentRecord {
  id: string;
  /** Identifiant de la commande liée (vitrine / panier). */
  orderId: number | null;
  /** Code de commande auto-généré (si connu). */
  orderCode?: string;
  client: string;
  email: string;
  method: PaymentType;
  methodName: string;
  amount: number;
  status: PaymentStatus;
  /** Derniers 4 chiffres de la carte (paiement par carte). */
  cardLast4?: string;
  /** Affichage masqué « **** **** **** 1234 ». */
  cardMasked?: string;
  /** Note écrite lors de la validation manuelle. */
  note?: string;
  date: string;
  validatedAt?: string;
}

const KEY = 'sari_payment_records';

export const PAYMENT_EVENT = 'sari-payments-changed';

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PAYMENT_EVENT));
}

/** Une carte ou PayPal est validé automatiquement ; le reste exige une validation manuelle. */
export function isAutoValidated(method: PaymentType): boolean {
  return method === 'card-intl' || method === 'cib' || method === 'paypal';
}

/** Méthodes nécessitant une validation manuelle (virement, chèque, cash, autre). */
export function isManualMethod(method: PaymentType): boolean {
  return !isAutoValidated(method);
}

/** Label lisible d'un type de paiement. */
export function paymentTypeLabel(type: PaymentType): string {
  const map: Record<PaymentType, string> = {
    'card-intl': 'Carte internationale',
    cib: 'Carte CIB / locale',
    transfer: 'Virement bancaire',
    paypal: 'PayPal',
    check: 'Chèque',
    cod: 'Paiement à la livraison',
    other: 'Autre',
    pending: 'En attente',
  };
  return map[type] || type;
}

/** Statut lisible. */
export function paymentStatusLabel(status: PaymentStatus): string {
  return status === 'validated' ? 'Validé' : status === 'rejected' ? 'Rejeté' : 'En attente';
}

/**
 * Lignes de démonstration à écarter d'un cache hérité.
 *
 * Au seul `id`, on empiéterait sur une donnée réelle : un opérateur qui a *corrigé*
 * une ligne de démonstration (montant, client, statut) pour en faire un vrai
 * enregistrement lui laisse son `id` — `pr1` — et le purger sur ce seul critère
 * serait effacer sa saisie. Une ligne n'est donc retirée que si rien de ce qu'un
 * opérateur aurait pu changer n'a changé : `id`, montant, statut, date et client
 * doivent tous correspondre à l'originel.
 *
 * Le corollaire vaut d'être dit : une ligne de démonstration retouchée reste
 * affichée, et continuera d'entrer dans les totaux. C'est le prix de ne jamais
 * détruire une saisie sur une supposition, et l'écran le signale par ailleurs.
 */
function isUntouchedDemoRow(row: PaymentRecord, demo: readonly PaymentRecord[]): boolean {
  const twin = demo.find((d) => d.id === row.id);
  if (!twin) return false;
  return (
    Number(row.amount) === Number(twin.amount) &&
    String(row.status) === String(twin.status) &&
    String(row.date) === String(twin.date) &&
    String(row.client) === String(twin.client)
  );
}

/*
 * Jeu de démonstration. Seule voie d'entrée autorisée : un amorçage **volontaire**
 * (`lib/demo-seed.ts`). Aucune lecture de ce magasin ne le pose, sinon un poste sans
 * transaction afficherait des virements rapprochés et des paiements par carte
 * validés — et leur total entrerait dans les chiffres présentés à l'opérateur.
 */
export const DEMO_PAYMENT_RECORDS: PaymentRecord[] = [
  {
    id: 'pr1', orderId: 1001, orderCode: 'SARI-WCMD26-00001', client: 'Dr. Marie Laurent', email: 'marie@clinique.fr',
    method: 'transfer', methodName: 'Virement', amount: 4500, status: 'validated',
    note: 'Virement reçu le 16/01, rapprochement OK.', date: '2026-01-15T09:00:00.000Z', validatedAt: '2026-01-16T10:00:00.000Z',
  },
  {
    id: 'pr2', orderId: 1002, orderCode: 'SARI-WCMD26-00002', client: 'CHU de Lyon', email: 'achats@chu-lyon.fr',
    method: 'card-intl', methodName: 'Carte internationale', amount: 18500, status: 'validated',
    cardLast4: '4242', cardMasked: '**** **** **** 4242', date: '2026-02-01T14:00:00.000Z', validatedAt: '2026-02-01T14:00:00.000Z',
  },
  {
    id: 'pr3', orderId: 1003, orderCode: 'SARI-WCMD26-00003', client: 'Cabinet Médical du Parc', email: 'secretariat@cabinet-parc.dz',
    method: 'cod', methodName: 'Paiement à la livraison', amount: 850, status: 'pending',
    date: '2026-03-10T11:00:00.000Z',
  },
  {
    id: 'pr4', orderId: 1007, orderCode: 'SARI-WCMD26-00007', client: 'Dr. Amina Khelifi', email: 'amina.k@cabinet.dz',
    method: 'cib', methodName: 'Carte CIB', amount: 28800, status: 'validated',
    cardLast4: '0771', cardMasked: '**** **** **** 0771', date: '2026-06-18T16:00:00.000Z', validatedAt: '2026-06-18T16:00:00.000Z',
  },
  {
    id: 'pr5', orderId: 1008, orderCode: 'SARI-WCMD26-00008', client: 'Clinique El Afia', email: 'direction@eliafia.dz',
    method: 'check', methodName: 'Chèque', amount: 42000, status: 'pending',
    date: '2026-06-22T10:00:00.000Z',
  },
];

/**
 * Les encaissements enregistrés sur ce poste.
 *
 * Trois corrections d'un même geste, parce que ce magasin est comptable :
 *
 * - il ne s'écrit **plus rien** au premier lecture. `loadPaymentRecords()`
 *   installait `DEMO_RECORDS` dans le `localStorage` de toute personne ouvrant
 *   l'écran — administrateur comme visiteur —, ce qui fabriquait de faux
 *   encaissements (virements « rapprochés », carte `**** 4242` validée, 4 500 €
 *   encaissés) là où aucune transaction n'avait eu lieu. Un relevé comptable ne
 *   se complète pas tout seul.
 * - un `catch` ne rend plus le jeu de démonstration : un cache illisible rend une
 *   liste vide, pas des lignes inventées.
 * - les lignes de démonstration déjà en place sont **retirées à la lecture**, sur
 *   leur identifiant (`pr1`…`pr5`, contre `pay-<horodatage>-<aléa>` pour une
 *   ligne réelle), puis la purge est réécrite si elle a de quoi l'être. Un poste
 *   qui les avait reçues avant ce correctif ne continue donc pas de les compter
 *   dans son chiffre d'affaires.
 *
 * Le jeu de démonstration a sa place ailleurs : `lib/demo-seed.ts`, déclenché
 * volontairement, pas posé en tapant sur une page.
 */
export function loadPaymentRecords(): PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const real = (parsed as PaymentRecord[]).filter((r) => !isUntouchedDemoRow(r, DEMO_PAYMENT_RECORDS));
    if (real.length !== parsed.length) {
      try {
        localStorage.setItem(KEY, JSON.stringify(real));
      } catch {
        /* quota atteint ou écriture refusée : la lecture reste correcte sans le cache */
      }
    }
    return real;
  } catch {
    // Cache illisible : une liste vide. Rendre le jeu de démonstration ici
    // afficherait des encaissements fictifs comme s'ils étaient réels.
    return [];
  }
}

export function savePaymentRecords(rows: PaymentRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  emit();
}

/** Enregistre un paiement ; le statut est déduit de la méthode (carte/PayPal = validé). */
export function addPaymentRecord(input: {
  orderId: number | null;
  orderCode?: string;
  client: string;
  email: string;
  method: PaymentType;
  methodName: string;
  amount: number;
  cardLast4?: string;
}): PaymentRecord {
  const now = new Date().toISOString();
  const auto = isAutoValidated(input.method);
  const record: PaymentRecord = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orderId: input.orderId,
    orderCode: input.orderCode,
    client: input.client,
    email: input.email,
    method: input.method,
    methodName: input.methodName,
    amount: Number(input.amount) || 0,
    status: auto ? 'validated' : 'pending',
    cardLast4: input.cardLast4,
    cardMasked: input.cardLast4 ? `**** **** **** ${input.cardLast4}` : undefined,
    date: now,
    validatedAt: auto ? now : undefined,
  };
  savePaymentRecords([record, ...loadPaymentRecords()]);
  return record;
}

/** Validation manuelle (virement, chèque, cash) avec note obligatoire. */
export function validatePayment(id: string, note: string): void {
  savePaymentRecords(
    loadPaymentRecords().map((p) =>
      p.id === id ? { ...p, status: 'validated', note: note.trim(), validatedAt: new Date().toISOString() } : p,
    ),
  );
}

export function rejectPayment(id: string, note: string): void {
  savePaymentRecords(
    loadPaymentRecords().map((p) =>
      p.id === id ? { ...p, status: 'rejected', note: note.trim() } : p,
    ),
  );
}

export function deletePayment(id: string): void {
  savePaymentRecords(loadPaymentRecords().filter((p) => p.id !== id));
}

/** Statuts de commande qui signifient « réglé, ou une étape plus loin ». */
export const PAID_OR_ABOVE = ['paid', 'processing', 'shipped', 'delivered'] as const;

/** La commande est-elle à un stade où son paiement doit apparaître comme validé ? */
export function isPaidOrAbove(status?: string | null): boolean {
  return !!status && (PAID_OR_ABOVE as readonly string[]).includes(status);
}

/**
 * Aligne le journal des paiements sur le statut de la commande.
 *
 * Règle demandée : dès que la commande passe à « payé » ou à une étape
 * supérieure (préparation, expédiée, livrée), la ligne de paiement qui lui est
 * rattachée doit suivre et passer en **validé**.
 *
 * Deux garde-fous assumés :
 * - le sens inverse n'est **pas** automatique : revenir à « en attente » ne
 *   dévalide pas un paiement déjà validé. C'est volontaire — un encaissement
 *   réel ne s'annule pas d'un clic sur un statut ; l'administrateur utilise
 *   « Désactiver » dans la liste s'il faut vraiment le retirer.
 * - seule une ligne `pending` est promue. Une ligne déjà `rejected` reste
 *   rejetée : elle a fait l'objet d'une décision explicite.
 *
 * Le rattachement se fait par `orderId`, avec repli sur `orderCode` pour les
 * enregistrements créés avant que l'identifiant numérique soit connu.
 *
 * @returns le nombre de lignes promues (0 si rien à faire).
 */
export function syncPaymentsFromOrder(order: {
  id?: number | null;
  code?: string | null;
  status?: string | null;
}): number {
  if (!isPaidOrAbove(order.status)) return 0;

  const rows = loadPaymentRecords();
  const id = Number(order.id) || null;
  const code = (order.code || '').trim();
  const stamp = new Date().toISOString();
  let promoted = 0;

  const next = rows.map((p) => {
    const matches = (id != null && Number(p.orderId) === id) || (!!code && (p.orderCode || '').trim() === code);
    if (!matches || p.status !== 'pending') return p;
    promoted += 1;
    return {
      ...p,
      status: 'validated' as PaymentStatus,
      validatedAt: p.validatedAt || stamp,
      note: p.note?.trim() ? p.note : 'Validé automatiquement : commande passée à l’étape « payé » ou au-delà.',
    };
  });

  if (promoted) savePaymentRecords(next);
  return promoted;
}

/**
 * Export CSV du journal des paiements (séparateur « ; » + BOM UTF-8,
 * compatible Excel). Masque les numéros de carte (derniers 4 chiffres).
 */
export function exportPaymentsCsv(rows: PaymentRecord[], filename = 'paiements') {
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cols = ['Commande', 'Client', 'Email', 'Méthode', 'Carte', 'Montant (DA)', 'Statut', 'Note', 'Date', 'Validé le'];
  const lines = [cols.join(';')];
  for (const p of rows) {
    lines.push(
      [
        esc(p.orderCode || (p.orderId ? `#${p.orderId}` : '')),
        esc(p.client),
        esc(p.email),
        esc(p.methodName || paymentTypeLabel(p.method)),
        esc(p.cardMasked || ''),
        String(p.amount),
        esc(paymentStatusLabel(p.status)),
        esc(p.note || ''),
        esc(new Date(p.date).toLocaleString()),
        esc(p.validatedAt ? new Date(p.validatedAt).toLocaleString() : ''),
      ].join(';'),
    );
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
