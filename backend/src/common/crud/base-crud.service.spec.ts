import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppCacheService } from '../cache/cache.service';
import { BaseCrudService, CrudServiceOptions } from './base-crud.service';
import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from './interfaces/repository.interface';
import { QueryDto } from './dto/query.dto';

interface Item extends BaseEntity {
  title: string;
  status: string;
  passwordHash?: string;
}

class MemoryRepo implements ICrudRepository<Item> {
  readonly collection = 'items';
  items: Item[] = [];
  private seq = 0;

  async findMany(options: QueryOptions): Promise<PaginatedResult<Item>> {
    let rows = this.items.filter((i) => (options.onlyDeleted ? i.deletedAt : !i.deletedAt));
    if (options.search) {
      rows = rows.filter((i) => i.title.toLowerCase().includes(options.search!.toLowerCase()));
    }
    const total = rows.length;
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }
  async findById(id: number, includeDeleted = false): Promise<Item | null> {
    const hit = this.items.find((i) => i.id === id) ?? null;
    if (hit?.deletedAt && !includeDeleted) return null;
    return hit;
  }
  async findOne(where: Record<string, unknown>): Promise<Item | null> {
    return (
      this.items.find((i) => Object.entries(where).every(([k, v]) => (i as any)[k] === v)) ?? null
    );
  }
  async create(data: Partial<Item>): Promise<Item> {
    const now = new Date().toISOString();
    const item = {
      ...data,
      id: (data as { id?: number }).id ?? ++this.seq,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as Item;
    this.items.push(item);
    return item;
  }
  async update(id: number, data: Partial<Item>): Promise<Item> {
    const idx = this.items.findIndex((i) => i.id === id);
    this.items[idx] = { ...this.items[idx], ...data };
    return this.items[idx];
  }
  async softDelete(id: number): Promise<Item> {
    return this.update(id, { deletedAt: new Date().toISOString() });
  }
  async restore(id: number): Promise<Item> {
    return this.update(id, { deletedAt: null });
  }
  async hardDelete(id: number): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
  }
  async purgeExpired(olderThan: Date): Promise<number> {
    const before = this.items.length;
    this.items = this.items.filter((i) => !i.deletedAt || new Date(String(i.deletedAt)) > olderThan);
    return before - this.items.length;
  }
  async count(): Promise<number> {
    return this.items.filter((i) => !i.deletedAt).length;
  }
  async autocomplete(field: string, q: string, limit: number): Promise<AutocompleteHit[]> {
    return this.items
      .filter((i) => String((i as any)[field] ?? '').toLowerCase().includes(q.toLowerCase()))
      .slice(0, limit)
      .map((i) => ({ id: String(i.id), value: String((i as any)[field]) }));
  }
}

class TestService extends BaseCrudService<Item> {
  protected readonly repository: ICrudRepository<Item>;
  protected readonly options: CrudServiceOptions = {
    resource: 'items',
    searchFields: ['title'],
    sortableFields: ['createdAt', 'title'],
    uniqueFields: ['title'],
    listFields: ['id', 'title', 'status'],
    cardFields: ['id', 'title', 'status', 'createdAt'],
  };

  constructor(repo: ICrudRepository<Item>, cache: AppCacheService, audit: AuditService) {
    super(cache, audit);
    this.repository = repo;
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

describe('BaseCrudService', () => {
  let repo: MemoryRepo;
  let service: TestService;

  beforeEach(() => {
    repo = new MemoryRepo();
    service = new TestService(repo, mockCache(), mockAudit());
  });

  it('creates, lists (view=list) and hides secrets', async () => {
    const created = (await service.create({
      title: 'Hello',
      status: 'draft',
      passwordHash: 'secret',
    } as Partial<Item>)) as Record<string, unknown>;
    expect(created.id).toBeDefined();
    expect(created.passwordHash).toBeUndefined();

    const page = await service.findAll({ page: 1, limit: 10, view: 'list' } as QueryDto);
    expect(page.meta.total).toBe(1);
    expect(page.data[0]).toEqual(
      expect.objectContaining({ title: 'Hello', status: 'draft' }),
    );
    expect((page.data[0] as any).passwordHash).toBeUndefined();
  });

  it('paginates search results', async () => {
    for (let i = 0; i < 5; i++) {
      await service.create({ title: `Item ${i}`, status: 'ok' } as Partial<Item>);
    }
    const page = await service.findAll({ page: 2, limit: 2, search: 'Item' } as QueryDto);
    expect(page.meta.total).toBe(5);
    expect(page.meta.totalPages).toBe(3);
    expect(page.data).toHaveLength(2);
  });

  it('soft-deletes, lists trash, restores', async () => {
    const created = (await service.create({ title: 'X', status: 'ok' } as Partial<Item>)) as Item;
    await service.softDelete(created.id);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);

    const trash = await service.trash({ page: 1, limit: 10 } as QueryDto);
    expect(trash.meta.total).toBe(1);

    const restored = (await service.restore(created.id)) as Item;
    expect(restored.deletedAt).toBeNull();
  });

  it('requires a confirmation token before purge', async () => {
    const created = (await service.create({ title: 'Y', status: 'ok' } as Partial<Item>)) as Item;
    await expect(service.confirmPurge(created.id, 'nope')).rejects.toBeInstanceOf(BadRequestException);

    const { confirm } = await service.requestPurge(created.id);
    const res = await service.confirmPurge(created.id, confirm);
    expect(res.deleted).toBe(true);
    expect(repo.items.find((i) => i.id === created.id)).toBeUndefined();
  });

  it('rejects unknown sort fields and duplicate unique values', async () => {
    await service.create({ title: 'Unique', status: 'ok' } as Partial<Item>);
    await expect(
      service.create({ title: 'Unique', status: 'ok' } as Partial<Item>),
    ).rejects.toThrow(/already in use/);
    await expect(service.findAll({ sortBy: 'hack' } as QueryDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('projects card vs block views', async () => {
    const created = (await service.create({ title: 'V', status: 'ok' } as Partial<Item>)) as Item;
    const card = (await service.findOne(created.id, 'card')) as Record<string, unknown>;
    const block = (await service.findOne(created.id, 'block')) as Record<string, unknown>;
    expect(card.title).toBe('V');
    expect(block.id).toBe(created.id);
    expect(Object.keys(card).sort()).toEqual(['createdAt', 'id', 'status', 'title'].sort());
  });

  it('autocompletes on allowed fields only', async () => {
    await service.create({ title: 'Alpha', status: 'ok' } as Partial<Item>);
    const hits = await service.autocomplete({ q: 'alp', field: 'title', limit: 5 });
    expect(hits).toHaveLength(1);
    await expect(service.autocomplete({ q: 'x', field: 'passwordHash', limit: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
