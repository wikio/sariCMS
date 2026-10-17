import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';
import { CommerceItemPayload } from '../../orders/entities/order.entity';

/** Réponse commerciale : chiffrage détaillé ou document joint. */
export interface QuoteResponsePayload {
  mode: 'detailed' | 'file';
  fileUrl?: string;
  fileNote?: string;
  lines?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
  }>;
  subtotal?: number;
  discount?: number;
  taxTotal?: number;
  deliveryFee?: number;
  total?: number;
  sentAt?: string;
}

export interface QuoteEntity extends BaseEntity {
  reference?: string | null;
  /** Compte client rattaché (users.id). Null pour une demande invité. */
  userId?: number | null;
  client: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  date: Date | string;
  status: string;
  total: number;
  currency: string;
  validity?: string | null;
  items?: CommerceItemPayload[] | unknown;
  coupon?: string | null;
  /** Commande générée après acceptation du devis. */
  orderId?: number | null;
  zone?: string | null;
  ip?: string | null;
  history?: Array<{ status: string; at: string; note?: string }> | unknown;
  nature?: string | null;
  natureOther?: string | null;
  note?: string | null;
  desiredDate?: Date | string | null;
  address?: string | null;
  country?: string | null;
  attachments?: string[] | unknown;
  response?: QuoteResponsePayload | null | unknown;
}
