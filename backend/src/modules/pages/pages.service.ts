import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { PAGE_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { PageEntity } from './entities/page.entity';

@Injectable()
export class PagesService extends BaseCrudService<PageEntity> {
  protected readonly repository: ICrudRepository<PageEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'pages',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['title', 'slug', 'subtitle', 'category', 'content'],
    sortableFields: ['createdAt', 'updatedAt', 'title', 'sortOrder', 'publishedAt', 'kind'],
    listFields: ['id', 'slug', 'locale', 'kind', 'subtype', 'title', 'status', 'updatedAt'],
    cardFields: [
      'id',
      'slug',
      'locale',
      'kind',
      'subtype',
      'title',
      'subtitle',
      'category',
      'media',
      'status',
      'updatedAt',
    ],
  };

  constructor(
    @Inject(PAGE_REPOSITORY) repository: ICrudRepository<PageEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<PageEntity>,
    op: 'create' | 'update',
    existing?: PageEntity,
  ): Partial<PageEntity> {
    const out = { ...dto };
    if (!out.slug && out.title) out.slug = slugify(String(out.title));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.subtype = out.subtype || 'simple';
      out.status = out.status || 'draft';
    }
    if (out.status === 'published' && !out.publishedAt && !existing?.publishedAt) {
      out.publishedAt = new Date().toISOString();
    }
    return out;
  }

  async findPublishedBySlug(slug: string, locale = 'fr') {
    const page = await this.repository.findOne({ slug, locale });
    if (!page || page.status !== 'published') return null;
    return this.toView(page, 'block');
  }
}
