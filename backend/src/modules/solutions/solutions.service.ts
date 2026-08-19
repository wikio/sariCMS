import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { SOLUTION_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { SolutionEntity } from './entities/solution.entity';

@Injectable()
export class SolutionsService extends BaseCrudService<SolutionEntity> {
  protected readonly repository: ICrudRepository<SolutionEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'solutions',
    searchFields: ['title', 'shortDesc', 'slug'],
    sortableFields: ['createdAt', 'updatedAt', 'title', 'sortOrder'],
    listFields: ['id', 'slug', 'title', 'icon', 'color', 'status', 'locale'],
    cardFields: ['id', 'slug', 'title', 'shortDesc', 'icon', 'image', 'color', 'status'],
  };

  constructor(
    @Inject(SOLUTION_REPOSITORY) repository: ICrudRepository<SolutionEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(dto: Partial<SolutionEntity>, op: 'create' | 'update'): Partial<SolutionEntity> {
    const out = { ...dto };
    if (!out.slug && out.title) out.slug = slugify(String(out.title));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
      if (out.sortOrder === undefined) out.sortOrder = 0;
    }
    return out;
  }

  async findPublished(idOrSlug: string, locale?: string) {
    const bySlug = await this.repository.findOne(locale ? { slug: idOrSlug, locale } : { slug: idOrSlug });
    const entity = bySlug ?? (await this.repository.findById(idOrSlug));
    if (!entity || entity.status !== 'published') return null;
    if (locale && entity.locale && entity.locale !== locale) return null;
    return this.toView(entity, 'block');
  }
}
