import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import {
  ICrudRepository,
  PaginatedResult,
  QueryOptions,
} from '../../common/crud/interfaces/repository.interface';
import { PaymentRecordsService } from './payment-records.service';
import { PaymentRecordEntity } from './entities/payment-record.entity';

/**
 * Dépôt en mémoire, volontairement minimal.
 *
 * Assez fidèle pour porter les règles qui comptent ici : tri par date, exclusion
 * de la corbeille, recherche par n'importe quelle colonne (`externalId` comme
 * `id`). Ce ne sont PAS des comportements de décoration — c'est par là que passe
 * l'idempotence de la synchronisation, et donc l'absence de doublons dans un
 * relevé comptable.
 */
class MemoryRepo implements Partial<ICrudRepository<PaymentRecordEntity>> {
  readonly collection = 'payment-records';
  rows: PaymentRecordEntity[] = [];
  private seq = 0;

  async findMany(options: QueryOptions): Promise<PaginatedResult<PaymentRecordEntity>> {
    let rows = this.rows.filter((r) => !r.deletedAt);
    if (options.sortBy) {
      const key = options.sortBy;
      const dir = options.sortOrder === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const x = (a as unknown as Record<string, unknown>)[key];
        const y = (b as unknown as Record<string, unknown>)[key];
        return (String(x ?? '') > String(y ?? '') ? 1 : -1) * dir;
      });
    }
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: 2000, totalPages: 1 },
    };
  }

  async findById(id: number): Promise<PaymentRecordEntity | null> {
    return this.rows.find((r) => r.id === id && !r.deletedAt) ?? null;
  }

  async findOne(where: Record<string, unknown>): Promise<PaymentRecordEntity | null> {
    return (
      this.rows.find(
        (r) =>
          !r.deletedAt &&
          Object.entries(where).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ),
      ) ?? null
    );
  }

  async create(data: Partial<PaymentRecordEntity>): Promise<PaymentRecordEntity> {
    const now = new Date().toISOString();
    const row = { ...data, id: ++this.seq, createdAt: now, updatedAt: now, deletedAt: null } as PaymentRecordEntity;
    this.rows.push(row);
    return row;
  }

  async update(id: number, data: Partial<PaymentRecordEntity>): Promise<PaymentRecordEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new BadRequestException('introuvable');
    Object.assign(row, data, { updatedAt: new Date().toISOString() });
    return row;
  }

  async softDelete(id: number): Promise<PaymentRecordEntity> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new BadRequestException('introuvable');
    row.deletedAt = new Date().toISOString();
    return row;
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return this.rows.filter(
      (r) =>
        !r.deletedAt &&
        (!where ||
          Object.entries(where).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          )),
    ).length;
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

function makeService() {
  const repo = new MemoryRepo();
  const service = new PaymentRecordsService(
    repo as unknown as ICrudRepository<PaymentRecordEntity>,
    mockCache(),
    mockAudit(),
  );
  return { repo, service };
}

/** Une ligne telle que l'interface l'envoie : identifiant local, montant nombre, date ISO. */
const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  externalId: 'pr1',
  client: 'Clinique Atlas',
  method: 'transfer',
  amount: 18500,
  status: 'pending',
  date: '2026-09-01T10:00:00.000Z',
  ...over,
});

type View = Record<string, unknown>;

