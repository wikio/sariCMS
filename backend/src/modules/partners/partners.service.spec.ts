import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { PartnerEntity } from './entities/partner.entity';
import { PartnersService } from './partners.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('PartnersService', () => {
  it('defaults locale=fr and status=draft', async () => {
    const create = jest.fn(async (d: Partial<PartnerEntity>) => d as PartnerEntity);
    const repo = {
      collection: 'partners',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<PartnerEntity>;
    const service = new PartnersService(repo, cache, audit);
    const created = (await service.create({
      name: 'MediTech International',
      category: 'Équipements',
    } as Partial<PartnerEntity>)) as PartnerEntity;
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('draft');
    expect(created.sortOrder).toBe(0);
  });
});
