import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppCacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import { AutocompleteQueryDto, QueryDto, ViewMode } from './dto/query.dto';
import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
} from './interfaces/repository.interface';
import { queryDtoToOptions } from './query.util';

export interface ActorContext {
  id?: number;
  email?: string;
  ip?: string;
  userAgent?: string;
}

export interface CrudServiceOptions {
  resource: string;
  searchFields: string[];
  sortableFields?: string[];
  uniqueFields?: string[];
  cacheTtl?: number;
  listFields?: string[];
  cardFields?: string[];
}

@Injectable()
export abstract class BaseCrudService<T extends BaseEntity> {
  protected abstract readonly repository: ICrudRepository<T>;
  protected abstract readonly options: CrudServiceOptions;

  constructor(
    protected readonly cache: AppCacheService,
    protected readonly audit: AuditService,
  ) {}

  protected cacheKey(suffix: string): string {
    return `crud:${this.options.resource}:${suffix}`;
  }

  async findAll(query: QueryDto): Promise<PaginatedResult<unknown>> {
    this.assertSortable(query.sortBy);
    const options = queryDtoToOptions(query, this.options.searchFields);
    const result = await this.repository.findMany(options);
    return {
      data: result.data.map((item) => this.toView(item, query.view ?? 'list')),
      meta: result.meta,
    };
  }

  async findOne(id: number, view: ViewMode = 'block', includeDeleted = false): Promise<unknown> {
    const entity = await this.requireById(id, includeDeleted);
    return this.toView(entity, view);
  }

  async create(dto: Partial<T>, actor?: ActorContext): Promise<unknown> {
    await this.assertUniques(dto);
    const now = new Date();
    const payload = {
      ...this.beforeSave(dto, 'create'),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: actor?.id ?? null,
      updatedBy: actor?.id ?? null,
    } as Partial<T>;
    const created = await this.repository.create(payload);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'create',
      resource: this.options.resource,
      resourceId: created.id,
      payload: this.safeAuditPayload(created),
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return this.toView(created, 'block');
  }

  async update(id: number, dto: Partial<T>, actor?: ActorContext): Promise<unknown> {
    const existing = await this.requireById(id);
    await this.assertUniques(dto, id);
    const payload = {
      ...this.beforeSave(dto, 'update', existing),
      updatedAt: new Date(),
      updatedBy: actor?.id ?? existing.updatedBy ?? null,
    } as Partial<T>;
    const updated = await this.repository.update(id, payload);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'update',
      resource: this.options.resource,
      resourceId: id,
      payload: this.safeAuditPayload(dto),
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return this.toView(updated, 'block');
  }

  async softDelete(id: number, actor?: ActorContext): Promise<unknown> {
    await this.requireById(id);
    const deleted = await this.repository.softDelete(id);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'soft_delete',
      resource: this.options.resource,
      resourceId: id,
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return this.toView(deleted, 'block');
  }

  async restore(id: number, actor?: ActorContext): Promise<unknown> {
    const existing = await this.repository.findById(id, true);
    if (!existing) throw new NotFoundException(`${this.options.resource} not found`);
    if (!existing.deletedAt) {
      throw new BadRequestException('Item is not in the trash');
    }
    const restored = await this.repository.restore(id);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'restore',
      resource: this.options.resource,
      resourceId: id,
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return this.toView(restored, 'block');
  }

  async requestPurge(id: number, actor?: ActorContext): Promise<{ confirm: string; expiresIn: number }> {
    await this.requireById(id, true);
    const token = randomUUID();
    const ttl = Number(process.env.PURGE_CONFIRM_TTL_SECONDS ?? 300);
    await this.cache.set(`purge:${this.options.resource}:${id}`, token, ttl);
    await this.audit.record({
      actorId: actor?.id,
      action: 'purge_requested',
      resource: this.options.resource,
      resourceId: id,
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return { confirm: token, expiresIn: ttl };
  }

  async confirmPurge(id: number, token: string, actor?: ActorContext): Promise<{ deleted: true }> {
    if (!token) {
      throw new BadRequestException('Confirmation token is required for permanent deletion');
    }
    const expected = await this.cache.get<string>(`purge:${this.options.resource}:${id}`);
    if (!expected || expected !== token) {
      throw new BadRequestException('Invalid or expired confirmation token');
    }
    await this.requireById(id, true);
    await this.repository.hardDelete(id);
    await this.cache.del(`purge:${this.options.resource}:${id}`);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'purge',
      resource: this.options.resource,
      resourceId: id,
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return { deleted: true };
  }

  async purgeExpired(olderThan: Date): Promise<number> {
    const count = await this.repository.purgeExpired(olderThan);
    if (count > 0) await this.invalidateCache();
    return count;
  }

  async autocomplete(query: AutocompleteQueryDto): Promise<AutocompleteHit[]> {
    const field = query.field || this.options.searchFields[0] || 'id';
    if (this.options.searchFields.length && !this.options.searchFields.includes(field) && field !== 'id') {
      throw new BadRequestException(`Field ${field} is not searchable`);
    }
    return this.repository.autocomplete(field, query.q, query.limit ?? 10);
  }

  async trash(query: QueryDto): Promise<PaginatedResult<unknown>> {
    return this.findAll({ ...query, onlyDeleted: true, includeDeleted: true });
  }

  protected toView(entity: T, view: ViewMode): unknown {
    const clone = this.sanitize(entity);
    if (view === 'block') return clone;
    const fields =
      view === 'card'
        ? this.options.cardFields ?? this.options.listFields
        : this.options.listFields;
    if (!fields?.length) return clone;
    const picked: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in clone) picked[field] = clone[field];
    }
    return picked;
  }

  protected sanitize(entity: T): Record<string, unknown> {
    const clone = { ...entity } as Record<string, unknown>;
    delete clone.passwordHash;
    delete clone.totpSecret;
    delete clone.partnerKey;
    return clone;
  }

  protected beforeSave(dto: Partial<T>, _op: 'create' | 'update', _existing?: T): Partial<T> {
    return { ...dto };
  }

  protected safeAuditPayload(data: unknown): Record<string, unknown> | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const clone = { ...(data as Record<string, unknown>) };
    delete clone.password;
    delete clone.passwordHash;
    delete clone.totpSecret;
    delete clone.totpCode;
    delete clone.partnerKey;
    delete clone.refreshToken;
    return clone;
  }

  protected async requireById(id: number, includeDeleted = false): Promise<T> {
    const entity = await this.repository.findById(id, includeDeleted);
    if (!entity) throw new NotFoundException(`${this.options.resource} not found`);
    return entity;
  }

  protected async assertUniques(dto: Partial<T>, excludeId?: number): Promise<void> {
    const fields = this.options.uniqueFields ?? [];
    for (const field of fields) {
      const value = (dto as Record<string, unknown>)[field];
      if (value === undefined || value === null || value === '') continue;
      const existing = await this.repository.findOne({ [field]: value }, true);
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(`${field} already in use`);
      }
    }
  }

  protected assertSortable(sortBy?: string): void {
    if (!sortBy) return;
    const allowed = this.options.sortableFields ?? [
      'createdAt',
      'updatedAt',
      'id',
      ...this.options.searchFields,
    ];
    if (!allowed.includes(sortBy)) {
      throw new BadRequestException(`Cannot sort by ${sortBy}`);
    }
  }

  protected async invalidateCache(): Promise<void> {
    await this.cache.delByPrefix(`crud:${this.options.resource}:`);
  }
}
