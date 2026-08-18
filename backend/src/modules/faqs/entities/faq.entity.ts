import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface FaqEntity extends BaseEntity {
  locale: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder?: number;
  status: string;
}
