import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditLogEntity, AuditService } from '../../common/audit/audit.service';
import { AUDIT_LOG_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';

@Injectable()
export class AuditLogsService extends BaseCrudService<AuditLogEntity> {
  protected readonly repository: ICrudRepository<AuditLogEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'audit',
    searchFields: ['action', 'resource', 'resourceId', 'actorId'],
    sortableFields: ['createdAt', 'action', 'resource'],
    listFields: ['id', 'action', 'resource', 'resourceId', 'actorId', 'createdAt'],
    cardFields: ['id', 'action', 'resource', 'resourceId', 'actorId', 'ip', 'payload', 'createdAt'],
  };

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) repository: ICrudRepository<AuditLogEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  async recent(limit = 20) {
    return this.repository.findMany({
      page: 1,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }
}
