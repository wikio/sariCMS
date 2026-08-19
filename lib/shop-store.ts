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
  excludeValues: string[];
  stackable: boolean;
  active: boolean;
  revenue: number;
}

export interface CouponUse {
  id: string;
  couponId: string;
  code: string;
  orderId: number;
  client: string;
  email: string;
  date: string;
  discount: number;
}

export interface TaxRule {
  id: string;
  name: string;
  names?: Record<string, string>;
  labels?: Record<string, string>;
  mode: 'percent' | 'fixed';
  rate: number;
  zone: string;
  category?: string;
  scope?: 'all' | 'category' | 'product';
  scopeValues?: string[];
  included: boolean;
  priority: number;
  active: boolean;
  start?: string;
  end?: string;
}

const PAY_KEY = 'sari_payments';
const COUPON_KEY = 'sari_coupons';
const TAX_KEY = 'sari_taxes';
const USE_KEY = 'sari_coupon_uses';

const DEFAULT_PAYMENTS: PaymentMethod[] = [
  { id: 'p1', name: 'Carte internationale', type: 'card-intl', active: true, fees: 2.5, instructions: 'Paiement 3D Secure via passerelle internationale.', apiKey: '' },
  { id: 'p2', name: 'Carte CIB', type: 'cib', active: true, fees: 1.2, instructions: 'Terminal CIB / SATIM — cartes locales algériennes.' },
  { id: 'p3', name: 'Virement', type: 'transfer', active: true, fees: 0, instructions: 'Mentionner le n° de commande dans le libellé.', iban: 'DZ580007999990000000000012', rib: '007 99999 00000000000 12', account: 'SARI Système' },
  { id: 'p4', name: 'PayPal', type: 'paypal', active: false, fees: 3.4, instructions: 'Compte business PayPal.', paypalEmail: 'paiements@sarisysteme.com' },
  { id: 'p5', name: 'Chèque', type: 'check', active: true, fees: 0, instructions: 'À l’ordre de SARI Système, encaissement sous 8 jours.' },
  { id: 'p6', name: 'Paiement à la livraison', type: 'cod', active: true, fees: 400, instructions: 'Espèces uniquement à la livraison.' },
];

const DEFAULT_COUPONS: Coupon[] = [
  { id: 'c1', code: 'SARI10', type: 'percent', amount: 10, maxDiscount: 20000, minOrder: 5000, start: '2026-01-01', end: '2026-12-31', limitGlobal: 200, limitPerClient: 1, used: 18, scope: 'all', scopeValues: [], excludeValues: [], stackable: false, active: true, revenue: 142000 },
  { id: 'c2', code: 'CLINIQUE5000', type: 'fixed', amount: 5000, minOrder: 20000, start: '2026-06-01', end: '2026-09-30', limitGlobal: 50, used: 7, scope: 'category', scopeValues: ['Diagnostic'], excludeValues: [], stackable: false, active: true, revenue: 98000 },
  { id: 'c3', code: 'RENTREE26', type: 'percent', amount: 15, maxDiscount: 50000, minOrder: 10000, start: '2026-09-01', end: '2026-09-30', limitGlobal: 80, limitPerClient: 2, used: 0, scope: 'product', scopeValues: ['Échographe Portable Pro'], excludeValues: ['Consommables'], stackable: true, active: true, revenue: 0 },
];

const DEFAULT_TAXES: TaxRule[] = [
  { id: 't1', name: 'TVA standard', names: { fr: 'TVA standard', en: 'Standard VAT', ar: 'ضريبة القيمة المضافة' }, labels: { fr: 'TVA 19 %', en: 'VAT 19%', ar: 'ض.ق.م 19٪' }, mode: 'percent', rate: 19, zone: 'DZ', scope: 'all', scopeValues: [], included: false, priority: 1, active: true },
  { id: 't2', name: 'TVA réduite consommables', names: { fr: 'TVA réduite consommables', en: 'Reduced VAT consumables', ar: 'ضريبة مخفضة' }, labels: { fr: 'TVA 9 %', en: 'VAT 9%', ar: 'ض.ق.م 9٪' }, mode: 'percent', rate: 9, zone: 'DZ', category: 'Consommables', scope: 'category', scopeValues: ['Consommables'], included: false, priority: 2, active: true },
  { id: 't3', name: 'Éco-taxe', names: { fr: 'Éco-taxe', en: 'Eco-tax', ar: 'ضريبة بيئية' }, labels: { fr: 'Éco-taxe', en: 'Eco-tax', ar: 'ضريبة بيئية' }, mode: 'fixed', rate: 250, zone: 'DZ', scope: 'all', scopeValues: [], included: true, priority: 3, active: true },
];

const DEFAULT_USES: CouponUse[] = [
  { id: 'u1', couponId: 'c1', code: 'SARI10', orderId: 1003, client: 'Cabinet Médical du Parc', email: 'secretariat@cabinet-parc.dz', date: '2026-07-10', discount: 85 },
  { id: 'u2', couponId: 'c1', code: 'SARI10', orderId: 1007, client: 'Dr. Amina Khelifi', email: 'amina.k@cabinet.dz', date: '2026-03-18', discount: 3200 },
  { id: 'u3', couponId: 'c2', code: 'CLINIQUE5000', orderId: 1008, client: 'Clinique El Afia', email: 'direction@eliafia.dz', date: '2026-06-22', discount: 5000 },
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
export function loadCoupons(): Coupon[] {
  return read(COUPON_KEY, DEFAULT_COUPONS).map((c) => ({
    ...c,
    scopeValues: c.scopeValues || [],
    excludeValues: c.excludeValues || [],
    used: Number(c.used) || 0,
    revenue: Number(c.revenue) || 0,
  }));
}
export function saveCoupons(rows: Coupon[]) { localStorage.setItem(COUPON_KEY, JSON.stringify(rows)); }
export function loadTaxes(): TaxRule[] {
  return read(TAX_KEY, DEFAULT_TAXES).map((t) => ({
    ...t,
    names: t.names || { fr: t.name },
    labels: t.labels || { fr: t.name },
    scope: t.scope || (t.category ? 'category' : 'all'),
    scopeValues: t.scopeValues || (t.category ? [t.category] : []),
  }));
}
export function saveTaxes(rows: TaxRule[]) { localStorage.setItem(TAX_KEY, JSON.stringify(rows)); }
export function loadCouponUses() { return read(USE_KEY, DEFAULT_USES); }
export function saveCouponUses(rows: CouponUse[]) { localStorage.setItem(USE_KEY, JSON.stringify(rows)); }

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

export function taxCompletion(t: TaxRule) {
  const langs = ['fr', 'en', 'ar'];
  const done = langs.filter((l) => (t.names?.[l] || (l === 'fr' ? t.name : '')).trim()).length;
  return Math.round((done / langs.length) * 100);
}

export function formatIban(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

export function formatRib(raw: string) {
  return raw.replace(/[^\d]/g, '').replace(/(\d{3})(\d{5})(\d{11})(\d{2})/, '$1 $2 $3 $4');
}

export function isValidIban(raw?: string) {
  if (!raw) return true;
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(raw.replace(/\s/g, ''));
}
