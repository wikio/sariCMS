import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { APPLICATION_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ApplicationEntity } from './entities/application.entity';

@Injectable()
export class ApplicationsService extends BaseCrudService<ApplicationEntity> {
  protected readonly repository: ICrudRepository<ApplicationEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'applications',
    searchFields: ['reference', 'candidate', 'email', 'jobTitle', 'phone'],
    sortableFields: ['createdAt', 'updatedAt', 'date', 'status', 'score', 'rating'],
    listFields: ['id', 'reference', 'candidate', 'email', 'jobTitle', 'date', 'status', 'score', 'rating', 'userId', 'careerId'],
    cardFields: ['id', 'reference', 'candidate', 'email', 'jobTitle', 'date', 'status', 'score'],
  };

  constructor(
    @Inject(APPLICATION_REPOSITORY) repository: ICrudRepository<ApplicationEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<ApplicationEntity>,
    op: 'create' | 'update',
    existing?: ApplicationEntity,
  ): Partial<ApplicationEntity> {
    const out = { ...dto };
    if (op === 'create') {
      out.status = out.status || 'new';
      if (!out.date) out.date = new Date().toISOString();
    }
    if (typeof out.email === 'string') out.email = out.email.toLowerCase().trim();

    if (op === 'update' && out.status && existing && out.status !== existing.status) {
      const history = Array.isArray(existing.history) ? [...(existing.history as unknown[])] : [];
      history.push({ status: out.status, at: new Date().toISOString() });
      out.history = history;
    }
    return out;
  }
}
