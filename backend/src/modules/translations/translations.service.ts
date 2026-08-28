import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { TRANSLATION_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { TranslationEntity } from './entities/translation.entity';

@Injectable()
export class TranslationsService extends BaseCrudService<TranslationEntity> {
  protected readonly repository: ICrudRepository<TranslationEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'translations',
    searchFields: ['entityType', 'field', 'value', 'locale'],
    sortableFields: ['entityType', 'locale', 'field', 'updatedAt'],
    listFields: ['id', 'entityType', 'entityId', 'locale', 'field', 'updatedAt'],
    cardFields: ['id', 'entityType', 'entityId', 'locale', 'field', 'value', 'updatedAt'],
  };

  constructor(
    @Inject(TRANSLATION_REPOSITORY) repository: ICrudRepository<TranslationEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  async forEntity(entityType: string, entityId: number) {
    return this.repository.findMany({
      page: 1,
      limit: 100,
      filters: [
        { field: 'entityType', value: entityType },
        { field: 'entityId', value: entityId },
      ],
    });
  }
}
