import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

/**
 * Ligne de la table `tax_rules`.
 *
 * Vient du `localStorage` (`lib/shop-store.ts`, clé `sari_taxes`). `names` et
 * `labels` portent les libellés traduits — le site vitrine et les factures PDF
 * en arabe lisent `labels.ar`.
 */
export interface TaxRuleEntity extends BaseEntity {
  name: string;
  names?: unknown;
  labels?: unknown;
  mode: string;
  rate: number;
  zone?: string;
  category?: string | null;
  scope?: string;
  scopeValues?: unknown;
  included?: boolean;
  priority?: number;
  active?: boolean;
  isDefault?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}