describe('PaymentRecordsService', () => {
  describe('sync — idempotence', () => {
    it('crée une ligne absente de la base et renvoie le relevé reconstitué', async () => {
      const { service, repo } = makeService();
      const result = await service.sync({ records: [row()] } as never);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(repo.rows).toHaveLength(1);
      expect(result.records).toHaveLength(1);
    });

    it('un second envoi avec le même `externalId` met à jour au lieu de dupliquer', async () => {
      const { service, repo } = makeService();
      await service.sync({ records: [row()] } as never);
      const result = await service.sync({ records: [row({ amount: 21000 })] } as never);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
      // C'est LA garantie attendue d'un journal : un double envoi (onglet rouvert
      // trop vite, reprise après réseau instable) ne doit jamais faire apparaître
      // un second encaissement de 18 500 € dans les totaux.
      expect(repo.rows).toHaveLength(1);
      expect(Number(repo.rows[0].amount)).toBe(21000);
    });

    it('deux lignes de même `externalId` dans un seul envoi ne se cognent pas', async () => {
      const { service, repo } = makeService();
      const result = await service.sync({
        records: [row({ amount: 100 }), row({ amount: 300 })],
      } as never);
      expect(repo.rows).toHaveLength(1);
      expect(Number(repo.rows[0].amount)).toBe(300);
      expect(result.created + result.updated).toBe(2);
    });

    it('un envoi sans `externalId` reçoit un identifiant et reste retrouvable', async () => {
      const { service, repo } = makeService();
      const { externalId, ...sans } = row();
      await service.sync({ records: [sans] } as never);
      expect(typeof repo.rows[0].externalId).toBe('string');
      expect(String(repo.rows[0].externalId).length).toBeGreaterThan(4);
      // Le rejet viendrait d'une contrainte NOT NULL ; l'attribuer rend la ligne
      // rattrapable par le poste au chargement suivant.
      const again = await service.sync({ records: [{ ...sans, externalId: repo.rows[0].externalId, amount: 5 } as never] } as never);
      expect(again.created).toBe(0);
      expect(again.updated).toBe(1);
    });
  });

  describe('sync — règle comptable sur les suppressions', () => {
    it('ne retire que les identifiants nommés dans `removed`', async () => {
      const { service, repo } = makeService();
      await service.sync({ records: [row({ externalId: 'a' }), row({ externalId: 'b' })] } as never);
      // `b` est absent de l'envoi mais pas de `removed` : un poste partiellement à
      // jour ne doit pas pouvoir effacer ce qu'un autre a enregistré.
      const result = await service.sync({ records: [row({ externalId: 'a' })], removed: ['b'] } as never);
      expect(result.removed).toBe(1);
      expect(repo.rows.find((r) => r.externalId === 'a')?.deletedAt).toBeNull();
      expect(repo.rows.find((r) => r.externalId === 'b')?.deletedAt).not.toBeNull();
    });

    it('un envoi vide ne vide pas le relevé', async () => {
      const { service, repo } = makeService();
      await service.sync({ records: [row({ externalId: 'a' }), row({ externalId: 'b' })] } as never);
      const result = await service.sync({ records: [] } as never);
      expect(result.removed).toBe(0);
      expect(repo.rows.filter((r) => !r.deletedAt)).toHaveLength(2);
    });

    it('un `removed` inconnu est ignoré, sans erreur', async () => {
      const { service } = makeService();
      const result = await service.sync({ records: [], removed: ['Fantôme'] } as never);
      expect(result.removed).toBe(0);
    });
  });

  describe('toEntity — ce que le navigateur savait écrire', () => {
    it('accepte un montant en chaîne, venue d’un champ nombre ou d’un DECIMAL', async () => {
      const { service, repo } = makeService();
      await service.sync({ records: [row({ amount: '18500.00' })] } as never);
      expect(Number(repo.rows[0].amount)).toBe(18500);
    });

    it('une écriture sans client est refusée', async () => {
      const { service } = makeService();
      await expect(service.sync({ records: [row({ client: '   ' })] } as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('un statut inconnu retombe sur `pending`', async () => {
      const { service, repo } = makeService();
      await service.sync({ records: [row({ status: 'validé 🙂' })] } as never);
      // Un relevé où s'infiltre un statut que personne ne sait traiter est un
      // relevé dont les totaux deviennent ininterprétables.
      expect(repo.rows[0].status).toBe('pending');
    });

    it('les quatre derniers chiffres ne passent que complets', async () => {
      const { service, repo } = makeService();
      await service.sync({ records: [row({ externalId: 'a', cardLast4: '4242' })] } as never);
      await service.sync({ records: [row({ externalId: 'b', cardLast4: '4242 1234 5678 9012' })] } as never);
      await service.sync({ records: [row({ externalId: 'c', cardLast4: '42' })] } as never);
      expect(repo.rows[0].cardLast4).toBe('4242');
      // PAN collé en entier : on garde la FIN (les vrais derniers chiffres) et le
      // reste est jeté — la colonne ne contient jamais le numéro.
      expect(repo.rows[1].cardLast4).toBe('9012');
      // `**** 42` serait un masque mensonger ; rien vaut mieux que faux.
      expect(repo.rows[2].cardLast4).toBeNull();
    });

    it('une date courte est acceptée, une date absente est signalée', async () => {
      const { service, repo } = makeService();
      const result = await service.sync({
        records: [row({ externalId: 'a', date: '2026-09-02' }), row({ externalId: 'b', date: '' })],
      } as never);
      expect(repo.rows[0].date).toBeInstanceOf(Date);
      expect((repo.rows[0].date as Date).toISOString().slice(0, 10)).toBe('2026-09-02');
      // Rejeter une écriture pour une date manquante ferait perdre un encaissement
      // réel ; on horodate et on le dit.
      expect(result.repaired).toBe(1);
    });
  });

  describe('toView — la forme que l’écran attend', () => {
    it('rend le montant en nombre, les dates en ISO et le masque déduit', async () => {
      const { service } = makeService();
      await service.sync({
        records: [row({ cardLast4: '4242', validatedAt: '2026-09-03T08:00:00.000Z' })],
      } as never);
      const [view] = (await service.listAll()) as View[];
      expect(typeof view.amount).toBe('number');
      expect(view.date).toBe('2026-09-01T10:00:00.000Z');
      expect(view.validatedAt).toBe('2026-09-03T08:00:00.000Z');
      expect(view.cardMasked).toBe('**** **** **** 4242');
      // La colonne n'existe pas en base : elle ne peut donc pas se contredire avec
      // les quatre chiffres.
      expect(Object.keys(view)).not.toContain('cardMaskedColumn');
    });

    it('ne rend pas de masque quand il n’y a pas de carte', async () => {
      const { service } = makeService();
      await service.sync({ records: [row({ method: 'cash' })] } as never);
      const [view] = (await service.listAll()) as View[];
      expect(view.cardMasked).toBeUndefined();
    });

    it('trie par date décroissante et exclut la corbeille', async () => {
      const { service, repo } = makeService();
      await service.sync({
        records: [
          row({ externalId: 'vieux', date: '2026-01-01T10:00:00.000Z' }),
          row({ externalId: 'recent', date: '2026-09-10T10:00:00.000Z' }),
        ],
      } as never);
      const list = (await service.listAll()) as View[];
      expect(list.map((r) => r.externalId)).toEqual(['recent', 'vieux']);
      await service.softDelete(repo.rows.find((r) => r.externalId === 'recent')!.id);
      expect(((await service.listAll()) as View[]).map((r) => r.externalId)).toEqual(['vieux']);
    });
  });

  describe('audit', () => {
    it('trace création, mise à jour et retrait', async () => {
      const repo = new MemoryRepo();
      const audit = mockAudit();
      const service = new PaymentRecordsService(
        repo as unknown as ICrudRepository<PaymentRecordEntity>,
        mockCache(),
        audit,
      );
      await service.sync({ records: [row()] } as never);
      await service.sync({ records: [row({ amount: 999 })] } as never);
      await service.sync({ records: [], removed: ['pr1'] } as never);
      const actions = (audit.record as jest.Mock).mock.calls.map((c) => c[0].action);
      expect(actions).toEqual(expect.arrayContaining(['create', 'update', 'soft_delete']));
      expect(actions).toHaveLength(3);
    });
  });
});
