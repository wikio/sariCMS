import { Model } from 'mongoose';
import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../common/crud/interfaces/repository.interface';

/**
 * Mongoose adapter. Registered only when DB_DRIVER=mongodb.
 * Services never import mongoose — they stay on ICrudRepository.
 */
export class MongoRepository<T extends BaseEntity> implements ICrudRepository<T> {
  constructor(
    public readonly collection: string,
    private readonly model: Model<any>,
  ) {}

  async findMany(options: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const filter = this.buildFilter(options);
    const sortField = options.sortBy ?? 'createdAt';
    const sortDir = options.sortOrder === 'asc' ? 1 : -1;

    const [total, rows] = await Promise.all([
      this.model.countDocuments(filter),
      this.model
        .find(filter)
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      data: rows.map((r) => this.toEntity(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findById(id: number, includeDeleted = false): Promise<T | null> {
    const row = await this.model.findOne({ id }).lean().exec();
    if (!row) return null;
    const doc = row as Record<string, unknown>;
    if (doc.deletedAt && !includeDeleted) return null;
    return this.toEntity(doc);
  }

  async findOne(where: Record<string, unknown>, includeDeleted = false): Promise<T | null> {
    const filter = { ...where };
    if (!includeDeleted) filter.deletedAt = null;
    const row = await this.model.findOne(filter).lean().exec();
    return row ? this.toEntity(row as Record<string, unknown>) : null;
  }

  async create(data: Partial<T>): Promise<T> {
    // Mongo n'a pas d'auto-incrément : fallback numérique (driver optionnel).
    if (data.id === undefined) (data as Record<string, unknown>).id = Date.now();
    const created = await this.model.create(data);
    return this.toEntity(created.toObject());
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const row = await this.model
      .findOneAndUpdate({ id }, { $set: data }, { new: true })
      .lean()
      .exec();
    return this.toEntity((row ?? {}) as Record<string, unknown>);
  }

  async softDelete(id: number): Promise<T> {
    return this.update(id, { deletedAt: new Date() } as Partial<T>);
  }

  async restore(id: number): Promise<T> {
    return this.update(id, { deletedAt: null } as Partial<T>);
  }

  async hardDelete(id: number): Promise<void> {
    await this.model.deleteOne({ id }).exec();
  }

  async purgeExpired(olderThan: Date): Promise<number> {
    const res = await this.model
      .deleteMany({ deletedAt: { $ne: null, $lte: olderThan } })
      .exec();
    return res.deletedCount ?? 0;
  }

  async count(where: Record<string, unknown> = {}, includeDeleted = false): Promise<number> {
    const filter = { ...where };
    if (!includeDeleted) filter.deletedAt = null;
    return this.model.countDocuments(filter);
  }

  async autocomplete(field: string, q: string, limit: number): Promise<AutocompleteHit[]> {
    const rows = await this.model
      .find({ deletedAt: null, [field]: { $regex: q, $options: 'i' } })
      .select({ id: 1, [field]: 1 })
      .limit(limit)
      .lean()
      .exec();
    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      value: String(row[field] ?? ''),
    }));
  }

  private buildFilter(options: QueryOptions): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (options.onlyDeleted) filter.deletedAt = { $ne: null };
    else if (!options.includeDeleted) filter.deletedAt = null;

    const and: Record<string, unknown>[] = [];
    for (const clause of options.filters ?? []) {
      const op = clause.op ?? 'eq';
      switch (op) {
        case 'eq':
          and.push({ [clause.field]: clause.value });
          break;
        case 'neq':
          and.push({ [clause.field]: { $ne: clause.value } });
          break;
        case 'gt':
          and.push({ [clause.field]: { $gt: clause.value } });
          break;
        case 'gte':
          and.push({ [clause.field]: { $gte: clause.value } });
          break;
        case 'lt':
          and.push({ [clause.field]: { $lt: clause.value } });
          break;
        case 'lte':
          and.push({ [clause.field]: { $lte: clause.value } });
          break;
        case 'in':
          and.push({
            [clause.field]: { $in: Array.isArray(clause.value) ? clause.value : [clause.value] },
          });
          break;
        case 'contains':
          and.push({ [clause.field]: { $regex: String(clause.value), $options: 'i' } });
          break;
        case 'startsWith':
          and.push({ [clause.field]: { $regex: `^${clause.value}`, $options: 'i' } });
          break;
        case 'endsWith':
          and.push({ [clause.field]: { $regex: `${clause.value}$`, $options: 'i' } });
          break;
        case 'between':
          if (Array.isArray(clause.value) && clause.value.length >= 2) {
            and.push({ [clause.field]: { $gte: clause.value[0], $lte: clause.value[1] } });
          }
          break;
        default:
          break;
      }
    }

    if (options.search && options.searchFields?.length) {
      and.push({
        $or: options.searchFields.map((field) => ({
          [field]: { $regex: options.search, $options: 'i' },
        })),
      });
    }

    if (and.length) filter.$and = and;
    return filter;
  }

  private toEntity(row: Record<string, unknown>): T {
    const { _id, __v, ...rest } = row;
    return rest as T;
  }
}
