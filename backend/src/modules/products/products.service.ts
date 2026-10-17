import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { PRODUCT_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { ProductEntity } from './entities/product.entity';

@Injectable()
export class ProductsService extends BaseCrudService<ProductEntity> {
  protected readonly repository: ICrudRepository<ProductEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'products',
    searchFields: ['name', 'shortDesc', 'category', 'sku'],
    sortableFields: ['createdAt', 'updatedAt', 'name', 'category', 'price'],
    listFields: ['id', 'slug', 'name', 'category', 'price', 'inStock', 'status'],
    cardFields: [
      'id',
      'slug',
      'name',
      'category',
      'price',
      'shortDesc',
      'image',
      'inStock',
      'status',
    ],
  };

  constructor(
    @Inject(PRODUCT_REPOSITORY) repository: ICrudRepository<ProductEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<ProductEntity>,
    op: 'create' | 'update',
  ): Partial<ProductEntity> {
    const out = { ...dto };
    if (out.slug === '') delete out.slug;
    if (!out.slug && out.name) out.slug = slugify(String(out.name));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
      if (out.inStock === undefined) out.inStock = true;
      if (!out.sku) {
        const stamp = Date.now().toString().slice(-5);
        out.sku = `PRO-${stamp}`;
      }
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
