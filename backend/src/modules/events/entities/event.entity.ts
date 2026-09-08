import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface AgendaItem {
  time?: string;
  title: string;
  description?: string;
}

export interface EventEntity extends BaseEntity {
  locale: string;
  slug: string;
  title: string;
  type?: string | null;
  category?: string | null;
  targetAudience?: string | null;
  date?: Date | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  location?: string | null;
  shortDesc?: string | null;
  fullContent?: string | null;
  image?: string | null;
  agenda?: AgendaItem[] | string[] | unknown;
  status: string;
  publishedAt?: Date | string | null;
  legacyId?: string | null;
  parentId?: number | null;
  isDefault?: boolean;
}
