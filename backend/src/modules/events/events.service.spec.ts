import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { EventEntity } from './entities/event.entity';
import { EventsService } from './events.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('EventsService', () => {
  it('generates a slug and keeps a JSON agenda payload', async () => {
    const create = jest.fn(async (d: Partial<EventEntity>) => d as EventEntity);
    const repo = {
      collection: 'events',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<EventEntity>;
    const service = new EventsService(repo, cache, audit);
    const created = (await service.create({
      title: 'Journée Portes Ouvertes',
      agenda: [
        { time: '09:00', title: 'Accueil' },
        { time: '10:00', title: 'Démo' },
      ],
    } as Partial<EventEntity>)) as EventEntity;
    expect(created.slug).toBe('journee-portes-ouvertes');
    expect(Array.isArray(created.agenda)).toBe(true);
    expect((created.agenda as { title: string }[])[1].title).toBe('Démo');
  });

  it('lists upcoming published events sorted by date', async () => {
    const findMany = jest.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 1 } });
    const repo = { collection: 'events', findMany } as unknown as ICrudRepository<EventEntity>;
    const service = new EventsService(repo, cache, audit);
    await service.upcoming(5);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'date',
        sortOrder: 'asc',
        filters: [{ field: 'status', value: 'published' }],
      }),
    );
  });
});
