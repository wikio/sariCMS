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
    const out: Record<string, unknown> & Partial<OrderEntity> = { ...dto } as Record<string, unknown> & Partial<OrderEntity>;
    if (op === 'create') {
      out.status = out.status || 'pending';
      out.currency = out.currency || 'DZD';
      out.paid = out.paid ?? false;
      if (!out.date) out.date = new Date().toISOString();
      const rawClient = String((out as Record<string, unknown>).client || '').trim();
      if (!rawClient || rawClient.length < 2) (out as Record<string, unknown>).client = 'Client';
      const rawEmail = String((out as Record<string, unknown>).email || '').trim().toLowerCase();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
      if (!emailOk) (out as Record<string, unknown>).email = 'no-reply@sari.dz';
      else (out as Record<string, unknown>).email = rawEmail;
      const t = Number((out as Record<string, unknown>).total);
      (out as Record<string, unknown>).total = Number.isFinite(t) && t >= 0 ? Math.round(t * 100) / 100 : 0;
      if (!Array.isArray((out as Record<string, unknown>).items)) (out as Record<string, unknown>).items = [];
      (out as Record<string, unknown>).items = ((out as Record<string, unknown>).items as unknown[]).map((it: unknown) => {
        const r = (it || {}) as Record<string, unknown>;
        const name = String(r.name || 'Article').slice(0, 300) || 'Article';
        const qty = Math.max(1, Math.min(9999, Math.floor(Number(r.quantity) || 1)));
        const priceRaw = r.price;
        const priceNum = typeof priceRaw === 'string' ? Number(String(priceRaw).replace(/[^0-9.]/g, '')) : Number(priceRaw);
        const price = Math.max(0, Math.min(10000000, Math.round((Number.isFinite(priceNum) ? priceNum : 0) * 100) / 100));
        return { ...r, name, quantity: qty, price };
      });
    }
    if (typeof (out as Record<string, unknown>).email === 'string') (out as Record<string, unknown>).email = String((out as Record<string, unknown>).email).toLowerCase().trim();
    if (op === 'update' && (out as Record<string, unknown>).status && existing && (out as Record<string, unknown>).status !== (existing as unknown as Record<string, unknown>).status) {
      const history = Array.isArray((existing as unknown as Record<string, unknown>).history) ? [...((existing as unknown as Record<string, unknown>).history as unknown[])] : [];
      history.push({ status: (out as Record<string, unknown>).status as string, at: new Date().toISOString() });
      (out as Record<string, unknown>).history = history;
    }
    return out as Partial<OrderEntity>;
  }
}
