import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface TranslationEntity extends BaseEntity {
  entityType: string;
  entityId: string;
  locale: string;
  field: string;
  value: string;
}
