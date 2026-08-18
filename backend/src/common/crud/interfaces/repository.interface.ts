export interface BaseEntity {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export type SortOrder = 'asc' | 'desc';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'between';

export interface FilterClause {
  field: string;
  op?: FilterOperator;
  value: unknown;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  search?: string;
  searchFields?: string[];
  filters?: FilterClause[];
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AutocompleteHit {
  id: string;
  value: string;
  extra?: Record<string, unknown>;
}

export interface ICrudRepository<T extends BaseEntity> {
  readonly collection: string;

  findMany(options: QueryOptions): Promise<PaginatedResult<T>>;
  findById(id: string, includeDeleted?: boolean): Promise<T | null>;
  findOne(where: Record<string, unknown>, includeDeleted?: boolean): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  softDelete(id: string): Promise<T>;
  restore(id: string): Promise<T>;
  hardDelete(id: string): Promise<void>;
  purgeExpired(olderThan: Date): Promise<number>;
  count(where?: Record<string, unknown>, includeDeleted?: boolean): Promise<number>;
  autocomplete(field: string, q: string, limit: number): Promise<AutocompleteHit[]>;
}

export type RepositoryFactory = <T extends BaseEntity>(collection: string) => ICrudRepository<T>;
