// lib/shop-config.ts — Configuration globale boutique (frais, remises, zones, CGV, import API)
import type { ShopConfig, SaleZone, ShippingZoneFee } from '@/types';
export type { ShopConfig, SaleZone, ShippingZoneFee } from '@/types';

const KEY = 'sari_shop_config';

export const DEFAULT_ZONES: SaleZone[] = [
  { code: 'DZ-16', label: 'Alger', wilaya: 'Alger', active: true, deliveryDays: '24-48h', codAllowed: true },
  { code: 'DZ-31', label: 'Oran', wilaya: 'Oran', active: true, deliveryDays: '48-72h', codAllowed: true },
  { code: 'DZ-25', label: 'Constantine', wilaya: 'Constantine', active: true, deliveryDays: '48-72h', codAllowed: true },
  { code: 'DZ-09', label: 'Blida', wilaya: 'Blida', active: true, deliveryDays: '24-48h', codAllowed: true },
  { code: 'DZ-15', label: 'Tizi Ouzou', wilaya: 'Tizi Ouzou', active: true, deliveryDays: '48-72h', codAllowed: false },
  { code: 'DZ-06', label: 'Béjaïa', wilaya: 'Béjaïa', active: true, deliveryDays: '72h', codAllowed: true },
  { code: 'DZ-ALL', label: 'Toutes wilayas (défaut)', active: true, deliveryDays: '3-5j', codAllowed: false },
  // Hors Algérie — livraison internationale (désactivée par défaut, activez dans Config. boutique)
  { code: 'INT-TN', label: 'Tunisie', wilaya: 'Tunisie', active: false, deliveryDays: '5-7j', codAllowed: false },
  { code: 'INT-MA', label: 'Maroc', wilaya: 'Maroc', active: false, deliveryDays: '5-7j', codAllowed: false },
  { code: 'INT-FR', label: 'France', wilaya: 'France', active: false, deliveryDays: '7-10j', codAllowed: false },
  { code: 'INT-EU', label: 'Europe (UE)', wilaya: 'Europe', active: false, deliveryDays: '7-12j', codAllowed: false },
  { code: 'INT-WORLD', label: 'International (monde)', wilaya: 'Monde', active: false, deliveryDays: '10-15j', codAllowed: false },
];

const DEFAULT_SHIPPING_ZONE_FEES: ShippingZoneFee[] = [
  { zone: 'DZ-16', label: 'Alger', fee: 400, perQty: 50, freeFrom: 20000 },
  { zone: 'DZ-09', label: 'Blida', fee: 500, perQty: 50, freeFrom: 25000 },
  { zone: 'DZ-31', label: 'Oran', fee: 700, perQty: 100, freeFrom: 30000 },
  { zone: 'DZ-ALL', label: 'Autres wilayas', fee: 900, perQty: 100, freeFrom: 40000 },
  // Hors Algérie
  { zone: 'INT-TN', label: 'Tunisie', fee: 2500, perQty: 200, freeFrom: 60000 },
  { zone: 'INT-MA', label: 'Maroc', fee: 2800, perQty: 200, freeFrom: 60000 },
  { zone: 'INT-FR', label: 'France', fee: 3500, perQty: 300, freeFrom: 80000 },
  { zone: 'INT-EU', label: 'Europe', fee: 4000, perQty: 300 },
  { zone: 'INT-WORLD', label: 'International', fee: 5000, perQty: 400 },
];

