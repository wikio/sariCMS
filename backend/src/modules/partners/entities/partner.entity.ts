import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface PartnerEntity extends BaseEntity {
  locale: string;
  name: string;
  logo?: string | null;
  category?: string | null;
  website?: string | null;
  sortOrder: number;
  legacyId?: number | null;
  status: string;
}
