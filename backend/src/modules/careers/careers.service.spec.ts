import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { CareerEntity } from './entities/career.entity';
import { CareersService } from './careers.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('CareersService', () => {
  it('builds a slug and stamps publishedAt when status=published', async () => {
    const create = jest.fn(async (d: Partial<CareerEntity>) => d as CareerEntity);
    const repo = {
      collection: 'careers',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<CareerEntity>;
    const service = new CareersService(repo, cache, audit);
    const created = (await service.create({
      title: 'Technicien Biomédical H/F',
      type: 'CDI',
      status: 'published',
    } as Partial<CareerEntity>)) as CareerEntity;
    expect(created.slug).toBe('technicien-biomedical-h-f');
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('published');
    expect(created.publishedAt).toBeTruthy();
  });
});
