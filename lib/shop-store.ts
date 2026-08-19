export type PaymentType = 'card-intl' | 'cib' | 'transfer' | 'paypal' | 'check' | 'cod' | 'other';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentType;
  active: boolean;
  fees: number;
  instructions: string;
  iban?: string;
  rib?: string;
  account?: string;
  paypalEmail?: string;
  apiKey?: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'fixed' | 'percent';
  amount: number;
  maxDiscount?: number;
  minOrder?: number;
  start: string;
  end: string;
  limitGlobal?: number;
  limitPerClient?: number;
  used: number;
  scope: 'all' | 'category' | 'product';
  scopeValues: string[];
  stackable: boolean;
  active: boolean;
  revenue: number;
}

export interface TaxRule {
  id: string;
  name: string;
  mode: 'percent' | 'fixed';
  rate: number;
  zone: string;
  category?: string;
  included: boolean;
  priority: number;
  active: boolean;
  start?: string;
  end?: string;
}

const PAY_KEY = 'sari_payments';
const COUPON_KEY = 'sari_coupons';
const TAX_KEY = 'sari_taxes';

const DEFAULT_PAYMENTS: PaymentMethod[] = [
  { id: 'p1', name: 'Carte internationale', type: 'card-intl', active: true, fees: 2.5, instructions: 'Paiement 3D Secure.', apiKey: '' },
  { id: 'p2', name: 'Carte CIB', type: 'cib', active: true, fees: 1.2, instructions: 'Terminal CIB / SATIM.' },
  { id: 'p3', name: 'Virement', type: 'transfer', active: true, fees: 0, instructions: 'Mentionner le n° de commande.', iban: 'DZ58 0000 0000 0000 0000 0000', rib: '007 99999 00000000000 12' },
  { id: 'p4', name: 'PayPal', type: 'paypal', active: false, fees: 3.4, instructions: 'Compte business.', paypalEmail: 'paiements@sarisysteme.com' },
  { id: 'p5', name: 'Chèque', type: 'check', active: true, fees: 0, instructions: 'À l’ordre de SARI Système.' },
  { id: 'p6', name: 'Paiement à la livraison', type: 'cod', active: true, fees: 400, instructions: 'Espèces uniquement.' },
];

const DEFAULT_COUPONS: Coupon[] = [
  { id: 'c1', code: 'SARI10', type: 'percent', amount: 10, maxDiscount: 20000, minOrder: 5000, start: '2026-01-01', end: '2026-12-31', limitGlobal: 200, limitPerClient: 1, used: 18, scope: 'all', scopeValues: [], stackable: false, active: true, revenue: 142000 },
  { id: 'c2', code: 'CLINIQUE5000', type: 'fixed', amount: 5000, minOrder: 20000, start: '2026-06-01', end: '2026-09-30', limitGlobal: 50, used: 7, scope: 'category', scopeValues: ['Diagnostic'], stackable: false, active: true, revenue: 98000 },
];

const DEFAULT_TAXES: TaxRule[] = [
  { id: 't1', name: 'TVA standard', mode: 'percent', rate: 19, zone: 'DZ', included: false, priority: 1, active: true },
  { id: 't2', name: 'TVA réduite consommables', mode: 'percent', rate: 9, zone: 'DZ', category: 'Consommables', included: false, priority: 2, active: true },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPayments() { return read(PAY_KEY, DEFAULT_PAYMENTS); }
export function savePayments(rows: PaymentMethod[]) { localStorage.setItem(PAY_KEY, JSON.stringify(rows)); }
export function loadCoupons() { return read(COUPON_KEY, DEFAULT_COUPONS); }
export function saveCoupons(rows: Coupon[]) { localStorage.setItem(COUPON_KEY, JSON.stringify(rows)); }
export function loadTaxes() { return read(TAX_KEY, DEFAULT_TAXES); }
export function saveTaxes(rows: TaxRule[]) { localStorage.setItem(TAX_KEY, JSON.stringify(rows)); }

export function generateCouponCode() {
  return `SARI${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function couponStatus(c: Coupon) {
  if (!c.active) return 'inactif';
  const now = new Date().toISOString().slice(0, 10);
  if (c.start && now < c.start) return 'à venir';
  if (c.end && now > c.end) return 'expiré';
  if (c.limitGlobal && c.used >= c.limitGlobal) return 'épuisé';
  return 'actif';
}
