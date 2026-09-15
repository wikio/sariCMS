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

  private formatOrderCode(id: number, year?: number): string {
    const y = year ?? new Date().getFullYear();
    const yy = String(y % 100).padStart(2, '0');
    return `SARI-WCMD${yy}-${String(id).padStart(5, '0')}`;
  }

  override async create(dto: Partial<OrderEntity>, actor?: import('../../common/crud/base-crud.service').ActorContext): Promise<unknown> {
    // Si un code est fourni mais déjà pris, on le neutralise pour générer un code unique basé sur l'auto-incrément
    if (dto.code) {
      const dup = await this.repository.findOne({ code: dto.code }, true).catch(() => null);
      if (dup) delete (dto as Record<string, unknown>).code;
    }
    const created = (await super.create(dto, actor)) as OrderEntity & { code?: string; id: number; date?: unknown };
    // Génère le code formaté SARI-WCMD{YY}-{ID} si aucun code n'a été fourni (ou doublon neutralisé) — boucle anti-collision
    if (!created.code) {
      const baseYear = created.date ? new Date(String(created.date)).getFullYear() : undefined;
      let suffix = created.id;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const code = this.formatOrderCode(suffix, baseYear);
        const exists = await this.repository.findOne({ code }, true).catch(() => null);
        if (!exists) {
          try {
            const updated = await this.repository.update(created.id, { code } as Partial<OrderEntity>);
            return this.toView(updated as OrderEntity, 'block');
          } catch {
            suffix += 1;
            continue;
          }
        }
        suffix += 1;
      }
    }
    return created;
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
