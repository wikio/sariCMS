import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import {
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../common/crud/interfaces/repository.interface';
import { TaxRuleEntity } from './entities/tax-rule.entity';
import { TaxesService } from './taxes.service';

/** Dépôt en mémoire, même contrat que celui de la spec coupons. */
class MemoryRepo implements ICrudRepository<TaxRuleEntity> {
  readonly collection = 'tax_rules';
  rows: TaxRuleEntity[] = [];
  private seq = 0;

  async findMany(options: QueryOptions): Promise<PaginatedResult<TaxRuleEntity>> {
    let rows = this.rows.filter((r) => (options.onlyDeleted ? r.deletedAt : !r.deletedAt));
    for (const clause of options.filters ?? []) {
      if (clause.op === 'eq' || clause.op === undefined) {
        rows = rows.filter(
          (r) => (r as unknown as Record<string, unknown>)[clause.field] === clause.value,
        );
      }
    }
    if (options.sortBy) {
      const key = options.sortBy;
      const dir = options.sortOrder === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[key];
        const bv = (b as unknown as Record<string, unknown>)[key];
        const an = Number(av);
        const bn = Number(bv);
        if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }
    const total = rows.length;
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findById(id: number, includeDeleted = false): Promise<TaxRuleEntity | null> {
    const hit = this.rows.find((r) => r.id === id) ?? null;
    return hit?.deletedAt && !includeDeleted ? null : hit;
  }

  async findOne(where: Record<string, unknown>, includeDeleted = false): Promise<TaxRuleEntity | null> {
    return (
      this.rows.find(
        (r) =>
          Object.entries(where).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ) && (includeDeleted || !r.deletedAt),
      ) ?? null
    );
  }

  async create(data: Partial<TaxRuleEntity>): Promise<TaxRuleEntity> {
    const now = new Date().toISOString();
    const row = { ...data, id: ++this.seq, createdAt: now, updatedAt: now, deletedAt: null } as TaxRuleEntity;
    this.rows.push(row);
    return row;
  }

  async update(id: number, data: Partial<TaxRuleEntity>): Promise<TaxRuleEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('introuvable');
    Object.assign(row, data, { updatedAt: new Date().toISOString() });
    return row;
  }

  async softDelete(id: number): Promise<TaxRuleEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('introuvable');
    row.deletedAt = new Date().toISOString();
    return row;
  }

  async restore(id: number): Promise<TaxRuleEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('introuvable');
    row.deletedAt = null;
    return row;
  }

  async hardDelete(id: number): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }

  async purgeExpired(): Promise<number> {
    return 0;
  }

  async deleteOlderThan(field: string, cutoff: Date): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => {
      const value = (r as unknown as Record<string, unknown>)[field];
      return !(value && new Date(String(value)) <= cutoff);
    });
    return before - this.rows.length;
  }

  async count(where?: Record<string, unknown>, includeDeleted = false): Promise<number> {
    return this.rows.filter(
      (r) =>
        (includeDeleted || !r.deletedAt) &&
        (!where ||
          Object.entries(where).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          )),
    ).length;
  }

  async autocomplete(field: string, q: string, limit: number) {
    const needle = q.toLowerCase();
    return this.rows
      .filter((r) => !r.deletedAt)
      .map((r) => ({ id: String(r.id), value: String((r as unknown as Record<string, unknown>)[field] ?? '') }))
      .filter((hit) => hit.value.toLowerCase().includes(needle))
      .slice(0, limit);
  }
}

function mockCache(): AppCacheService {
  const store = new Map<string, unknown>();
  return {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => {
      store.set(k, v);
    },
    del: async (k: string) => {
      store.delete(k);
    },
    delByPrefix: async (prefix: string) => {
      for (const k of [...store.keys()]) if (k.includes(prefix)) store.delete(k);
    },
  } as unknown as AppCacheService;
}

