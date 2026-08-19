import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface ServiceFaq {
  q: string;
  a: string;
}

export interface ServiceEntity extends BaseEntity {
  locale: string;
  slug: string;
  title: string;
  icon?: string | null;
  shortDesc?: string | null;
  fullDesc?: string | null;
  features?: string[] | unknown;
  faq?: ServiceFaq[] | unknown;
  sortOrder: number;
  legacyId?: number | null;
  status: string;
}
