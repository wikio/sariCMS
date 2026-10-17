import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ServiceEntity } from './entities/service.entity';
import { ServicesService } from './services.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('ServicesService', () => {
  it('defaults locale=fr, status=draft and builds a slug from the title', async () => {
    const create = jest.fn(async (d: Partial<ServiceEntity>) => d as ServiceEntity);
    const repo = {
      collection: 'services',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<ServiceEntity>;
    const service = new ServicesService(repo, cache, audit);
    const created = (await service.create({
      title: 'Installation & Formation',
      icon: 'users',
    } as Partial<ServiceEntity>)) as ServiceEntity;
    expect(created.slug).toBe('installation-formation');
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('draft');
    expect(created.sortOrder).toBe(0);
  });
});
