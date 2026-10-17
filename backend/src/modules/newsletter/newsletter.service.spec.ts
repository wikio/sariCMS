/**
 * Contrat d'abonnement : l'adresse est la clé métier, et un retrait garde sa
 * raison.
 *
 * Ce qui est testé ici regarde surtout les deux colonnes ajoutées pour le
 * formulaire de désabonnement de la vitrine (`unsubscribeReason`,
 * `unsubscribeNote`) et leur chemin jusqu'à l'export CSV — un motif perdu en
 * route est un motif que personne ne lira jamais.
 */
import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { NewsletterSubscriberEntity, NEWSLETTER_UNSUBSCRIBE_REASONS } from './entities/newsletter.entity';
import { NewsletterService } from './newsletter.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

/** Un dépôt faux, manipulé comme un jeu de espions : seul le contrat compte. */
type Fake = Record<string, jest.Mock>;

const asRepo = (fakes: Fake) => fakes as unknown as ICrudRepository<NewsletterSubscriberEntity>;

function repoFor(row: Partial<NewsletterSubscriberEntity> | null): Fake {
  const store = { ...row } as NewsletterSubscriberEntity;
  return {
    collection: jest.fn(() => 'newsletter') as unknown as jest.Mock,
    findById: jest.fn(async () => store),
    findOne: jest.fn(async () => (row ? store : null)),
    create: jest.fn(async (d: Partial<NewsletterSubscriberEntity>) => ({ id: 1, ...d })),
    update: jest.fn(async (_id: number, d: Partial<NewsletterSubscriberEntity>) => ({ ...store, ...d })),
    softDelete: jest.fn(async () => store),
    count: jest.fn(async () => 0),
  };
}

describe('NewsletterService', () => {
  it('lowercases the address and keeps the note the visitor typed', async () => {
    const repo = repoFor(null);
    const service = new NewsletterService(asRepo(repo), cache, audit);
    const out = await service.subscribe({
      email: '  Claire.Dubois@CHU-Laval.test ',
      notes: 'Sommeil, imagerie.',
      topics: ['products', 'events'],
      source: 'footer',
    } as never);
    const payload = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.email).toBe('claire.dubois@chu-laval.test');
    expect(payload.notes).toBe('Sommeil, imagerie.');
    expect(payload.status).toBe('subscribed');
    expect((out as { created?: boolean }).created).toBe(true);
  });

  it('reactivates an address that had been removed instead of duplicating it', async () => {
    const repo = repoFor({ id: 7, email: 'a@b.test', status: 'unsubscribed', token: 'tok' });
    const service = new NewsletterService(asRepo(repo), cache, audit);
    const out = (await service.subscribe({ email: 'A@B.test' } as never)) as {
      created: boolean;
      reactivated: boolean;
      duplicate: boolean;
    };
    expect(repo.create).not.toHaveBeenCalled();
    expect(out.created).toBe(false);
    expect(out.reactivated).toBe(true);
    expect(repo.update.mock.calls[0][0]).toBe(7);
    // Le jeton personnel du lien de retrait ne change pas à la réinscription.
    expect((repo.update.mock.calls[0][1] as Record<string, unknown>).token).toBe('tok');
  });

  it('stores the reason and the free comment of an unsubscribe', async () => {
    const repo = repoFor({ id: 3, email: 'a@b.test', status: 'subscribed' });
    const service = new NewsletterService(asRepo(repo), cache, audit);
    const out = (await service.unsubscribe({
      email: 'A@B.test',
      reason: 'too-many-emails',
      reasonNote: 'Only quarterly, please.',
    } as never)) as { done: boolean; subscriber: Record<string, unknown> };
    expect(out.done).toBe(true);
    const patch = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.status).toBe('unsubscribed');
    expect(patch.unsubscribeReason).toBe('too-many-emails');
    expect(patch.unsubscribeNote).toBe('Only quarterly, please.');
    expect(typeof patch.unsubscribedAt).toBe('string');
  });

  it('records an unspecified motive when the visitor skips the form', async () => {
    const repo = repoFor({ id: 4, email: 'a@b.test', status: 'subscribed' });
    const service = new NewsletterService(asRepo(repo), cache, audit);
    await service.unsubscribe({ email: 'a@b.test' } as never);
    const patch = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.unsubscribeReason).toBe('unspecified');
    expect(patch.unsubscribeNote).toBeUndefined();
  });

  it('says so when the address is not on the list', async () => {
    const fakes = repoFor(null);
    const service = new NewsletterService(asRepo(fakes), cache, audit);
    await expect(service.unsubscribe({ email: 'who@ever.test' } as never)).resolves.toEqual({
      done: false,
      reason: 'unknown',
    });
    expect(fakes.update).not.toHaveBeenCalled();
  });

  it('attributes a bulk removal to the back office unless a reason is given', async () => {
    const plain = repoFor({ id: 11, email: 'a@b.test', status: 'subscribed' });
    const service = new NewsletterService(asRepo(plain), cache, audit);
    await service.bulk([11], 'unsubscribed');
    expect((plain.update.mock.calls[0][1] as Record<string, unknown>).unsubscribeReason).toBe('unsubscribed-by-admin');

    const argued = repoFor({ id: 12, email: 'c@d.test', status: 'subscribed' });
    const second = new NewsletterService(asRepo(argued), cache, audit);
    await second.bulk([12], 'unsubscribed', undefined, 'not-relevant');
    expect((argued.update.mock.calls[0][1] as Record<string, unknown>).unsubscribeReason).toBe('not-relevant');
  });

  it('exports the same columns as the fallback store', async () => {
    const fakes = repoFor({ id: 1, email: 'a@b.test' });
    const service = new NewsletterService(asRepo(fakes), cache, audit);
    fakes.findMany = jest.fn(async () => ({
      data: [
        {
          email: 'a@b.test',
          name: 'A B',
          locale: 'fr',
          status: 'unsubscribed',
          source: 'footer',
          consent: true,
          topics: ['products', 'events'],
          notes: 'Une note, avec virgule',
          unsubscribeReason: 'too-many-emails',
          unsubscribeNote: 'Trop souvent le lundi.',
        },
      ],
      total: 1,
      meta: { page: 1, limit: 1, total: 1, pages: 1 },
    })) as never;
    const csv = await service.exportCsv();
    const head = csv.split('\n')[0].split(',');
    expect(head).toEqual([
      'email', 'name', 'locale', 'status', 'source', 'consent', 'topics',
      'subscribedAt', 'unsubscribedAt', 'notes', 'unsubscribeReason', 'unsubscribeNote',
    ]);
    expect(csv).toContain('products|events');
    expect(csv).toContain('"Une note, avec virgule"');
    expect(csv).toContain('too-many-emails');
  });

  it('offers the five motives, and no more', () => {
    // La liste est partagée entre le DTO (@IsIn), le formulaire de la vitrine et
    // l'écran d'administration : la dériver d'une seule source évite qu'un
    // motif soit accepté d'un côté et refusé de l'autre.
    expect(NEWSLETTER_UNSUBSCRIBE_REASONS).toEqual([
      'no-longer-wants',
      'too-many-emails',
      'not-relevant',
      'never-subscribed',
      'other',
    ]);
  });
});
