import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../common/crud/interfaces/repository.interface';
import { getPath, matchFilter } from '../../../common/crud/query.util';
import { JsonStore } from './json-store';

export class JsonRepository<T extends BaseEntity> implements ICrudRepository<T> {
  constructor(
    public readonly collection: string,
    private readonly store: JsonStore,
  ) {}

  async findMany(options: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    let items = this.applyScope(this.store.read(this.collection), options);

    if (options.filters?.length) {
      items = items.filter((row) => options.filters!.every((clause) => matchFilter(row, clause)));
    }

    if (options.search && options.searchFields?.length) {
      const q = options.search.toLowerCase();
      items = items.filter((row) =>
        options.searchFields!.some((field) =>
          String(getPath(row, field) ?? '')
            .toLowerCase()
            .includes(q),
        ),
      );
    }

    const sortBy = options.sortBy ?? 'createdAt';
    const dir = options.sortOrder === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const av = getPath(a, sortBy);
      const bv = getPath(b, sortBy);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });

    const total = items.length;
    const start = (page - 1) * limit;
    const data = items.slice(start, start + limit).map((row) => this.hydrate(row));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findById(id: number, includeDeleted = false): Promise<T | null> {
    const row = this.store.read(this.collection).find((item) => String(item.id) === String(id));
    if (!row) return null;
    if (row.deletedAt && !includeDeleted) return null;
    return this.hydrate(row);
  }

  async findOne(where: Record<string, unknown>, includeDeleted = false): Promise<T | null> {
    const row = this.store
      .read(this.collection)
      .find((item) => {
        if (item.deletedAt && !includeDeleted) return false;
        return Object.entries(where).every(([k, v]) => String(item[k] ?? '') === String(v ?? ''));
      });
    return row ? this.hydrate(row) : null;
  }

  private nextId(): number {
    const rows = this.store.read(this.collection);
    let max = 0;
    for (const r of rows) {
      const v = Number(r.id);
      if (Number.isFinite(v) && v > max) max = v;
    }
    return max + 1;
  }

  async create(data: Partial<T>): Promise<T> {
    const now = new Date().toISOString();
    const entity = {
      ...data,
      id: data.id ?? this.nextId(),
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      deletedAt: data.deletedAt ?? null,
    } as unknown as Record<string, unknown>;
    const all = [...this.store.read(this.collection), entity];
    await this.store.write(this.collection, all);
    return this.hydrate(entity);
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const all = this.store.read(this.collection);
    const idx = all.findIndex((item) => String(item.id) === String(id));
    if (idx < 0) throw new Error(`${this.collection}#${id} not found`);
    const merged = {
      ...all[idx],
      ...this.stripUndefined(data as Record<string, unknown>),
      id,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = merged;
    await this.store.write(this.collection, all);
    return this.hydrate(merged);
  }

  async softDelete(id: number): Promise<T> {
    return this.update(id, { deletedAt: new Date().toISOString() } as Partial<T>);
  }

  async restore(id: number): Promise<T> {
    return this.update(id, { deletedAt: null } as Partial<T>);
  }

  async hardDelete(id: number): Promise<void> {
    const all = this.store.read(this.collection).filter((item) => String(item.id) !== String(id));
    await this.store.write(this.collection, all);
  }

  async purgeExpired(olderThan: Date): Promise<number> {
    const all = this.store.read(this.collection);
    const keep: Record<string, unknown>[] = [];
    let removed = 0;
    for (const item of all) {
      if (item.deletedAt && new Date(String(item.deletedAt)) <= olderThan) {
        removed += 1;
      } else {
        keep.push(item);
      }
    }
    if (removed) await this.store.write(this.collection, keep);
    return removed;
  }

  async count(where: Record<string, unknown> = {}, includeDeleted = false): Promise<number> {
    return this.store.read(this.collection).filter((item) => {
      if (item.deletedAt && !includeDeleted) return false;
      return Object.entries(where).every(([k, v]) => String(item[k] ?? '') === String(v ?? ''));
    }).length;
  }

  async autocomplete(field: string, q: string, limit: number): Promise<AutocompleteHit[]> {
    const needle = q.toLowerCase();
    return this.store
      .read(this.collection)
      .filter((item) => !item.deletedAt)
      .map((item) => ({
        id: String(item.id),
        value: String(item[field] ?? ''),
      }))
      .filter((hit) => hit.value.toLowerCase().includes(needle))
      .slice(0, limit);
  }

  private applyScope(
    items: Record<string, unknown>[],
    options: QueryOptions,
  ): Record<string, unknown>[] {
    if (options.onlyDeleted) return items.filter((i) => Boolean(i.deletedAt));
    if (options.includeDeleted) return items;
    return items.filter((i) => !i.deletedAt);
  }

  private hydrate(row: Record<string, unknown>): T {
    return { ...row } as T;
  }

  private stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}
