import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface SolutionFaq {
  q: string;
  a: string;
}

export interface SolutionEntity extends BaseEntity {
  locale: string;
  /** Identifiant partagé par les versions FR/EN/AR d'une même solution. */
  legacyId?: string | null;
  slug: string;
  title: string;
  shortDesc?: string | null;
  fullDesc?: string | null;
  icon?: string | null;
  image?: string | null;
  color?: string | null;
  productIds?: Array<string | number> | unknown;
  features?: string[] | unknown;
  faq?: SolutionFaq[] | unknown;
  sortOrder: number;
  status: string;
}
