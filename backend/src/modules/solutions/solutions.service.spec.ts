import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { SolutionEntity } from './entities/solution.entity';
import { SolutionsService } from './solutions.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('SolutionsService', () => {
  it('keeps an explicit slug and defaults draft/fr', async () => {
    const create = jest.fn(async (d: Partial<SolutionEntity>) => d as SolutionEntity);
    const repo = {
      collection: 'solutions',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<SolutionEntity>;
    const service = new SolutionsService(repo, cache, audit);
    const created = (await service.create({
      title: 'Diagnostic & Imagerie',
      slug: 'diagnostic',
      productIds: [1, 4, 5],
    } as Partial<SolutionEntity>)) as SolutionEntity;
    expect(created.slug).toBe('diagnostic');
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('draft');
  });
});
