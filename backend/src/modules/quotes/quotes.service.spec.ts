import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { QuoteEntity } from './entities/quote.entity';
import { QuotesService } from './quotes.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

function makeRepo(existing?: QuoteEntity) {
  /*
   * Un dépôt réel relit la ligne après une écriture. Ce n'est pas un détail de
   * théâtre : `create()` applique les valeurs par défaut, puis le service rappelle
   * `update()` pour poser le `reference` généré. Un mock qui repart de `existing` à
   * chaque `update` renvoie donc une ligne amputée de tout ce qui a été posé à la
   * création — et l'assertion sur `status`/`currency` tombe, pour une raison qui
   * n'a rien à voir avec le comportement de production. La ligne se suit ici comme
   * elle se suit en base.
   */
  let row = { ...(existing as Record<string, unknown> | undefined) } as Record<string, unknown>;
  return {
    collection: 'quotes',
    create: jest.fn(async (d: Partial<QuoteEntity>) => {
      row = { ...row, ...d };
      return row as QuoteEntity;
    }),
    update: jest.fn(async (_id: unknown, d: Partial<QuoteEntity>) => {
      row = { ...row, ...d };
      return row as QuoteEntity;
    }),
    findById: jest.fn(async () => (existing ? (row as QuoteEntity) : null)),
    findOne: jest.fn().mockResolvedValue(null),
  } as unknown as ICrudRepository<QuoteEntity>;
}

describe('QuotesService', () => {
  it('defaults a new request to "submitted"', async () => {
    const service = new QuotesService(makeRepo(), cache, audit);
    const created = (await service.create({
      client: 'Cevital',
      email: 'Contact@Cevital.DZ',
    } as Partial<QuoteEntity>)) as QuoteEntity;

    expect(created.status).toBe('submitted');
    expect(created.currency).toBe('DZD');
    expect(created.email).toBe('contact@cevital.dz');
    expect(created.date).toBeTruthy();
  });

  it('tracks the commercial workflow in history', async () => {
    const existing = { id: 1, client: 'C', email: 'c@d.dz', status: 'submitted', history: [] } as unknown as QuoteEntity;
    const service = new QuotesService(makeRepo(existing), cache, audit);

    const updated = (await service.update(1, { status: 'accepted' } as Partial<QuoteEntity>)) as QuoteEntity;
    const history = updated.history as Array<{ status: string; at: string }>;

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('accepted');
    expect(history[0].at).toBeTruthy();
  });
});
