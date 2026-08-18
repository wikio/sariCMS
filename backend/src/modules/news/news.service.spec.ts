import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { NewsEntity } from './entities/news.entity';
import { NewsService } from './news.service';

function repoMock(extra: Partial<ICrudRepository<NewsEntity>> = {}): ICrudRepository<NewsEntity> {
  return {
    collection: 'news_articles',
    findMany: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (d) => d as NewsEntity),
    update: jest.fn(async (_id, d) => d as NewsEntity),
    softDelete: jest.fn(),
    restore: jest.fn(),
    hardDelete: jest.fn(),
    purgeExpired: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    autocomplete: jest.fn(),
    ...extra,
  } as ICrudRepository<NewsEntity>;
}

const cache = {
  delByPrefix: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
} as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('NewsService', () => {
  it('slugifies the title and defaults locale/status', async () => {
    const create = jest.fn(async (d: Partial<NewsEntity>) => d as NewsEntity);
    const service = new NewsService(repoMock({ create, findOne: jest.fn().mockResolvedValue(null) }), cache, audit);
    const created = (await service.create({ title: 'Nouvelle gamme Échographes' } as Partial<NewsEntity>)) as NewsEntity;
    expect(created.slug).toBe('nouvelle-gamme-echographes');
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('draft');
  });

  it('stamps publishedAt when publishing', async () => {
    const create = jest.fn(async (d: Partial<NewsEntity>) => d as NewsEntity);
    const service = new NewsService(repoMock({ create, findOne: jest.fn().mockResolvedValue(null) }), cache, audit);
    const created = (await service.create({
      title: 'Publié',
      status: 'published',
    } as Partial<NewsEntity>)) as NewsEntity;
    expect(created.publishedAt).toBeDefined();
    expect(created.date).toBe(created.publishedAt);
  });

  it('aggregates author stats', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    const service = new NewsService(repoMock({ count }), cache, audit);
    await expect(service.statsByAuthor('author-1')).resolves.toEqual({
      authorId: 'author-1',
      published: 3,
      drafts: 1,
      total: 4,
    });
  });
});
