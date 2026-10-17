import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { HERO_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { HeroEntity } from './entities/hero.entity';

@Injectable()
export class HeroService extends BaseCrudService<HeroEntity> {
  protected readonly repository: ICrudRepository<HeroEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'hero',
    searchFields: ['title', 'subtitle', 'description', 'cta'],
    sortableFields: ['createdAt', 'updatedAt', 'sortOrder', 'title'],
    listFields: ['id', 'title', 'subtitle', 'image', 'status', 'locale', 'sortOrder'],
    cardFields: ['id', 'title', 'subtitle', 'description', 'image', 'cta', 'ctaLink', 'status'],
  };

  constructor(
    @Inject(HERO_REPOSITORY) repository: ICrudRepository<HeroEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(dto: Partial<HeroEntity>, op: 'create' | 'update'): Partial<HeroEntity> {
    const out = { ...dto };
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
      if (out.sortOrder === undefined) out.sortOrder = 0;
    }
    return out;
  }
}
