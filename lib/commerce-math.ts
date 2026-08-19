import type { CommerceItem } from '@/lib/crm-store';
import type { Coupon, TaxRule } from '@/lib/shop-store';

export interface TaxLine {
  id: string;
  name: string;
  amount: number;
  included: boolean;
  rate: number;
  mode: 'percent' | 'fixed';
}

export interface CommerceTotals {
  subtotal: number;
  discount: number;
  taxLines: TaxLine[];
  taxTotal: number;
  total: number;
}

export function lineNet(item: CommerceItem) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  const disc = Number(item.discount || 0);
  return qty * price * (1 - disc / 100);
}

export function applyCoupon(subtotal: number, coupon?: Coupon | null) {
  if (!coupon) return 0;
  if (coupon.type === 'percent') {
    const raw = subtotal * (coupon.amount / 100);
    return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  }
  return Math.min(coupon.amount, subtotal);
}

export function applyTaxes(base: number, taxes: TaxRule[], category?: string, zone?: string): TaxLine[] {
  return taxes
    .filter((t) => t.active)
    .filter((t) => !t.zone || !zone || t.zone === zone || t.zone === 'ALL')
    .filter((t) => {
      if (t.scope === 'category' && t.scopeValues?.length) {
        return category ? t.scopeValues.includes(category) : false;
      }
      if (t.scope === 'product') return true;
      if (t.category && category && t.category !== category) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .map((t) => ({
      id: t.id,
      name: t.name,
      included: t.included,
      rate: t.rate,
      mode: t.mode,
      amount: t.mode === 'percent' ? base * (t.rate / 100) : t.rate,
    }));
}

export function computeTotals(
  items: CommerceItem[],
  taxes: TaxRule[] = [],
  coupon?: Coupon | null,
  opts: { category?: string; zone?: string } = {},
): CommerceTotals {
  const subtotal = items.reduce((s, it) => s + lineNet(it), 0);
  const discount = applyCoupon(subtotal, coupon);
  const taxable = Math.max(0, subtotal - discount);
  const taxLines = applyTaxes(taxable, taxes, opts.category, opts.zone);
  const added = taxLines.filter((t) => !t.included).reduce((s, t) => s + t.amount, 0);
  const included = taxLines.filter((t) => t.included).reduce((s, t) => s + t.amount, 0);
  return {
    subtotal,
    discount,
    taxLines,
    taxTotal: added + included,
    total: taxable + added,
  };
}

export function money(n: number, suffix = 'DA') {
  return `${Math.round(n).toLocaleString('fr-DZ')} ${suffix}`;
}
