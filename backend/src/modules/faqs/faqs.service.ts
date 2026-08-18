import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { FAQ_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { FaqEntity } from './entities/faq.entity';

@Injectable()
export class FaqsService extends BaseCrudService<FaqEntity> {
  protected readonly repository: ICrudRepository<FaqEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'faqs',
    searchFields: ['question', 'answer', 'category'],
    sortableFields: ['sortOrder', 'createdAt', 'updatedAt', 'category'],
    listFields: ['id', 'question', 'category', 'locale', 'status', 'sortOrder'],
    cardFields: ['id', 'question', 'answer', 'category', 'locale', 'status', 'sortOrder'],
  };

  constructor(
    @Inject(FAQ_REPOSITORY) repository: ICrudRepository<FaqEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }
}
