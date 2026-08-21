'use client';

import type { PaymentType } from '@/lib/shop-store';

export type PaymentStatus = 'validated' | 'pending' | 'rejected';

/** Normalise la valeur « payment » d'une commande admin vers un PaymentType. */
export function normalizeOrderPaymentType(payment?: string): PaymentType {
  switch ((payment || '').toLowerCase()) {
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
  };
  return map[type] || type;
}

/** Statut lisible. */
export function paymentStatusLabel(status: PaymentStatus): string {
  return status === 'validated' ? 'Validé' : status === 'rejected' ? 'Rejeté' : 'En attente';
}

const DEMO_RECORDS: PaymentRecord[] = [
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

export function loadPaymentRecords(): PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(DEMO_RECORDS));
      return DEMO_RECORDS;
    }
    return JSON.parse(raw) as PaymentRecord[];
  } catch {
    return DEMO_RECORDS;
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
