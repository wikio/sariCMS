import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { QUOTE_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { QuoteEntity } from './entities/quote.entity';

@Injectable()
export class QuotesService extends BaseCrudService<QuoteEntity> {
  protected readonly repository: ICrudRepository<QuoteEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'quotes',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['reference', 'client', 'email', 'company', 'phone'],
    sortableFields: ['createdAt', 'updatedAt', 'date', 'total', 'status'],
    listFields: ['id', 'reference', 'client', 'email', 'company', 'date', 'status', 'total', 'currency', 'userId'],
    cardFields: ['id', 'reference', 'client', 'email', 'date', 'status', 'total', 'currency'],
  };

  constructor(
    @Inject(QUOTE_REPOSITORY) repository: ICrudRepository<QuoteEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<QuoteEntity>,
    op: 'create' | 'update',
    existing?: QuoteEntity,
  ): Partial<QuoteEntity> {
    const out = { ...dto };
    if (op === 'create') {
      out.status = out.status || 'submitted';
      out.currency = out.currency || 'DZD';
      if (!out.date) out.date = new Date().toISOString();
    }
    if (typeof out.email === 'string') out.email = out.email.toLowerCase().trim();

    if (op === 'update' && out.status && existing && out.status !== existing.status) {
      const history = Array.isArray(existing.history) ? [...(existing.history as unknown[])] : [];
      history.push({ status: out.status, at: new Date().toISOString() });
      out.history = history;
    }
    return out;
  }
}
