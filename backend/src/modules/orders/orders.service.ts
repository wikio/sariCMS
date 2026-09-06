import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { ORDER_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { OrderEntity } from './entities/order.entity';

@Injectable()
export class OrdersService extends BaseCrudService<OrderEntity> {
  protected readonly repository: ICrudRepository<OrderEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'orders',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['code', 'client', 'email', 'company', 'phone'],
    sortableFields: ['createdAt', 'updatedAt', 'date', 'total', 'status'],
    listFields: ['id', 'code', 'client', 'email', 'company', 'date', 'status', 'total', 'currency', 'paid', 'userId'],
    cardFields: ['id', 'code', 'client', 'email', 'date', 'status', 'total', 'currency', 'paid'],
  };

  constructor(
    @Inject(ORDER_REPOSITORY) repository: ICrudRepository<OrderEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<OrderEntity>,
    op: 'create' | 'update',
    existing?: OrderEntity,
  ): Partial<OrderEntity> {
    const out = { ...dto };
    if (op === 'create') {
      out.status = out.status || 'pending';
      out.currency = out.currency || 'DZD';
      out.paid = out.paid ?? false;
      if (!out.date) out.date = new Date().toISOString();
    }
    if (typeof out.email === 'string') out.email = out.email.toLowerCase().trim();

    // Journalise chaque changement d'état pour garder une traçabilité
    // équivalente à celle que l'ancien store localStorage tenait à la main.
    if (op === 'update' && out.status && existing && out.status !== existing.status) {
      const history = Array.isArray(existing.history) ? [...(existing.history as unknown[])] : [];
      history.push({ status: out.status, at: new Date().toISOString() });
      out.history = history;
    }
    return out;
  }
}
