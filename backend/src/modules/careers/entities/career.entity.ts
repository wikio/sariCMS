import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface CareerEntity extends BaseEntity {
  locale: string;
  slug: string;
  title: string;
  type?: string | null;
  location?: string | null;
  salary?: string | null;
  shortDesc?: string | null;
  fullDesc?: string | null;
  image?: string | null;
  typeTravail?: string | null;
  mission?: string | null;
  objectifs?: string[] | unknown;
  prerequis?: string[] | unknown;
  experience?: string | null;
  workflow?: string[] | unknown;
  benefits?: string[] | unknown;
  contact?: string | null;
  legacyId?: number | null;
  status: string;
  publishedAt?: Date | string | null;
}
