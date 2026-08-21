import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { EVENT_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { EventEntity } from './entities/event.entity';

@Injectable()
export class EventsService extends BaseCrudService<EventEntity> {
  protected readonly repository: ICrudRepository<EventEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'events',
    searchFields: ['title', 'location', 'type', 'shortDesc'],
    sortableFields: ['date', 'createdAt', 'updatedAt', 'title'],
    listFields: ['id', 'slug', 'title', 'type', 'date', 'location', 'status'],
    cardFields: ['id', 'slug', 'title', 'type', 'date', 'location', 'shortDesc', 'image', 'status'],
  };

  constructor(
    @Inject(EVENT_REPOSITORY) repository: ICrudRepository<EventEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(dto: Partial<EventEntity>, op: 'create' | 'update'): Partial<EventEntity> {
    const out = { ...dto };
    if (!out.slug && out.title) out.slug = slugify(String(out.title));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
    }
    return out;
  }

  async upcoming(limit = 5) {
    return this.repository.findMany({
      page: 1,
      limit,
      sortBy: 'date',
      sortOrder: 'asc',
      filters: [{ field: 'status', value: 'published' }],
    });
  }

  async findPublished(idOrSlug: string, locale?: string) {
    const bySlug = await this.repository.findOne(locale ? { slug: idOrSlug, locale } : { slug: idOrSlug });
    const numericId = Number(idOrSlug);
    const entity = bySlug ?? (Number.isFinite(numericId) && /^\d+$/.test(String(idOrSlug)) ? await this.repository.findById(numericId) : null);
    if (!entity || entity.status !== 'published') return null;
    if (locale && entity.locale && entity.locale !== locale) return null;
    return this.toView(entity, 'block');
  }
}
