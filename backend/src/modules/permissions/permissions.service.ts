import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { PERMISSION_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { PermissionEntity } from '../roles/entities/role.entity';

@Injectable()
export class PermissionsService extends BaseCrudService<PermissionEntity> {
  protected readonly repository: ICrudRepository<PermissionEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'permissions',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['resource', 'action', 'description'],
    sortableFields: ['resource', 'action', 'createdAt'],
    listFields: ['id', 'resource', 'action', 'description'],
    cardFields: ['id', 'resource', 'action', 'description', 'createdAt'],
  };

  constructor(
    @Inject(PERMISSION_REPOSITORY) repository: ICrudRepository<PermissionEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }
}
