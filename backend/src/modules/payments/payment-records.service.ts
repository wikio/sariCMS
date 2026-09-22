import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { PAYMENT_RECORD_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { toNumberOr, toNumberOrNull } from '../../common/crud/coerce';
import { ViewMode } from '../../common/crud/dto/query.dto';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { SyncPaymentRecordsDto } from './dto/payment-record.dto';
import { PaymentRecordEntity } from './entities/payment-record.entity';

/** Colonnes renvoyées à l'interface — l'écran affiche tout, y compris la note. */
const FIELDS = [
  'id',
  'externalId',
  'orderId',
  'orderCode',
  'client',
  'email',
  'method',
  'methodName',
  'amount',
  'status',
  'cardLast4',
  'note',
  'date',
  'validatedAt',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Une date de transaction, en tolérant ce que le navigateur savait déjà écrire.
 *
 * Le magasin local stockait des ISO complètes ; l'écran de saisie, une chaîne
 * `AAAA-MM-JJ`. Une date absente ou illisible n'est pas une raison pour rejeter
 * un encaissement réel : on retombe sur l'horodatage du serveur, et le service
 * le signale dans le message de synthèse plutôt qu'en silence.
 */
function parseDate(value: unknown): { date: Date; fellBack: boolean } {
  const parsed = new Date(String(value ?? ''));
  if (value && !Number.isNaN(parsed.getTime())) return { date: parsed, fellBack: false };
  return { date: new Date(), fellBack: true };
}

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

@Injectable()
export class PaymentRecordsService extends BaseCrudService<PaymentRecordEntity> {
  protected readonly repository: ICrudRepository<PaymentRecordEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'payment-records',
    // Journal comptable, pas un contenu traduisible : pas de colonne `legacyId`.
    hasLegacyId: false,
    searchFields: ['client', 'email', 'orderCode', 'note'],
    sortableFields: ['date', 'amount', 'status', 'client', 'createdAt', 'updatedAt'],
    // `externalId` est unique en base : c'est ce qui rend un double envoi inoffensif.
    uniqueFields: ['externalId'],
    listFields: [...FIELDS],
    cardFields: [...FIELDS],
  };

  constructor(
    @Inject(PAYMENT_RECORD_REPOSITORY) repository: ICrudRepository<PaymentRecordEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  /** Toutes les lignes non supprimées, de la plus récente — ce que lit l'écran. */
  async listAll(): Promise<unknown[]> {
    const result = await this.repository.findMany({
      page: 1,
      limit: 2000,
      sortBy: 'date',
      sortOrder: 'desc',
    });
    return result.data.map((row) => this.toView(row, 'block'));
  }

  /**
   * Envoi par lot depuis l'écran (et depuis le parcours de commande).
   *
   * Appariement par `externalId` d'abord — c'est l'identifiant que le poste
   * s'est donné à lui-même, et le seul que deux postes different sans ambiguïté ;
   * puis par `id` numérique, pour un poste qui aurait déjà reçu la ligne en
   * provenance de la base. Aucune correspondance → création.
   *
   * Les suppressions viennent de `dto.removed`, jamais des absences : un poste
   * partiellement à jour ne doit pas pouvoir effacer un encaissement enregistré
   * ailleurs. C'est la règle qui vaut pour un journal, et elle est plus stricte
   * que pour un catalogue : une ligne de paiement manquante n'est pas une ligne
   * supprimée par quelqu'un, le plus souvent.
   */
  async sync(
    dto: SyncPaymentRecordsDto,
    actor?: ActorContext,
  ): Promise<{
    created: number;
    updated: number;
    removed: number;
    repaired: number;
    records: unknown[];
  }> {
    const incoming = Array.isArray(dto.records) ? dto.records : [];
    const counters = { created: 0, updated: 0, removed: 0, repaired: 0 };

    for (const row of incoming) {
      const payload = this.toEntity(row as unknown as Record<string, unknown>);
      if (payload.dateFellBack) counters.repaired += 1;
      const existing = await this.matchExisting(payload.externalId, row.id);
      if (existing) {
        await super.update(existing.id, payload.entity, actor);
        counters.updated += 1;
      } else {
        await super.create(payload.entity, actor);
        counters.created += 1;
      }
    }

    for (const externalId of dto.removed ?? []) {
      const found = await this.repository.findOne({ externalId }, false);
      if (!found) continue;
      await this.softDelete(found.id, actor);
      counters.removed += 1;
    }

    return { ...counters, records: await this.listAll() };
  }

  /* ------------------------------------------------------------------ */

  /**
   * Forme HTTP → colonnes.
   *
   * `externalId` est obligatoire en base (contrainte d'unicité) mais le poste
   * l'a toujours fourni ; un envoi qui l'omet — appel direct de l'API, import —
   * reçoit un identifiant plutôt qu'une erreur, parce qu'une écriture refusée
   * perdrait la ligne, alors qu'un identifiant attribué ici ne fait que la rendre
   * retrouvables plus tard.
   */
  private toEntity(row: Record<string, unknown>): {
    entity: Partial<PaymentRecordEntity>;
    dateFellBack: boolean;
    externalId: string;
  } {
    const externalId = String(row.externalId ?? row.id ?? '').trim() || this.mintExternalId();
    const { date, fellBack } = parseDate(row.date ?? row.createdAt);
    const entity: Partial<PaymentRecordEntity> = {
      externalId,
      orderId: toNumberOrNull(row.orderId),
      orderCode: typeof row.orderCode === 'string' ? row.orderCode.trim() || null : null,
      client: String(row.client ?? '').trim(),
      email: typeof row.email === 'string' ? row.email.trim() || null : null,
      method: String(row.method ?? 'transfer').trim().slice(0, 24),
      methodName: typeof row.methodName === 'string' ? row.methodName.trim().slice(0, 60) : null,
      amount: toNumberOr(row.amount, 0),
      status: row.status === 'validated' || row.status === 'rejected' ? row.status : 'pending',
      // Quatre chiffres ou rien : une valeur tronquée afficherait un masque
      // mensonger (`**** 42`), et un masque erroné dans un relevé bancaire est une
      // information fausse, pas une information incomplète.
      cardLast4: (() => {
        const digits = typeof row.cardLast4 === 'string' ? row.cardLast4.replace(/\D/g, '') : '';
        if (digits.length === 4) return digits;
        // « Les quatre derniers » se lit en FIN de numéro : un opérateur qui colle
        // le PAN entier dans le champ doit voir les vrais derniers chiffres, et
        // surtout les douze autres sont jetés ici — la colonne n'a pas à les
        // recevoir, et `slice(0, 4)` aurait gardé le début du numéro.
        if (digits.length > 4) return digits.slice(-4);
        // Moins de quatre : rien plutôt qu'un `**** 42` mensonger dans un relevé.
        return null;
      })(),
      note: typeof row.note === 'string' ? row.note : null,
      date,
      validatedAt: isoOrNull(row.validatedAt),
    };
    if (!entity.client) throw new BadRequestException('un encaissement sans nom de client est refusé');
    return { entity, dateFellBack: fellBack, externalId };
  }

  /**
   * Projection de sortie : la sienne, plus deux retouches.
   *
   * Surcharger `toView` plutôt qu'en définir une seconde, parce que la version de
   * base fait le tri de colonnes (`listFields`, `cardFields`) et le nettoyage des
   * champs sensibles ; les court-circuiter rendrait la liste paginée différente de
   * `/all`, et un écran qui change d'endpoint verrait disparaître un champ.
   *
   * - dates en ISO : c'est la forme que le magasin local donnait à l'écran, et
   *   `toLocaleString` sur une chaîne ISO s'affiche déjà ;
   * - `cardMasked` déduit de `cardLast4`, jamais stocké : deux colonnes pour une
   *   seule information, c'est deux valeurs qui peuvent se contredire.
   */
  protected override toView(entity: PaymentRecordEntity, view: ViewMode): unknown {
    const out = super.toView(entity, view) as Record<string, unknown>;
    for (const field of ['date', 'validatedAt'] as const) {
      const value = out[field];
      if (value instanceof Date) out[field] = value.toISOString();
    }
    // Colonne DECIMAL : le client Prisma rend un objet `Decimal`, qui part en JSON
    // sous forme de chaîne « 18500.00 ». Un relevé s'additionne et se compare ;
    // laisser la chaîne s'appeler, c'est voir le total devenir une concaténation.
    // Les montants de `orders` sortent tels quels — ici on sait ce qui en est fait.
    if (out.amount !== null && out.amount !== undefined) out.amount = Number(out.amount);
    const last4 = typeof out.cardLast4 === 'string' ? out.cardLast4 : '';
    out.cardMasked = /^\d{4}$/.test(last4) ? `**** **** **** ${last4}` : undefined;
    return out;
  }

  private async matchExisting(
    externalId: string,
    id: unknown,
  ): Promise<PaymentRecordEntity | null> {
    const byExternal = await this.repository.findOne({ externalId }, false);
    if (byExternal) return byExternal;
    const numericId = Number(id);
    if (Number.isInteger(numericId) && numericId > 0) {
      return this.repository.findById(numericId, false);
    }
    return null;
  }

  private mintExternalId(): string {
    return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
