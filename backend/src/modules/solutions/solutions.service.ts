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
      // Chaque solution reçoit un legacyId : c'est la clé qui relie les
      // versions FR/EN/AR entre elles. Fournir explicitement le legacyId d'une
      // fiche existante crée sa traduction ; sinon on démarre un nouveau groupe.
      if (!out.legacyId) out.legacyId = `sol-${Date.now().toString(36)}`;
    }
    return out;
  }

  /**
   * Renvoie les versions traduites d'une solution (même `legacyId`),
   * indexées par langue. Utilisé par le sélecteur de langue de la vitrine
   * pour construire l'URL équivalente : `fr/solutions/1-slug-fr`
   * → `ar/solutions/12-slug-ar`.
   */
  async findTranslations(idOrSlug: string) {
    const numericId = Number(idOrSlug);
    const source =
      (Number.isFinite(numericId) && /^\d+$/.test(String(idOrSlug))
        ? await this.repository.findById(numericId)
        : null) ?? (await this.repository.findOne({ slug: idOrSlug }));
    if (!source) return [];

    const legacyId = source.legacyId ? String(source.legacyId) : '';
    if (!legacyId) return [this.toView(source, 'block')];

    const { data } = await this.repository.findMany({
      filters: [
        { field: 'legacyId', op: 'eq', value: legacyId },
        { field: 'status', op: 'eq', value: 'published' },
      ],
      limit: 20,
    });

    return data.map((row) => this.toView(row, 'block'));
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
