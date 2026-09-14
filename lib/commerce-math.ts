import type { CommerceItem } from '@/lib/crm-store';
import type { Coupon, TaxRule } from '@/lib/shop-store';
import type { ShopConfig } from '@/types';
import { defaultCurrency } from '@/lib/currencies';

export interface TaxLine {
  id: string;
  name: string;
  amount: number;
  included: boolean;
  rate: number;
  mode: 'percent' | 'fixed';
}

export interface CommerceTotals {
  subtotal: number; // somme prix*qty avant remises
  discount: number; // somme remises produit + globale + coupon
  productDiscount: number;
  globalDiscount: number;
  couponDiscount: number;
  shipping: number; // frais livraison total (produit + zone)
  productShipping: number;
  globalShipping: number;
  taxLines: TaxLine[];
  taxTotal: number;
  total: number; // taxable + shipping + taxes non incluses
}

// Remise par ligne : fixe (par unité) ou % ; legacy discount = %
export function lineDiscountAmount(item: CommerceItem): number {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  const base = qty * price;
  if (base <= 0) return 0;
  if (typeof item.discountValue === 'number' && item.discountType) {
    if (item.discountType === 'fixed') return Math.min(item.discountValue * qty, base);
    return base * (item.discountValue / 100);
  }
  const pct = Number(item.discount || 0);
  if (pct) return base * (pct / 100);
  return 0;
}

export function lineNet(item: CommerceItem) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  const base = qty * price;
  return Math.max(0, base - lineDiscountAmount(item));
}

export function lineShipping(item: CommerceItem): number {
  if (item.shippingType === 'free') return 0;
  const fee = Number(item.shippingFee || 0);
  if (!fee) return 0;
  const qty = Number(item.quantity) || 0;
  if (item.shippingType === 'per_qty') return fee * qty;
  return fee; // fixed par ligne
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

function globalDiscountAmount(subtotalAfterProductDiscount: number, cfg?: ShopConfig | null): number {
  if (!cfg?.globalDiscount?.active) return 0;
  const g = cfg.globalDiscount;
  if (g.minOrder && subtotalAfterProductDiscount < g.minOrder) return 0;
  if (g.type === 'percent') {
    const raw = subtotalAfterProductDiscount * (g.value / 100);
    return g.maxDiscount ? Math.min(raw, g.maxDiscount) : raw;
  }
  return Math.min(g.value, subtotalAfterProductDiscount);
}

function globalShippingFee(totalQty: number, subtotalAfterDiscounts: number, zone: string | undefined, cfg?: ShopConfig | null): number {
  if (!cfg) return 0;
  const s = cfg.shipping;
  // franco global prioritaire
  if (s.freeThreshold && subtotalAfterDiscounts >= s.freeThreshold) return 0;
  if (s.mode === 'by_zone' && zone) {
    const zf = s.zoneFees.find(f => f.zone === zone) || s.zoneFees.find(f => f.zone === 'DZ-ALL') || null;
    if (zf) {
      if (zf.freeFrom && subtotalAfterDiscounts >= zf.freeFrom) return 0;
      const perQty = (zf.perQty || 0) * Math.max(0, totalQty - 1);
      return (zf.fee || 0) + perQty;
    }
  }
  if (s.mode === 'per_qty') {
    return s.defaultFee + s.perQtyFee * Math.max(0, totalQty - 1);
  }
  if (s.mode === 'weight') {
    // poids non renseigné → fallback default
    return s.defaultFee;
  }
  return s.defaultFee;
}

function productVatLines(items: CommerceItem[], taxableBaseByItem: Map<string, number>): TaxLine[] {
  const lines: TaxLine[] = [];
  for (const it of items) {
    const rate = typeof it.vatRate === 'number' ? it.vatRate : (typeof it.taxRate === 'number' ? it.taxRate : undefined);
    if (rate === undefined || rate <= 0) continue;
    const base = taxableBaseByItem.get(String(it.id)) ?? lineNet(it);
    const amount = base * (rate / 100);
    lines.push({
      id: `vat-${it.id}`,
      name: `TVA ${rate}% · ${it.name}`,
      included: !!it.vatIncluded,
      rate,
      mode: 'percent',
      amount,
    });
  }
  return lines;
}

export function computeTotals(
  items: CommerceItem[],
  taxes: TaxRule[] = [],
  coupon?: Coupon | null,
  opts: { category?: string; zone?: string; shopConfig?: ShopConfig | null } = {},
): CommerceTotals {
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const productDiscount = items.reduce((s, it) => s + lineDiscountAmount(it), 0);
  const afterProductDiscount = Math.max(0, subtotal - productDiscount);
  const globalDiscount = globalDiscountAmount(afterProductDiscount, opts.shopConfig || null);
  const afterGlobal = Math.max(0, afterProductDiscount - globalDiscount);
  const couponDiscount = applyCoupon(afterGlobal, coupon);
  const discount = productDiscount + globalDiscount + couponDiscount;
  const taxable = Math.max(0, subtotal - discount);

  // --- Taxes : TVA produit prioritaire + taxes globales (si pas de TVA produit, on garde les globales)
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  // Répartition du taxable au prorata des lignes nettes pour les VAT produit
  const sumNet = items.reduce((s, it) => s + lineNet(it), 0) || 1;
  const taxableByItem = new Map<string, number>();
  for (const it of items) {
    const net = lineNet(it);
    // part du taxable proportionnelle au net (après remises globales/coupon réparties)
    const share = sumNet ? (net / sumNet) : 0;
    taxableByItem.set(String(it.id), taxable * share);
  }
  const vatLines = productVatLines(items, taxableByItem);
  // Taxes globales : on les applique seulement si l'item n'a pas déjà une TVA produit définie ?
  // Pour garder la flexibilité, on applique les taxes globales sur le taxable, et on additionne.
  // Si un produit a une vatRate, ses VAT s'ajoutent aux taxes globales (évite 0 taxe quand TVA produit=0).
  const globalTaxLines = applyTaxes(taxable, taxes, opts.category, opts.zone);
  // Si au moins un produit a vatRate explicite, on pourrait filtrer les taxes globales "all" pour éviter double TVA,
  // mais on garde les deux pour l'instant : l'admin choisit via le scope (category/product).
  const taxLines = [...vatLines, ...globalTaxLines];
  const added = taxLines.filter(t => !t.included).reduce((s, t) => s + t.amount, 0);
  const included = taxLines.filter(t => t.included).reduce((s, t) => s + t.amount, 0);

  // --- Livraison
  const productShipping = items.reduce((s, it) => s + lineShipping(it), 0);
  const globalShipping = globalShippingFee(totalQty, taxable, opts.zone, opts.shopConfig || null);
  const shipping = productShipping + globalShipping;

  return {
    subtotal,
    discount,
    productDiscount,
    globalDiscount,
    couponDiscount,
    shipping,
    productShipping,
    globalShipping,
    taxLines,
    taxTotal: added + included,
    total: taxable + added + shipping,
  };
}

/**
 * Formate un montant avec la devise configurée dans l'administration.
 *
 * Le suffixe reste surchargeable pour les rares appels qui imposent une
 * devise précise ; sans argument, on suit le réglage de la page Devises au
 * lieu du dinar codé en dur.
 */
export function money(n: number, suffix?: string) {
  const symbol = suffix ?? defaultCurrency().symbol;
  return `${Math.round(n).toLocaleString('fr-DZ')} ${symbol}`;
}
