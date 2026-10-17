import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUTHOR_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { AuthorEntity } from './entities/author.entity';

@Injectable()
export class AuthorsService extends BaseCrudService<AuthorEntity> {
  protected readonly repository: ICrudRepository<AuthorEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'authors',
    searchFields: ['name', 'role', 'email', 'bio'],
    sortableFields: ['name', 'sortOrder', 'createdAt', 'updatedAt'],
    listFields: ['id', 'name', 'role', 'email', 'photo', 'isFallback', 'status', 'locale'],
    cardFields: ['id', 'name', 'role', 'bio', 'photo', 'email', 'isFallback', 'status'],
  };

  constructor(
    @Inject(AUTHOR_REPOSITORY) repository: ICrudRepository<AuthorEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<AuthorEntity>,
    op: 'create' | 'update',
  ): Partial<AuthorEntity> {
    const out = { ...dto };
    if (!out.slug && out.name) out.slug = slugify(String(out.name));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'published';
    }
    return out;
  }

  /**
   * L'auteur de repli doit être unique par langue : dès qu'une fiche est
   * marquée, les autres de la même langue sont démarquées. Sans cela deux
   * fiches concurrentes rendraient l'affichage de la vitrine non déterministe.
   */
  private async demoteOtherFallbacks(keepId: number, locale: string): Promise<void> {
    const { data } = await this.repository.findMany({
      limit: 200,
      filters: [
        { field: 'isFallback', op: 'eq', value: true },
        { field: 'locale', op: 'eq', value: locale },
      ],
    });
    for (const row of data) {
      if (Number(row.id) !== Number(keepId)) {
        await this.repository.update(Number(row.id), { isFallback: false } as Partial<AuthorEntity>);
      }
    }
  }

  override async create(dto: Partial<AuthorEntity>, actor?: ActorContext): Promise<unknown> {
    const created = (await super.create(dto, actor)) as AuthorEntity;
    if (dto.isFallback) {
      await this.demoteOtherFallbacks(Number(created.id), String(created.locale || 'fr'));
      await this.invalidateCache();
    }
    return created;
  }

  override async update(
    id: number,
    dto: Partial<AuthorEntity>,
    actor?: ActorContext,
  ): Promise<unknown> {
    const updated = (await super.update(id, dto, actor)) as AuthorEntity;
    if (dto.isFallback) {
      await this.demoteOtherFallbacks(Number(id), String(updated.locale || 'fr'));
      await this.invalidateCache();
    }
    return updated;
  }

  /**
   * Auteur de repli d'une langue, utilisé par la vitrine quand l'article
   * n'a pas d'auteur. À défaut de fiche marquée, on ne renvoie rien plutôt
   * que d'en choisir une au hasard.
   */
  async findFallback(locale = 'fr'): Promise<AuthorEntity | null> {
    const direct = await this.repository.findOne({ isFallback: true, locale, status: 'published' });
    if (direct) return direct;
    return this.repository.findOne({ isFallback: true, status: 'published' });
  }
}
