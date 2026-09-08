import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface ProductOption {
  name: string;
  choices: string[];
}

export interface ProductEntity extends BaseEntity {
  locale: string;
  slug: string;
  name: string;
  category?: string | null;
  sku?: string | null;
  price?: string | null;
  shortDesc?: string | null;
  fullDesc?: string | null;
  image?: string | null;
  gallery?: string[] | unknown;
  inStock: boolean;
  stockQty?: number | null;
  stockFinal?: boolean | null;
  currency?: string | null;
  deliveryTime?: string | null;
  features?: string[] | unknown;
  specs?: Record<string, string> | unknown;
  options?: ProductOption[] | unknown;
  catalogPdf?: string | null;
  status: string;
  publishedAt?: Date | string | null;
}
