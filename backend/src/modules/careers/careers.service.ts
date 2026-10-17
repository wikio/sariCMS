import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { CAREER_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { CareerEntity } from './entities/career.entity';

@Injectable()
export class CareersService extends BaseCrudService<CareerEntity> {
  protected readonly repository: ICrudRepository<CareerEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'careers',
    searchFields: ['title', 'location', 'type', 'shortDesc', 'mission'],
    sortableFields: ['createdAt', 'updatedAt', 'title', 'publishedAt'],
    listFields: ['id', 'slug', 'title', 'type', 'location', 'salary', 'status', 'locale'],
    cardFields: ['id', 'slug', 'title', 'type', 'location', 'salary', 'shortDesc', 'image', 'status'],
  };

  constructor(
    @Inject(CAREER_REPOSITORY) repository: ICrudRepository<CareerEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<CareerEntity>,
    op: 'create' | 'update',
    existing?: CareerEntity,
  ): Partial<CareerEntity> {
    const out = { ...dto };
    if (!out.slug && out.title) out.slug = slugify(String(out.title));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
    }
    if (out.status === 'published' && !out.publishedAt && !existing?.publishedAt) {
      out.publishedAt = new Date().toISOString();
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
