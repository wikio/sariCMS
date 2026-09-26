import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import {
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../common/crud/interfaces/repository.interface';
import { CouponsService } from './coupons.service';
import { CouponEntity } from './entities/coupon.entity';

/**
 * Dépôt en mémoire.
 *
 * `findOne` respecte `includeDeleted`, parce que `assertUniques` du service de
 * base passe `true` : c'est précisément ce qui rend un code envoyé en corbeille
 * indisponible jusqu'à la purge, et un des comportements à ne pas régresser.
 */
class MemoryRepo implements ICrudRepository<CouponEntity> {
  readonly collection = 'coupons';
  rows: CouponEntity[] = [];
  private seq = 0;

  async findMany(options: QueryOptions): Promise<PaginatedResult<CouponEntity>> {
    let rows = this.rows.filter((r) => (options.onlyDeleted ? r.deletedAt : !r.deletedAt));
    for (const clause of options.filters ?? []) {
      if (clause.op === 'eq' || clause.op === undefined) {
        rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[clause.field] === clause.value);
      }
    }
    if (options.sortBy) {
      const key = options.sortBy;
      const dir = options.sortOrder === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) =>
        String((a as unknown as Record<string, unknown>)[key] ?? '').localeCompare(
          String((b as unknown as Record<string, unknown>)[key] ?? ''),
        ) * dir,
      );
    }
    const total = rows.length;
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findById(id: number, includeDeleted = false): Promise<CouponEntity | null> {
    const hit = this.rows.find((r) => r.id === id) ?? null;
    return hit?.deletedAt && !includeDeleted ? null : hit;
  }

  async findOne(where: Record<string, unknown>, includeDeleted = false): Promise<CouponEntity | null> {
    return (
      this.rows.find(
        (r) =>
          Object.entries(where).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ) && (includeDeleted || !r.deletedAt),
      ) ?? null
    );
  }

  async create(data: Partial<CouponEntity>): Promise<CouponEntity> {
    const now = new Date().toISOString();
    const row = {
      ...data,
      id: ++this.seq,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as CouponEntity;
    this.rows.push(row);
    return row;
  }

  async update(id: number, data: Partial<CouponEntity>): Promise<CouponEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException('introuvable');
    Object.assign(row, data, { updatedAt: new Date().toISOString() });
    return row;
  }

  async softDelete(id: number): Promise<CouponEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException('introuvable');
    row.deletedAt = new Date().toISOString();
    return row;
  }

  async restore(id: number): Promise<CouponEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException('introuvable');
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
  const service = new CouponsService(repo, mockCache(), mockAudit());
  return { repo, service };
}

const row = (over: Partial<CouponEntity> = {}): CouponEntity =>
  ({
    code: 'SARI10',
    type: 'percent',
    amount: 10,
    used: 0,
    scope: 'all',
    scopeValues: [],
    excludeValues: [],
    stackable: false,
    active: true,
    revenue: 0,
    ...over,
  }) as CouponEntity;

