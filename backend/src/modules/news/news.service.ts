import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { NEWS_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { NewsEntity } from './entities/news.entity';

@Injectable()
export class NewsService extends BaseCrudService<NewsEntity> {
  protected readonly repository: ICrudRepository<NewsEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'news',
    searchFields: ['title', 'shortDesc', 'category', 'authorName', 'sujet'],
    sortableFields: ['createdAt', 'updatedAt', 'date', 'publicationDate', 'title', 'publishedAt'],
    listFields: ['id', 'slug', 'title', 'category', 'authorName', 'date', 'publicationDate', 'status', 'locale'],
    cardFields: [
      'id',
      'slug',
      'title',
      'shortDesc',
      'image',
      'category',
      'authorName',
      'date',
      'publicationDate',
      'readTime',
      'status',
    ],
  };

  constructor(
    @Inject(NEWS_REPOSITORY) repository: ICrudRepository<NewsEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<NewsEntity>,
    op: 'create' | 'update',
    existing?: NewsEntity,
  ): Partial<NewsEntity> {
    console.log('[NewsService.beforeSave] Input DTO:', JSON.stringify(dto, null, 2));
    
    const out = { ...dto };
    if (!out.slug && out.title) out.slug = slugify(String(out.title));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
    }
    
    // Synchroniser publicationDate et date
    // publicationDate est le champ principal (ISO-8601)
    // date est gardé pour rétrocompatibilité
    if (out.publicationDate && !out.date) {
      out.date = out.publicationDate;
    } else if (out.date && !out.publicationDate) {
      out.publicationDate = out.date;
    }
    
    if (out.status === 'published' && !out.publishedAt && !existing?.publishedAt) {
      out.publishedAt = new Date().toISOString();
      out.date = out.date || out.publishedAt;
      out.publicationDate = out.publicationDate || out.publishedAt;
    }
    
    console.log('[NewsService.beforeSave] Output DTO:', JSON.stringify(out, null, 2));
    return out;
  }

  async statsByAuthor(authorId: string) {
    const published = await this.repository.count({ authorId, status: 'published' });
    const drafts = await this.repository.count({ authorId, status: 'draft' });
    return { authorId, published, drafts, total: published + drafts };
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