function mockAudit(): AuditService {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function makeService() {
  const repo = new MemoryRepo();
  const service = new TaxesService(repo, mockCache(), mockAudit());
  return { repo, service };
}

const row = (over: Partial<TaxRuleEntity> = {}): TaxRuleEntity =>
  ({
    name: 'TVA standard',
    mode: 'percent',
    rate: 19,
    zone: 'DZ',
    scope: 'all',
    scopeValues: [],
    included: false,
    priority: 1,
    active: true,
    isDefault: false,
    ...over,
  }) as TaxRuleEntity;

const asDto = (r: Partial<TaxRuleEntity> & { id?: number }) => r as never;

describe('TaxesService', () => {
  describe('sync', () => {
    it('crée les taxes absentes de la base', async () => {
      const { service, repo } = makeService();
      const result = await service.sync({ taxes: [asDto(row())] });
      expect(result.created).toBe(1);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].name).toBe('TVA standard');
    });

    it('met à jour par identifiant', async () => {
      const { service, repo } = makeService();
      await service.sync({ taxes: [asDto(row())] });
      const result = await service.sync({ taxes: [asDto({ ...row(), id: 1, rate: 9 })] });
      expect(result.updated).toBe(1);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].rate).toBe(9);
    });

    it('ne supprime que les identifiants de `removed`', async () => {
      const { service, repo } = makeService();
      await service.sync({ taxes: [asDto(row({ name: 'A' })), asDto(row({ name: 'B' }))] });
      const result = await service.sync({ taxes: [asDto({ ...row({ name: 'A' }), id: 1 })], removed: [2] });
      expect(result.removed).toBe(1);
      expect(repo.rows.find((r) => r.id === 1)?.deletedAt).toBeNull();
      expect(repo.rows.find((r) => r.id === 2)?.deletedAt).not.toBeNull();
    });
  });

  describe('une seule taxe par défaut', () => {
    it('poser un défaut retire celui des autres', async () => {
      const { service, repo } = makeService();
      await service.sync({ taxes: [asDto(row({ name: 'A', isDefault: true, priority: 1 }))] });
      await service.sync({
        taxes: [asDto({ ...row({ name: 'A', priority: 1 }), id: 1 }), asDto(row({ name: 'B', isDefault: true, priority: 2 }))],
      });
      const defaults = repo.rows.filter((r) => r.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe('B');
    });

    it('deux défauts dans un même envoi n\'en laissent qu\'un — le premier', async () => {
      const { service, repo } = makeService();
      await service.sync({
        taxes: [
          asDto(row({ name: 'A', isDefault: true, priority: 1 })),
          asDto(row({ name: 'B', isDefault: true, priority: 2 })),
        ],
      });
      const defaults = repo.rows.filter((r) => r.isDefault);
      expect(defaults).toHaveLength(1);
      // Le défaut déjà en place garde la main : c'était la règle de `saveTaxes()`
      // côté écran, et inverser la TVA globale sur une création ne se verrait
      // nulle part dans les totaux.
      expect(defaults[0].name).toBe('A');
    });

    it('une création isolée ne détrône pas le défaut en place', async () => {
      const { service, repo } = makeService();
      await service.create({ name: 'A', isDefault: true, rate: 19 } as Partial<TaxRuleEntity>);
      await service.create({ name: 'B', isDefault: true, rate: 9 } as Partial<TaxRuleEntity>);
      const defaults = repo.rows.filter((r) => r.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe('A');
      expect(repo.rows.find((r) => r.name === 'B')?.isDefault).toBe(false);
    });

    it('et sur une mise à jour isolée', async () => {
      const { service, repo } = makeService();
      await service.create({ name: 'A', isDefault: true, rate: 19 } as Partial<TaxRuleEntity>);
      await service.create({ name: 'B', rate: 9 } as Partial<TaxRuleEntity>);
      await service.update(2, { isDefault: true } as Partial<TaxRuleEntity>);
      const defaults = repo.rows.filter((r) => r.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe('B');
    });
  });

  describe('ancien format', () => {
    it('une taxe à `category` sans `scope` devient un périmètre catégorie', async () => {
      const { service, repo } = makeService();
      await service.sync({
        taxes: [asDto({ name: 'Conso', category: 'Consommables', rate: 9 })],
      });
      expect(repo.rows[0].scope).toBe('category');
      expect(repo.rows[0].scopeValues).toEqual(['Consommables']);
    });

    it('un `scope` explicite prime sur la déduction', async () => {
      const { service, repo } = makeService();
      await service.sync({
        taxes: [asDto({ name: 'X', category: 'Consommables', scope: 'all', rate: 9 })],
      });
      expect(repo.rows[0].scope).toBe('all');
    });

    it('les libellés manquants retombent sur le nom en français', async () => {
      const { service, repo } = makeService();
      await service.sync({ taxes: [asDto({ name: 'Éco-taxe', rate: 250, mode: 'fixed' })] });
      expect(repo.rows[0].names).toEqual({ fr: 'Éco-taxe' });
      expect(repo.rows[0].labels).toEqual({ fr: 'Éco-taxe' });
    });

    it('les libellés traduits sont conservés tels quels', async () => {
      const { service, repo } = makeService();
      await service.sync({
        taxes: [
          asDto({
            name: 'TVA',
            names: { fr: 'TVA', en: 'VAT', ar: 'ض.ق.م' },
            labels: { ar: 'ض.ق.م 19٪' },
            rate: 19,
          }),
        ],
      });
      expect(repo.rows[0].names).toEqual({ fr: 'TVA', en: 'VAT', ar: 'ض.ق.م' });
      expect((repo.rows[0].labels as Record<string, string>).ar).toBe('ض.ق.م 19٪');
    });
  });

  describe('listAll', () => {
    it('rend les taxes triées par priorité croissante', async () => {
      const { service } = makeService();
      await service.sync({
        taxes: [
          asDto(row({ name: 'trois', priority: 3 })),
          asDto(row({ name: 'un', priority: 1 })),
          asDto(row({ name: 'deux', priority: 2 })),
        ],
      });
      const list = (await service.listAll()) as { name: string }[];
      expect(list.map((r) => r.name)).toEqual(['un', 'deux', 'trois']);
    });
  });
});
