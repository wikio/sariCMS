import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { ROLE_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { RoleEntity } from './entities/role.entity';

@Injectable()
export class RolesService extends BaseCrudService<RoleEntity> {
  protected readonly repository: ICrudRepository<RoleEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'roles',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['name', 'slug', 'description'],
    sortableFields: ['name', 'slug', 'createdAt', 'updatedAt'],
    uniqueFields: ['slug'],
    listFields: ['id', 'name', 'slug', 'isSystem', 'createdAt'],
    cardFields: ['id', 'name', 'slug', 'description', 'isSystem', 'permissionIds', 'createdAt'],
  };

  constructor(
    @Inject(ROLE_REPOSITORY) repository: ICrudRepository<RoleEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }
}
