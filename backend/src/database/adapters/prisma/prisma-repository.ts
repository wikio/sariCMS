import {
  AutocompleteHit,
  BaseEntity,
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../common/crud/interfaces/repository.interface';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RELATION_SCALARS } from './relation-scalars';
import { PRISMA_MODEL_FIELDS } from './model-fields';

const logger = new Logger('PrismaRepository');

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

  /**
   * Les champs que le modèle déclare, ou `null` si le schéma généré ne le décrit
   * pas — auquel cas on ne filtre rien : un faux négatif coûterait des colonnes.
   */
  private declared: ReadonlySet<string> | null | undefined;

  private fieldNames(): ReadonlySet<string> | null {
    if (this.declared === undefined) {
      const list = PRISMA_MODEL_FIELDS[String(this.model || '').toLowerCase()];
      this.declared = list ? new Set(list) : null;
    }
    return this.declared;
  }

  /**
   * Le modèle a-t-il cette colonne ? `true` quand le modèle est inconnu, pour ne
   * jamais retirer un champ par erreur.
   */
  knowsField(name: string): boolean {
    const fields = this.fieldNames();
    return !fields || fields.has(name);
  }

  async findMany(options: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const where = this.buildWhere(options);
    const orderBy = { [options.sortBy ?? 'createdAt']: options.sortOrder ?? 'desc' };

    const [total, rows] = await Promise.all([
      // Gardé comme findMany : sur une table absente, c'est count() qui répond le
      // premier, et son message brut serait arrivé tout seul à l'écran.
      this.db.count({ where }).catch((error: unknown) => this.explainReadError(error)),
      this.db
        .findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        })
        .catch((error: unknown) => this.explainReadError(error)),
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
    const row = await this.db.findUnique({ where: { id } }).catch((error: unknown) => this.explainReadError(error));
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
      .catch((error: unknown) => this.explainReadError(error));
    return (row as T) ?? null;
  }

  async create(data: Partial<T>): Promise<T> {
    let payload: Record<string, unknown> = this.toPrisma(data) as Record<string, unknown>;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        return (await this.db.create({ data: payload })) as T;
      } catch (e: unknown) {
        const msg = String((e as { message?: string })?.message || e);
        const m = /Unknown argument `([^`]+)`/.exec(msg);
        if (m) {
          const field = m[1];
          if (field in payload) {
            this.warnUnknownField(field);
            const { [field]: _drop, ...rest } = payload;
            payload = rest;
            continue;
          }
          const dataRec = data as Record<string, unknown>;
          if (field in dataRec) {
            this.warnUnknownField(field);
            delete (dataRec as Record<string, unknown>)[field];
            payload = this.toPrisma(data) as Record<string, unknown>;
            continue;
          }
        }
        this.explainReadError(e);
        throw e;
      }
    }
    return (await this.db.create({ data: payload })) as T;
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    // Retry loop pour drift schéma : si le client Prisma n'a pas encore la colonne (ex: shippingFee),
    // le DTO envoie le champ, model-fields le laisse passer, mais Prisma jette Unknown argument.
    // On retire le champ incriminé et on rejoue — le statut et les autres champs passent quand même.
    let payload: Record<string, unknown> = this.toPrisma(data) as Record<string, unknown>;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        return (await this.db.update({ where: { id }, data: payload })) as T;
      } catch (e: unknown) {
        const msg = String((e as { message?: string })?.message || e);
        const m = /Unknown argument `([^`]+)`/.exec(msg);
        if (m) {
          const field = m[1];
          if (field in payload) {
            this.warnUnknownField(field);
            const { [field]: _drop, ...rest } = payload;
            payload = rest;
            continue;
          }
          // Champ dans un sous-objet (ex: data.shippingFee) : tente quand même de le retirer du data d'origine
          const dataRec = data as Record<string, unknown>;
          if (field in dataRec) {
            this.warnUnknownField(field);
            delete (dataRec as Record<string, unknown>)[field];
            payload = this.toPrisma(data) as Record<string, unknown>;
            continue;
          }
        }
        // Date cassée ou table absente : le helper nomme le remède, l'erreur remonte traduite
        this.explainReadError(e);
        throw e;
      }
    }
    // Dernier essai sans les champs inconnus (tous retirés)
    return (await this.db.update({ where: { id }, data: payload })) as T;
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

  async deleteOlderThan(field: string, cutoff: Date): Promise<number> {
    const res = await this.db.deleteMany({
      where: { [field]: { lt: cutoff } },
    });
    return res.count ?? 0;
  }

  async count(where: Record<string, unknown> = {}, includeDeleted = false): Promise<number> {
    return this.db
      .count({
        where: {
          ...where,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
      })
      .catch((error: unknown) => this.explainReadError(error));
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
   * Un échec de lecture côté Prisma, traduit en ce que l'exploitant peut faire.
   *
   * Deux familles, parce que les deux se présentent comme « la liste est en erreur »
   * et que les deux remèdes sont à portée de main dans le dépôt :
   *
   * - **P2023**, une ligne date-au-zéro : « The column `updatedAt` contained an
   *   invalid datetime value », sans table ni ligne, avec l'air d'un bug de la
   *   requête en cours — alors qu'une seule date illisible pourrit la lecture de
   *   toute la table.
   * - **P2021 / P2022**, la table ou une colonne absente de CETTE base : le schéma
   *   du dépôt est plus récent que la base (migration non jouée, ou base reprise
   *   hors Prisma). Le message brut — « The table `payment_records` does not exist
   *   in this database » — ne dit pas qu'un fichier SQL additive du dépôt la crée.
   */
  private explainReadError(error: unknown): never {
    const code = (error as { code?: string } | null)?.code;
    const message = (error as { message?: string } | null)?.message || String(error);
    const missing =
      code === 'P2021' ||
      code === 'P2022' ||
      /no such table|Unknown column|does(n'?t| not) exist in (this|the) (current )?database/i.test(message);
    if (missing) {
      const objet = /\bcolumn\b/i.test(message) ? 'une colonne' : 'la table';
      throw new Error(
        `${this.collection}: le schéma de cette base est plus ancien que le code — ${objet} ` +
          `attendue est absente. Le rattrapage n'ajoute que ce qui manque : dans backend/, ` +
          `« npm run db:schema-check » puis « npm run db:schema-fix ». Sans accès Node à la base, ` +
          `jouez dans votre client SQL le fichier additif du dépôt qui crée cette table — ` +
          `backend/sql/migrate-payment-records.mysql.sql pour un relevé d'encaissements, ` +
          `backend/sql/migrate-coupons-taxes.mysql.sql pour coupons et taxes. ` +
          `Deux pièges : « schema.mysql.sql » commence par des DROP, ne le jouez JAMAIS sur une base ` +
          `peuplée ; et « prisma migrate deploy » refuse une base reprise hors Prisma, faute d'historique ` +
          `_prisma_migrations. Le détail technique : ${message.split('\n')[0].slice(0, 200)}`,
      );
    }
    if (code === 'P2023' || /invalid datetime|out of range for the type/i.test(message)) {
      const detail = (message.split('\n').find((line) => /column|datetime/i.test(line)) || '').trim();
      throw new Error(
        `${this.collection}: une ligne porte une date illisible (jour ou mois à zéro, « 0000-00-00 »), ` +
          `ce qui fait échouer la lecture de toute la table. Réparation, au choix : ` +
          `« npm run db:fix-dates » dans backend/ (via la connexion déjà réglée du CMS), ` +
          `ou le fichier backend/sql/fix-zero-dates.mysql.sql dans votre client SQL. ` +
          `Les lignes concernées sont comptées à la section 1 de ce fichier.` +
          (detail ? ` (${detail})` : ''),
      );
    }
    throw error as Error;
  }

  /** Un seul avertissement par champ et par dépôt : le reste du lot n'a rien à voir avec lui. */
  private readonly warnedFields = new Set<string>();

  private warnUnknownField(field: string): void {
    if (this.warnedFields.has(field)) return;
    this.warnedFields.add(field);
    logger.warn(
      `${this.collection}: le modèle \`${this.model}\` ne déclare pas le champ \`${field}\` — ` +
        `il a été écarté de l'écriture pour ne pas faire échouer la ligne. ` +
        `Soit la colonne doit exister : l'ajouter à prisma/schema.prisma, puis « npm run sql:schema » ` +
        `et « npm run db:schema-fix » dans backend/ pour la créer en base. ` +
        `Soit le champ n'a rien à y faire : le retirer de l'expédition (formulaires, DTO, imports).`,
    );
  }

  private toPrisma(data: Partial<T>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const scalars = RELATION_SCALARS[String(this.model || '').toLowerCase()] ?? {};
    const fields = this.fieldNames();
    const provided = new Set(Object.keys(data as Record<string, unknown>));
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v === undefined) continue;
      // Une clé que le modèle ne déclare pas est refusée tout court : Prisma ne
      // répond pas « ce champ est inconnu » et continue, il jette la ligne entière
      // — « Unknown argument `legacyId` » — et avec elle les huit candidatures du
      // lot, la reprise du catalogue en cours, l'écran qui affichait la liste. Le
      // champ vient d'ailleurs que le schéma : un DTO qui a grandi, un JSON repris,
      // une table restée en arrière. Ici il ne peut rien signifier, alors il reste
      // en route, et le message dit où le reprendre.
      if (fields && !fields.has(k) && !scalars[k]) {
        this.warnUnknownField(k);
        continue;
      }
      // Une clé étrangère de relation ne s'écrit pas à la main : depuis que le
      // schéma déclare `career Career? @relation(fields: [careerId]…)`, Prisma
      // refuse `careerId` au `create` (« Unknown argument `careerId`. Did you mean
      // `career`? ») et veut `career: { connect: { id } }`. La colonne se lit,
      // elle ne s'écrit pas — et tous nos émetteurs l'ignorent : le formulaire
      // d'administration, la reprise de catalogue, `crm-sync`, les JSON reprennent
      // la fiche telle quelle, `careerId` compris. Un 500 sur une candidature, un
      // lot abandonné, et rien dans le message qui ressemble au lien métier.
      // Alors la traduction se fait ici, pour toute colonne marquée par le schéma.
      const rel = scalars[k];
      if (rel) {
        // La relation a été fournie telle quelle : elle a raison, on n'y touche pas.
        if (provided.has(rel.relation)) continue;
        if (v === null || v === '') {
          // Déconnecter une relation obligatoire serait une autre 500 ; une colonne
          // NOT NULL ne se vide pas, elle garde ce qu'elle a.
          if (rel.nullable && rel.optionalRelation) out[rel.relation] = { disconnect: true };
          continue;
        }
        const raw = typeof v === 'object' && v !== null ? (v as { id?: unknown }).id : v;
        // Un id numérique passé en chaîne (« "12" », un champ select de formulaire)
        // est refusé tel quel par une colonne Int : le rendre avant de partir.
        const id = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
        if (id !== null && (typeof id === 'number' || typeof id === 'string' || typeof id === 'bigint')) {
          out[rel.relation] = { connect: { [rel.references]: id } };
        }
        continue;
      }
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
