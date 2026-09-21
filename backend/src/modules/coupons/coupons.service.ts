import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { COUPON_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import {
  toDateOrNull,
  toNumberOr,
  toNumberOrNull,
  toStringArray,
} from '../../common/crud/coerce';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { SyncCouponsDto } from './dto/coupon.dto';
import { CouponEntity } from './entities/coupon.entity';

/** Les champs renvoyés à l'interface : elle a besoin de tout, y compris en liste. */
const FIELDS = [
  'id',
  'code',
  'type',
  'amount',
  'maxDiscount',
  'minOrder',
  'startDate',
  'endDate',
  'limitGlobal',
  'limitPerClient',
  'used',
  'scope',
  'scopeValues',
  'excludeValues',
  'stackable',
  'active',
  'revenue',
  'notes',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class CouponsService extends BaseCrudService<CouponEntity> {
  protected readonly repository: ICrudRepository<CouponEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'coupons',
    // Table technique, pas un contenu traduisible : pas de colonne `legacyId`.
    hasLegacyId: false,
    searchFields: ['code', 'notes'],
    sortableFields: ['code', 'amount', 'used', 'revenue', 'createdAt', 'updatedAt', 'startDate', 'endDate'],
    // `assertUniques` cherche en incluant la corbeille : un code envoyé en
    // corbeille reste réservé jusqu'à la purge. C'est voulu — réutiliser un code
    // rendrait les historiques de `orders.coupon` ambigus.
    uniqueFields: ['code'],
    listFields: [...FIELDS],
    cardFields: [...FIELDS],
  };

  constructor(
    @Inject(COUPON_REPOSITORY) repository: ICrudRepository<CouponEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  /**
   * Enregistrement du catalogue complet depuis l'écran d'administration.
   *
   * Chaque ligne est appariée d'abord par identifiant, puis par code : un
   * coupon créé hors ligne (identifiant provisoire côté navigateur) retrouve sa
   * ligne si son code existe déjà. Les suppressions viennent de `dto.removed`,
   * jamais des absences — un envoi partiel ne vide donc pas le catalogue.
   */
  async sync(
    dto: SyncCouponsDto,
    actor?: ActorContext,
  ): Promise<{ created: number; updated: number; removed: number; coupons: unknown[] }> {
    const incoming = Array.isArray(dto.coupons) ? dto.coupons : [];
    this.assertNoDuplicateCodes(incoming);

    const counters = { created: 0, updated: 0, removed: 0 };
    for (const row of incoming) {
      const payload = this.toEntity(row as unknown as Record<string, unknown>);
      const existing = await this.matchExisting(row.id, payload.code);
      if (existing) {
        await this.update(existing.id, payload, actor);
        counters.updated += 1;
      } else {
        await this.create(payload, actor);
        counters.created += 1;
      }
    }

    for (const id of dto.removed ?? []) {
      const found = await this.repository.findById(Number(id), false);
      if (!found) continue;
      await this.softDelete(found.id, actor);
      counters.removed += 1;
    }

    return { ...counters, coupons: await this.listAll() };
  }

  /**
   * Résout un code saisi par un client.
   *
   * Endpoint public volontairement unitaire : exposer la liste des coupons
   * actifs permettrait d'énumérer tous les codes et de les utiliser sans les
   * avoir reçus. Le panier demande « ce code existe-t-il ? », pas « que
   * contient le catalogue ? ».
   */
  async findByCode(code: string): Promise<CouponEntity> {
    const normalized = String(code ?? '')
      .trim()
      .toUpperCase();
    if (!normalized) throw new BadRequestException('code manquant');
    const found = await this.repository.findOne({ code: normalized }, false);
    if (!found) throw new NotFoundException('coupon introuvable');
    return found;
  }

  /** Tous les coupons non supprimés, triés par code — ce que lit l'interface. */
  async listAll(): Promise<unknown[]> {
    const result = await this.repository.findMany({
      page: 1,
      limit: 1000,
      sortBy: 'code',
      sortOrder: 'asc',
    });
    return result.data.map((row) => this.toView(row, 'block'));
  }

  /* ------------------------------------------------------------------ */

  private assertNoDuplicateCodes(rows: { code?: string }[]): void {
    const seen = new Set<string>();
    for (const row of rows) {
      const code = String(row?.code ?? '')
        .trim()
        .toUpperCase();
      if (!code) throw new BadRequestException('un coupon de l\'envoi n\'a pas de code');
      if (seen.has(code)) {
        throw new BadRequestException(`code présent deux fois dans l'envoi : ${code}`);
      }
      seen.add(code);
    }
  }

  private async matchExisting(
    id: number | undefined,
    code: string,
  ): Promise<CouponEntity | null> {
    const numericId = Number(id);
    if (Number.isInteger(numericId) && numericId > 0) {
      const byId = await this.repository.findById(numericId, false);
      if (byId) return byId;
    }
    return this.repository.findOne({ code }, false);
  }

  /**
   * Forme HTTP → colonne. Le code est normalisé en majuscules : le panier
   * compare déjà en majuscules, et deux casse différentes du même code
   * créeraient deux coupons distincts.
   */
  private toEntity(row: Record<string, unknown>): Partial<CouponEntity> & { code: string } {
    const scopeValues = toStringArray(row.scopeValues);
    const excludeValues = toStringArray(row.excludeValues);
    return {
      code: String(row.code ?? '')
        .trim()
        .toUpperCase(),
      type: row.type === 'fixed' ? 'fixed' : 'percent',
      amount: toNumberOr(row.amount, 0),
      maxDiscount: toNumberOrNull(row.maxDiscount),
      minOrder: toNumberOrNull(row.minOrder),
      startDate: toDateOrNull(row.startDate),
      endDate: toDateOrNull(row.endDate),
      limitGlobal: toNumberOrNull(row.limitGlobal),
      limitPerClient: toNumberOrNull(row.limitPerClient),
      used: toNumberOr(row.used, 0),
      scope: row.scope === 'category' || row.scope === 'product' ? row.scope : 'all',
      scopeValues,
      excludeValues,
      stackable: Boolean(row.stackable),
      active: row.active === undefined ? true : Boolean(row.active),
      revenue: toNumberOr(row.revenue, 0),
      notes: row.notes === undefined || row.notes === null ? null : String(row.notes),
    };
  }
}
