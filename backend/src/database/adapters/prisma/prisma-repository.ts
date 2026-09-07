import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../common/crud/interfaces/repository.interface';
import { PrismaService } from './prisma.service';

/**
 * Colonnes de date : elles se reconnaissent à leur nom — `date` nu, ou un suffixe
 * `At` / `Date`. C'est là que le piège se referme : une valeur vide ou fausse y
 * devient un « 0000-00-00 » que plus personne ne relit ensuite. Ni `readTime` ni
 * `deliveryTime` n'y passent : ce sont des durées en minutes, pas des dates. Un
 * texte (`title`, `subtitle`, `content`) garde sa valeur vide, qui veut dire « effacé ».
 */
const DATE_COLUMN = /(^date$|At$|Date$)/;
const NOT_NULL_DATES = new Set(['createdAt', 'updatedAt', 'expiresAt']);

/** `0000-00-00`, `2026-00-11`, `2026-07-00` : MySQL les accepte, Prisma les lit mal. */
function isBrokenDate(value: unknown): boolean {
  if (value === '' || value === null) return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  const text = String(value).trim();
  if (!text) return true;
  if (/^\d{4}-0?0-\d{2}/.test(text) || /^\d{4}-\d{2}-0?0\b/.test(text) || /^0000/.test(text)) return true;
  // Une date lisible pour MySQL ne l'est pas forcément pour nous : `2026-13-45`.
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(text);
  if (iso) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return true;
  }
  return false;
}

/**
 * « 2026-07-15 » (un `input type="date"`) et « 2026-07-15T10:30 » (un
 * `input type="datetime-local"`) ne sont PAS des DateTime pour Prisma : il veut
 * un objet `Date` ou un horodatage complet avec fuseau. La valeur était refusée
 * avant même d'atteindre MySQL — « Invalid value for argument `date`: premature
 * end of input » — et faisait tomber en 500 toute une reprise de catalogue, où
 * chaque fichier JSON porte des dates sans heure. Une date seule vaut donc
 * minuit UTC, une heure sans fuseau se lit aussi en UTC : le fuseau d'affichage
 * regarde le front, pas la colonne.
 */
const DATE_ONLY_RE = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2}))?(?:[.,](\d{1,3}))?)?$/;
function toPrismaDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const parts = DATE_ONLY_RE.exec(value.trim());
  if (!parts) return value; // ISO complet, fuseau déjà là, ou texte libre
  const clock = parts[2]
    ? `${parts[2]}:${parts[3] ?? '00'}.${(parts[4] ?? '0').padEnd(3, '0')}`
    : '00:00:00.000';
  const date = new Date(`${parts[1]}T${clock}Z`);
  return Number.isNaN(date.getTime()) ? value : date;
}

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
      this.db
        .findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        })
        .catch((error: unknown) => this.explainDate(error)),
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
    const row = await this.db.findUnique({ where: { id } }).catch((error: unknown) => this.explainDate(error));
    if (!row) return null;
    if (row.deletedAt && !includeDeleted) return null;
    return row as T;
  }

  async findOne(where: Record<string, unknown>, includeDeleted = false): Promise<T | null> {
    const row = await this.db
      .findFirst({
      where: {
        ...where,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    })
      .catch((error: unknown) => this.explainDate(error));
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
      // Une date au format court dans un filtre serait rejetée par Prisma avant
      // même que la requête parte : on lui applique la même remise en forme qu'à
      // l'écriture. Un tableau (`between`, `in`) se traite case par case.
      const value = DATE_COLUMN.test(clause.field)
        ? Array.isArray(clause.value)
          ? clause.value.map(toPrismaDate)
          : toPrismaDate(clause.value)
        : clause.value;
      switch (op) {
        case 'eq':
          and.push({ [clause.field]: value });
          break;
        case 'neq':
          and.push({ [clause.field]: { not: value } });
          break;
        case 'gt':
          and.push({ [clause.field]: { gt: value } });
          break;
        case 'gte':
          and.push({ [clause.field]: { gte: value } });
          break;
        case 'lt':
          and.push({ [clause.field]: { lt: value } });
          break;
        case 'lte':
          and.push({ [clause.field]: { lte: value } });
          break;
        case 'in':
          and.push({
            [clause.field]: { in: Array.isArray(value) ? value : [value] },
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
          if (Array.isArray(value) && value.length >= 2) {
            and.push({ [clause.field]: { gte: value[0], lte: value[1] } });
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

  /**
   * Un PrismaClientKnownRequestError P2023 sur une liste ne disait rien d'utile :
   * « The column `updatedAt` contained an invalid datetime value… », sans table,
   * sans ligne, et avec l'air d'un bug de la requête en cours — alors qu'une seule
   * ligne date-au-zéro pourrit la lecture de toute la table. Le message renvoyé
   * porte désormais le diagnostic et la correction.
   */
  private explainDate(error: unknown): never {
    const code = (error as { code?: string } | null)?.code;
    const message = (error as { message?: string } | null)?.message || String(error);
    if (code === 'P2023' || /invalid datetime|out of range for the type/i.test(message)) {
      throw new Error(
        `${this.collection}: une ligne porte une date illisible (jour ou mois à zéro, « 0000-00-00 »), ` +
          `ce qui fait échouer la lecture de toute la table. Diagnostic et réparation : ` +
          `backend/sql/fix-zero-dates.mysql.sql (${message.split('\n')[0]})`,
      );
    }
    throw error as Error;
  }

  private toPrisma(data: Partial<T>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v === undefined) continue;
      // Une date vide, nulle ou fausse ne part pas en base : MySQL en ferait un
      // « 0000-00-00 », que l'ORM ne sait plus relire ensuite. Une colonne facultative
      // reçoit NULL — c'est ce que « pas de date » veut dire ; une colonne NOT NULL est
      // simplement omise, et son défaut (ou `@updatedAt`) s'applique. Sinon la valeur
      // est remise au format que Prisma attend.
      if (DATE_COLUMN.test(k)) {
        if (isBrokenDate(v)) {
          if (!NOT_NULL_DATES.has(k)) out[k] = null;
          continue;
        }
        out[k] = toPrismaDate(v);
        continue;
      }
      out[k] = v;
    }
    return out;
  }
}
