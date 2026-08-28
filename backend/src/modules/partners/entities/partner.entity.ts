import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface PartnerEntity extends BaseEntity {
  locale: string;
  slug: string;
  name: string;
  logo?: string | null;
  category?: string | null;
  website?: string | null;
  sortOrder: number;
  legacyId?: string | null;
  parentId?: number | null;
  isDefault?: boolean;
  status: string;
}
