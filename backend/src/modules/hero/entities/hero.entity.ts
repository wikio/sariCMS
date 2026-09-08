import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface HeroEntity extends BaseEntity {
  locale: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  cta?: string | null;
  ctaLink?: string | null;
  sortOrder: number;
  legacyId?: number | null;
  status: string;
}
