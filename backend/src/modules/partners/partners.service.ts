import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { PARTNER_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { PartnerEntity } from './entities/partner.entity';

@Injectable()
export class PartnersService extends BaseCrudService<PartnerEntity> {
  protected readonly repository: ICrudRepository<PartnerEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'partners',
    searchFields: ['name', 'category'],
    sortableFields: ['createdAt', 'updatedAt', 'name', 'sortOrder', 'category'],
    listFields: ['id', 'name', 'category', 'logo', 'status', 'locale', 'sortOrder'],
    cardFields: ['id', 'name', 'category', 'logo', 'status', 'locale'],
  };

  constructor(
    @Inject(PARTNER_REPOSITORY) repository: ICrudRepository<PartnerEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(dto: Partial<PartnerEntity>, op: 'create' | 'update'): Partial<PartnerEntity> {
    const out = { ...dto };
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
      if (out.sortOrder === undefined) out.sortOrder = 0;
    }
    return out;
  }
}
