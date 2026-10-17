import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { MENU_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { MenuEntity } from './entities/menu.entity';

@Injectable()
export class MenusService extends BaseCrudService<MenuEntity> {
  protected readonly repository: ICrudRepository<MenuEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'menus',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['name', 'location'],
    sortableFields: ['location', 'name', 'updatedAt'],
    listFields: ['id', 'name', 'location', 'locale', 'status', 'updatedAt'],
    cardFields: ['id', 'name', 'location', 'locale', 'status', 'items', 'updatedAt'],
  };

  constructor(
    @Inject(MENU_REPOSITORY) repository: ICrudRepository<MenuEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  async findByLocation(location: string, locale = 'fr') {
    return this.repository.findOne({ location, locale });
  }
}
