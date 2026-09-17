import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

/** Ligne de commande / de devis (produit, quantité, remise, taxe). */
export interface CommerceItemPayload {
  id?: number | string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  category?: string;
  unit?: string;
  description?: string;
  attachment?: string;
  taxRate?: number;
  // Champs enrichis (édition admin directe)
  discountValue?: number;
  discountType?: 'fixed' | 'percent';
  vatRate?: number;
  vatIncluded?: boolean;
  shippingFee?: number;
  shippingType?: 'fixed' | 'per_qty' | 'free';
  zones?: string[];
  image?: string;
}

/** Facture liée : upload manuel ou retour ERP. */
export interface OrderInvoicePayload {
  number: string;
  url?: string;
  fileName?: string;
  source: 'manual' | 'api';
  linkedAt?: string;
}

export interface OrderEntity extends BaseEntity {
  code?: string | null;
  /** Compte client rattaché (users.id). Null pour une commande invité. */
  userId?: number | null;
  client: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  date: Date | string;
  status: string;
  total: number;
  cost?: number | null;
  currency: string;
  items?: CommerceItemPayload[] | unknown;
  address?: string | null;
  payment?: string | null;
  paid: boolean;
  coupon?: string | null;
  quoteId?: number | null;
  zone?: string | null;
  ip?: string | null;
  history?: Array<{ status: string; at: string; note?: string }> | unknown;
  invoice?: OrderInvoicePayload | null | unknown;
  // Détail montants (persistés pour vitrine/PDF instantanés)
  subtotal?: number | null;
  discountTotal?: number | null;
  productDiscount?: number | null;
  globalDiscount?: number | null;
  couponDiscount?: number | null;
  shippingFee?: number | null;
  productShipping?: number | null;
  globalShipping?: number | null;
  taxTotal?: number | null;
  taxLines?: unknown;
  deliveryZone?: string | null;
  saleZone?: string | null;
  deliveryAddress?: string | null;
  country?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
}
