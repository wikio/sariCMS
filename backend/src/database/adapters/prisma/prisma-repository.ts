import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../common/crud/interfaces/repository.interface';
import { PrismaService } from './prisma.service';

export class PrismaRepository<T extends BaseEntity> implements ICrudRepository<T> {
  constructor(
    public readonly collection: string,
    private readonly prisma: PrismaService,
    private readonly model: string,
  ) {}

  private get db() {
    return this.prisma.delegate(this.model);
  }

  async findMany(options: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const where = this.buildWhere(options);
    const orderBy = { [options.sortBy ?? 'createdAt']: options.sortOrder ?? 'desc' };

    const [total, rows] = await Promise.all([
      this.db.count({ where }),
      this.db.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows as T[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findById(id: number, includeDeleted = false): Promise<T | null> {
    const row = await this.db.findUnique({ where: { id } });
    if (!row) return null;
    if (row.deletedAt && !includeDeleted) return null;
    return row as T;
  }

  async findOne(where: Record<string, unknown>, includeDeleted = false): Promise<T | null> {
    const row = await this.db.findFirst({
      where: {
        ...where,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
    return (row as T) ?? null;
  }

  async create(data: Partial<T>): Promise<T> {
    return (await this.db.create({ data: this.toPrisma(data) })) as T;
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    return (await this.db.update({
      where: { id },
      data: this.toPrisma(data),
    })) as T;
  }

  async softDelete(id: number): Promise<T> {
    return (await this.db.update({
      where: { id },
      data: { deletedAt: new Date() },
    })) as T;
  }

  async restore(id: number): Promise<T> {
    return (await this.db.update({
      where: { id },
      data: { deletedAt: null },
    })) as T;
  }

  async hardDelete(id: number): Promise<void> {
    await this.db.delete({ where: { id } });
  }

  async purgeExpired(olderThan: Date): Promise<number> {
    const res = await this.db.deleteMany({
      where: {
        deletedAt: { not: null, lte: olderThan },
      },
    });
    return res.count ?? 0;
  }

  async count(where: Record<string, unknown> = {}, includeDeleted = false): Promise<number> {
    return this.db.count({
      where: {
        ...where,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  async autocomplete(field: string, q: string, limit: number): Promise<AutocompleteHit[]> {
    const rows = await this.db.findMany({
      where: {
        deletedAt: null,
        [field]: { contains: q },
      },
      select: { id: true, [field]: true },
      take: limit,
    });
    return rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      value: String(row[field] ?? ''),
    }));
  }

  private buildWhere(options: QueryOptions): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (options.onlyDeleted) {
      where.deletedAt = { not: null };
    } else if (!options.includeDeleted) {
      where.deletedAt = null;
    }

    const and: Record<string, unknown>[] = [];

    for (const clause of options.filters ?? []) {
      const op = clause.op ?? 'eq';
      switch (op) {
        case 'eq':
          and.push({ [clause.field]: clause.value });
          break;
        case 'neq':
          and.push({ [clause.field]: { not: clause.value } });
          break;
        case 'gt':
          and.push({ [clause.field]: { gt: clause.value } });
          break;
        case 'gte':
          and.push({ [clause.field]: { gte: clause.value } });
          break;
        case 'lt':
          and.push({ [clause.field]: { lt: clause.value } });
          break;
        case 'lte':
          and.push({ [clause.field]: { lte: clause.value } });
          break;
        case 'in':
          and.push({
            [clause.field]: { in: Array.isArray(clause.value) ? clause.value : [clause.value] },
          });
          break;
        case 'contains':
          and.push({ [clause.field]: { contains: String(clause.value) } });
          break;
        case 'startsWith':
          and.push({ [clause.field]: { startsWith: String(clause.value) } });
          break;
        case 'endsWith':
          and.push({ [clause.field]: { endsWith: String(clause.value) } });
          break;
        case 'between':
          if (Array.isArray(clause.value) && clause.value.length >= 2) {
            and.push({ [clause.field]: { gte: clause.value[0], lte: clause.value[1] } });
          }
          break;
        default:
          break;
      }
    }

    if (options.search && options.searchFields?.length) {
      and.push({
        OR: options.searchFields.map((field) => ({
          [field]: { contains: options.search },
        })),
      });
    }

    if (and.length) where.AND = and;
    return where;
  }

  private toPrisma(data: Partial<T>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}
