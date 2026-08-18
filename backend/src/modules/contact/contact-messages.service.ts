import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { CONTACT_MESSAGE_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ContactMessageEntity } from './entities/contact.entity';

@Injectable()
export class ContactMessagesService extends BaseCrudService<ContactMessageEntity> {
  protected readonly repository: ICrudRepository<ContactMessageEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'contact',
    searchFields: ['name', 'email', 'subject', 'message'],
    sortableFields: ['createdAt', 'status', 'name'],
    listFields: ['id', 'name', 'email', 'subject', 'status', 'createdAt'],
    cardFields: ['id', 'name', 'email', 'phone', 'subject', 'message', 'status', 'createdAt'],
  };

  constructor(
    @Inject(CONTACT_MESSAGE_REPOSITORY) repository: ICrudRepository<ContactMessageEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<ContactMessageEntity>,
    op: 'create' | 'update',
  ): Partial<ContactMessageEntity> {
    const out = { ...dto };
    if (op === 'create') out.status = out.status || 'new';
    return out;
  }
}