export const DEFAULT_SHOP_CONFIG: ShopConfig = {
  currency: 'DZD',
  shipping: {
    mode: 'by_zone',
    defaultFee: 600,
    perQtyFee: 0,
    perKgFee: 0,
    freeThreshold: 50000,
    zoneFees: DEFAULT_SHIPPING_ZONE_FEES,
  },
  globalDiscount: {
    active: false,
    type: 'percent',
    value: 5,
    minOrder: 30000,
    maxDiscount: 10000,
  },
  saleConditions: `Conditions de vente SARI Système :\n- Prix en DZD, TVA incluse selon le produit (19% standard, 9% consommables) sauf mention.\n- Devis valable 30 jours, transformable en commande.\n- Paiement : CIB, virement, COD (selon zone). Facture liée après paiement.\n- Retours : 7 jours pour produits non ouverts, hors consommables à usage unique.\n- Garantie : 12 mois pièces, hors consommables.`,
  deliveryNotes: `Livraison : 24-72h selon wilaya (voir zones disponibles). Frais offerts au-delà du seuil franco par zone. Suivi par SMS. COD possible uniquement pour les zones marquées.`,
  saleZones: DEFAULT_ZONES.map(z => ({ ...z })),
  deliveryZones: DEFAULT_ZONES.map(z => ({ ...z })),
  importApi: {
    enabled: false,
    url: '',
    authHeader: 'X-API-Key',
    apiKey: '',
    csvUrl: '',
    mapping: {
      name: 'name',
      price: 'price',
      category: 'category',
      sku: 'sku',
      stockQty: 'stock',
      vatRate: 'tva',
      shippingFee: 'livraison',
      discountValue: 'remise',
    },
    batchValidation: true,
  },
};

export function loadShopConfig(): ShopConfig {
  if (typeof window === 'undefined') return DEFAULT_SHOP_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SHOP_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SHOP_CONFIG,
      ...parsed,
      shipping: {
        ...DEFAULT_SHOP_CONFIG.shipping,
        ...(parsed.shipping || {}),
        zoneFees: Array.isArray(parsed.shipping?.zoneFees) ? parsed.shipping.zoneFees : DEFAULT_SHOP_CONFIG.shipping.zoneFees,
      },
      globalDiscount: { ...DEFAULT_SHOP_CONFIG.globalDiscount, ...(parsed.globalDiscount || {}) },
      saleZones: Array.isArray(parsed.saleZones) ? parsed.saleZones : DEFAULT_SHOP_CONFIG.saleZones,
      deliveryZones: Array.isArray(parsed.deliveryZones) ? parsed.deliveryZones : DEFAULT_SHOP_CONFIG.deliveryZones,
      importApi: { ...DEFAULT_SHOP_CONFIG.importApi, ...(parsed.importApi || {}) },
    };
  } catch {
    return DEFAULT_SHOP_CONFIG;
  }
}

export function saveShopConfig(next: ShopConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(next));
  // notifier les onglets / composants
  window.dispatchEvent(new Event('sari-shop-config-changed'));
}

export function getShippingFeeForZone(zoneCode: string | undefined, qty: number, subtotal: number): number {
  const cfg = loadShopConfig();
  const { shipping } = cfg;
  // franco global
  if (shipping.freeThreshold && subtotal >= shipping.freeThreshold) return 0;
  if (shipping.mode === 'by_zone' && zoneCode) {
    const z = shipping.zoneFees.find(f => f.zone === zoneCode) || shipping.zoneFees.find(f => f.zone === 'DZ-ALL');
    if (z) {
      if (z.freeFrom && subtotal >= z.freeFrom) return 0;
      const perQty = (z.perQty || 0) * Math.max(0, qty - 1);
      return (z.fee || 0) + perQty;
    }
  }
  if (shipping.mode === 'per_qty') {
    return shipping.defaultFee + shipping.perQtyFee * Math.max(0, qty - 1);
  }
  // fixed + weight
  const weightFee = shipping.perKgFee ? 0 : 0; // TODO: poids produit si renseigné
  return shipping.defaultFee + weightFee;
}

export function isZoneAvailableForProduct(product: { zones?: string[] }, zoneCode: string | undefined, globalZones: SaleZone[]): boolean {
  if (!zoneCode) return true; // pas de filtre si zone non choisie
  // produit restreint ?
  if (Array.isArray(product.zones) && product.zones.length > 0) {
    return product.zones.includes(zoneCode) || product.zones.includes('ALL') || product.zones.includes('DZ-ALL');
  }
  // sinon global
  const gz = globalZones.find(z => z.code === zoneCode);
  return gz ? gz.active : true;
}

export function formatZoneLabel(code: string): string {
  const cfg = loadShopConfig();
  const z = [...cfg.saleZones, ...cfg.deliveryZones].find(x => x.code === code);
  return z ? `${z.label} (${z.code})` : code;
}
