import { FilterClause, FilterOperator, QueryOptions } from './interfaces/repository.interface';
import { QueryDto } from './dto/query.dto';

const OPS: FilterOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
  'startsWith',
  'endsWith',
  'between',
];

export function normalizeFilters(raw?: Record<string, unknown>): FilterClause[] {
  if (!raw) return [];
  const clauses: FilterClause[] = [];
  for (const [field, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      const isOpObject = keys.every((k) => OPS.includes(k as FilterOperator));
      if (isOpObject) {
        for (const [op, v] of Object.entries(obj)) {
          clauses.push({ field, op: op as FilterOperator, value: coerce(v) });
        }
        continue;
      }
    }
    clauses.push({ field, op: 'eq', value: coerce(value) });
  }
  return clauses;
}

function coerce(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.includes(',') && !value.includes(' ')) {
    return value.split(',').map((v) => coerce(v.trim()));
  }
  return value;
}

export function queryDtoToOptions(dto: QueryDto, searchFields: string[]): QueryOptions {
  return {
    page: dto.page ?? 1,
    limit: dto.limit ?? 20,
    sortBy: dto.sortBy,
    sortOrder: dto.sortOrder ?? 'desc',
    search: dto.search,
    searchFields,
    filters: normalizeFilters(dto.filter),
    includeDeleted: dto.includeDeleted,
    onlyDeleted: dto.onlyDeleted,
  };
}

export function matchFilter(record: Record<string, unknown>, clause: FilterClause): boolean {
  const current = getPath(record, clause.field);
  const op = clause.op ?? 'eq';
  const expected = clause.value;

  switch (op) {
    case 'eq':
      return equalsLoose(current, expected);
    case 'neq':
      return !equalsLoose(current, expected);
    case 'gt':
      return comparable(current) > comparable(expected);
    case 'gte':
      return comparable(current) >= comparable(expected);
    case 'lt':
      return comparable(current) < comparable(expected);
    case 'lte':
      return comparable(current) <= comparable(expected);
    case 'in':
      return Array.isArray(expected)
        ? expected.some((v) => equalsLoose(current, v))
        : equalsLoose(current, expected);
    case 'contains':
      return String(current ?? '')
        .toLowerCase()
        .includes(String(expected ?? '').toLowerCase());
    case 'startsWith':
      return String(current ?? '')
        .toLowerCase()
        .startsWith(String(expected ?? '').toLowerCase());
    case 'endsWith':
      return String(current ?? '')
        .toLowerCase()
        .endsWith(String(expected ?? '').toLowerCase());
    case 'between':
      if (!Array.isArray(expected) || expected.length < 2) return false;
      return comparable(current) >= comparable(expected[0]) && comparable(current) <= comparable(expected[1]);
    default:
      return true;
  }
}

export function getPath(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, record);
}

function equalsLoose(a: unknown, b: unknown): boolean {
  if (a instanceof Date) a = a.toISOString();
  if (b instanceof Date) b = b.toISOString();
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  return String(a ?? '') === String(b ?? '');
}

function comparable(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const asDate = Date.parse(String(value));
  if (!Number.isNaN(asDate) && String(value).length >= 8) return asDate;
  const asNum = Number(value);
  return Number.isNaN(asNum) ? 0 : asNum;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
