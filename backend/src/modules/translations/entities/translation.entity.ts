import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface TranslationEntity extends BaseEntity {
  entityType: string;
  entityId: number;
  locale: string;
  field: string;
  value: string;
}