describe('CouponsService', () => {
  describe('sync — enregistrement du catalogue', () => {
    it('crée les coupons absents de la base', async () => {
      const { service, repo } = makeService();
      const result = await service.sync({ coupons: [row() as unknown as never] });
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].code).toBe('SARI10');
    });

    it('met à jour par identifiant au lieu de créer un doublon', async () => {
      const { service, repo } = makeService();
      await service.sync({ coupons: [row() as unknown as never] });
      const id = repo.rows[0].id;
      const result = await service.sync({
        coupons: [{ ...row(), id, amount: 25 } as unknown as never],
      });
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].amount).toBe(25);
    });

    it('retrouve la ligne par son code quand l\'identifiant est provisoire', async () => {
      const { service, repo } = makeService();
      await service.sync({ coupons: [row() as unknown as never] });
      const result = await service.sync({
        coupons: [{ ...row(), id: undefined, amount: 40 } as unknown as never],
      });
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].amount).toBe(40);
    });

    it('ne supprime que les identifiants listés dans `removed`', async () => {
      const { service, repo } = makeService();
      await service.sync({
        coupons: [row({ code: 'A' }) as unknown as never, row({ code: 'B' }) as unknown as never],
      });
      const [a, b] = repo.rows;
      // Envoi partiel : `B` est absent du lot mais pas de `removed`.
      const result = await service.sync({
        coupons: [{ ...row({ code: 'A' }), id: a.id } as unknown as never],
        removed: [b.id],
      });
      expect(result.removed).toBe(1);
      expect(repo.rows.find((r) => r.id === a.id)?.deletedAt).toBeNull();
      expect(repo.rows.find((r) => r.id === b.id)?.deletedAt).not.toBeNull();
    });

    it('un envoi sans `removed` ne vide pas le catalogue', async () => {
      const { service, repo } = makeService();
      await service.sync({
        coupons: [row({ code: 'A' }) as unknown as never, row({ code: 'B' }) as unknown as never],
      });
      const result = await service.sync({ coupons: [] });
      expect(result.removed).toBe(0);
      expect(repo.rows.filter((r) => !r.deletedAt)).toHaveLength(2);
    });

    it('ignore un identifiant de suppression inconnu', async () => {
      const { service } = makeService();
      const result = await service.sync({ coupons: [], removed: [999] });
      expect(result.removed).toBe(0);
    });

    it('normalise le code en majuscules', async () => {
      const { service, repo } = makeService();
      await service.sync({ coupons: [row({ code: ' rentree26 ' }) as unknown as never] });
      expect(repo.rows[0].code).toBe('RENTREE26');
    });

    it('convertit les dates courtes en `Date`', async () => {
      const { service, repo } = makeService();
      await service.sync({
        coupons: [row({ startDate: '2026-01-01', endDate: '2026-12-31' }) as unknown as never],
      });
      expect(repo.rows[0].startDate).toBeInstanceOf(Date);
      expect((repo.rows[0].startDate as Date).toISOString().slice(0, 10)).toBe('2026-01-01');
      expect(repo.rows[0].endDate).toBeInstanceOf(Date);
    });

    it('une date vide devient `null`, pas une date invalide', async () => {
      const { service, repo } = makeService();
      await service.sync({
        coupons: [row({ startDate: '', endDate: null }) as unknown as never],
      });
      expect(repo.rows[0].startDate).toBeNull();
      expect(repo.rows[0].endDate).toBeNull();
    });

    it('refuse deux fois le même code dans un envoi', async () => {
      const { service } = makeService();
      await expect(
        service.sync({
          coupons: [row({ code: 'DOUBLE' }) as unknown as never, row({ code: 'double' }) as unknown as never],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une ligne sans code', async () => {
      const { service } = makeService();
      await expect(
        service.sync({ coupons: [row({ code: '   ' }) as unknown as never] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('un périmètre inconnu retombe sur `all`', async () => {
      const { service, repo } = makeService();
      await service.sync({ coupons: [row({ scope: 'n\'importe quoi' }) as unknown as never] });
      expect(repo.rows[0].scope).toBe('all');
    });
  });

  describe('unicité du code', () => {
    it('un code déjà pris est refusé', async () => {
      const { service } = makeService();
      await service.sync({ coupons: [row({ code: 'PRIS' }) as unknown as never] });
      await expect(
        service.create({ code: 'PRIS', amount: 5 } as Partial<CouponEntity>),
      ).rejects.toThrow(ConflictException);
    });

    it('un code en corbeille reste réservé', async () => {
      const { service, repo } = makeService();
      await service.sync({ coupons: [row({ code: 'CORBEILLE' }) as unknown as never] });
      await service.softDelete(repo.rows[0].id);
      await expect(
        service.create({ code: 'CORBEILLE', amount: 5 } as Partial<CouponEntity>),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByCode — résolution depuis le panier', () => {
    it('trouve sans tenir compte de la casse', async () => {
      const { service } = makeService();
      await service.sync({ coupons: [row({ code: 'SARI10' }) as unknown as never] });
      const found = await service.findByCode('sari10');
      expect(found.code).toBe('SARI10');
    });

    it('lève une 404 sur un code inconnu', async () => {
      const { service } = makeService();
      await expect(service.findByCode('INCONNU')).rejects.toThrow(NotFoundException);
    });

    it('ne rend pas un coupon envoyé en corbeille', async () => {
      const { service, repo } = makeService();
      await service.sync({ coupons: [row({ code: 'SARI10' }) as unknown as never] });
      await service.softDelete(repo.rows[0].id);
      await expect(service.findByCode('SARI10')).rejects.toThrow(NotFoundException);
    });

    it('refuse un code vide', async () => {
      const { service } = makeService();
      await expect(service.findByCode('   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('listAll', () => {
    it('rend les coupons triés par code, corbeille exclue', async () => {
      const { service, repo } = makeService();
      await service.sync({
        coupons: [
          row({ code: 'ZETA' }) as unknown as never,
          row({ code: 'ALPHA' }) as unknown as never,
        ],
      });
      await service.softDelete(repo.rows.find((r) => r.code === 'ALPHA')!.id);
      const list = (await service.listAll()) as { code: string }[];
      expect(list.map((r) => r.code)).toEqual(['ZETA']);
    });
  });

  describe('audit', () => {
    it('trace création, mise à jour et suppression', async () => {
      const repo = new MemoryRepo();
      const audit = mockAudit();
      const service = new CouponsService(repo, mockCache(), audit);
      await service.sync({ coupons: [row() as unknown as never] });
      await service.sync({ coupons: [{ ...row(), id: 1, amount: 99 } as unknown as never] });
      await service.sync({ coupons: [], removed: [1] });
      const actions = (audit.record as jest.Mock).mock.calls.map((c) => c[0].action);
      expect(actions).toEqual(['create', 'update', 'soft_delete']);
    });
  });
});
