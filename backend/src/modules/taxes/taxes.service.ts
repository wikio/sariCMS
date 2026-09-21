import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { TAX_RULE_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { toDateOrNull, toNumberOr, toStringArray } from '../../common/crud/coerce';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { SyncTaxRulesDto } from './dto/tax-rule.dto';
import { TaxRuleEntity } from './entities/tax-rule.entity';

const FIELDS = [
  'id',
  'name',
  'names',
  'labels',
  'mode',
  'rate',
  'zone',
  'category',
  'scope',
  'scopeValues',
  'included',
  'priority',
  'active',
  'isDefault',
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class TaxesService extends BaseCrudService<TaxRuleEntity> {
  protected readonly repository: ICrudRepository<TaxRuleEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'taxes',
    hasLegacyId: false,
    searchFields: ['name', 'zone', 'category'],
    sortableFields: ['name', 'rate', 'priority', 'createdAt', 'updatedAt'],
    listFields: [...FIELDS],
    cardFields: [...FIELDS],
  };

  constructor(
    @Inject(TAX_RULE_REPOSITORY) repository: ICrudRepository<TaxRuleEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  /**
   * Le jeu de taxes complet, dans l'ordre d'application.
   *
   * C'est ce que lit le panier pour calculer les totaux : `lib/commerce-math.ts`
   * applique les taxes par `priority` croissante, donc le tri est ici et non
   * côté client.
   */
  async listAll(): Promise<unknown[]> {
    const result = await this.repository.findMany({
      page: 1,
      limit: 200,
      sortBy: 'priority',
      sortOrder: 'asc',
    });
    return result.data.map((row) => this.toView(row, 'block'));
  }

  /**
   * Enregistrement du jeu complet depuis l'écran d'administration.
   *
   * Même contrat que `CouponsService.sync` : appariement par identifiant puis
   * par défaut création, suppressions explicites via `removed`.
   */
  async sync(
    dto: SyncTaxRulesDto,
    actor?: ActorContext,
  ): Promise<{ created: number; updated: number; removed: number; taxes: unknown[] }> {
    const incoming = Array.isArray(dto.taxes) ? dto.taxes : [];
    if (incoming.length > 200) {
      throw new BadRequestException('au plus 200 taxes par envoi');
    }

    const counters = { created: 0, updated: 0, removed: 0 };
    for (const row of incoming) {
      const payload = this.toEntity(row as unknown as Record<string, unknown>);
      const numericId = Number(row.id);
      const existing =
        Number.isInteger(numericId) && numericId > 0
          ? await this.repository.findById(numericId, false)
          : null;
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

    // `saveTaxes()` côté navigateur imposait « au plus une taxe par défaut » en
    // réécrivant le tableau avant écriture. Cette contrainte doit maintenant
    // tenir côté serveur, sinon deux enregistrements concurrents la cassent.
    await this.enforceSingleDefault();

    return { ...counters, taxes: await this.listAll() };
  }

  override async create(dto: Partial<TaxRuleEntity>, actor?: ActorContext): Promise<unknown> {
    const payload = { ...dto };
    // « Au plus une taxe par défaut », et c'est le défaut **déjà en place** qui
    // garde la main : `saveTaxes()` côté écran conservait le premier du tableau.
    // Inverser silencieusement la TVA globale sur une création serait d'autant
    // plus coûteux que rien ne le signale dans les totaux.
    if (payload.isDefault && (await this.hasDefault())) {
      payload.isDefault = false;
    }
    const created = await super.create(payload, actor);
    return created;
  }

  /**
   * Passer une taxe existante en défaut est un geste explicite sur une ligne
   * précise : c'est elle qui l'emporte, les autres sont rétrogradées.
   */
  override async update(
    id: number,
    dto: Partial<TaxRuleEntity>,
    actor?: ActorContext,
  ): Promise<unknown> {
    const updated = await super.update(id, dto, actor);
    if ((dto as { isDefault?: boolean }).isDefault) {
      await this.enforceSingleDefault(id);
    }
    return updated;
  }

  private async hasDefault(): Promise<boolean> {
    const result = await this.repository.findMany({
      page: 1,
      limit: 1,
      filters: [{ field: 'isDefault', op: 'eq', value: true }],
    });
    return result.data.length > 0;
  }

  /**
   * Retire `isDefault` à toutes les taxes sauf une.
   *
   * Sans `keepId` — c'est le cas d'un envoi par lot — on conserve la première
   * par ordre d'application. « Au plus une » ne veut pas dire « aucune » :
   * retirer tous les défauts ferait disparaître la TVA globale et le panier
   * calculerait des totaux hors taxes sans rien signaler.
   */
  private async enforceSingleDefault(keepId?: number): Promise<void> {
    const result = await this.repository.findMany({
      page: 1,
      limit: 200,
      sortBy: 'priority',
      sortOrder: 'asc',
      filters: [{ field: 'isDefault', op: 'eq', value: true }],
    });
    const keep = keepId ?? result.data[0]?.id;
    for (const row of result.data) {
      if (keep !== undefined && row.id === keep) continue;
      await this.repository.update(row.id, { isDefault: false } as Partial<TaxRuleEntity>);
    }
  }

  private toEntity(row: Record<string, unknown>): Partial<TaxRuleEntity> {
    const scopeValues = toStringArray(row.scopeValues);
    const category =
      row.category === undefined || row.category === null || row.category === ''
        ? null
        : String(row.category);
    // Un `scope` explicite — y compris `all` — prime sur la déduction depuis
    // `category` : sinon une taxe volontairement remise sur « tout » repassait
    // en périmètre catégorie à chaque enregistrement.
    const rawScope =
      row.scope === 'all' || row.scope === 'category' || row.scope === 'product'
        ? row.scope
        : undefined;
    return {
      name: String(row.name ?? '').trim(),
      names: this.toLabelMap(row.names, String(row.name ?? '')),
      labels: this.toLabelMap(row.labels, String(row.name ?? '')),
      mode: row.mode === 'fixed' ? 'fixed' : 'percent',
      rate: toNumberOr(row.rate, 0),
      zone: row.zone === undefined || row.zone === null || row.zone === '' ? 'DZ' : String(row.zone),
      category,
      // L'ancien format n'avait pas `scope` : il se déduisait de `category`.
      scope: rawScope ?? (category ? 'category' : 'all'),
      scopeValues: scopeValues.length ? scopeValues : category ? [category] : [],
      included: Boolean(row.included),
      priority: toNumberOr(row.priority, 0),
      active: row.active === undefined ? true : Boolean(row.active),
      isDefault: Boolean(row.isDefault),
      startDate: toDateOrNull(row.startDate),
      endDate: toDateOrNull(row.endDate),
    };
  }

  /** `{ fr, en, ar }` → objet, en retombant sur le libellé de base en français. */
  private toLabelMap(value: unknown, fallback: string): Record<string, string> {
    const base = fallback || '';
    const out: Record<string, string> = { fr: base };
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (raw === null || raw === undefined) continue;
        out[key] = String(raw);
      }
    }
    if (!out.fr) out.fr = base;
    return out;
  }
}
