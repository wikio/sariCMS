import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ProductEntity } from './entities/product.entity';
import { ProductsService } from './products.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

describe('ProductsService', () => {
  it('defaults inStock=true, locale=fr and builds a slug from the name', async () => {
    const create = jest.fn(async (d: Partial<ProductEntity>) => d as ProductEntity);
    const repo = {
      collection: 'products',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<ProductEntity>;
    const service = new ProductsService(repo, cache, audit);
    const created = (await service.create({
      name: 'Échographe portable X1',
      specs: { sonde: 'linéaire' },
      options: [{ name: 'Sonde', choices: ['3-5 MHz', '7-12 MHz'] }],
    } as Partial<ProductEntity>)) as ProductEntity;
    expect(created.slug).toBe('echographe-portable-x1');
    expect(created.inStock).toBe(true);
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('draft');
  });

  it('keeps an explicit inStock=false', async () => {
    const create = jest.fn(async (d: Partial<ProductEntity>) => d as ProductEntity);
    const repo = {
      collection: 'products',
      create,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as ICrudRepository<ProductEntity>;
    const service = new ProductsService(repo, cache, audit);
    const created = (await service.create({
      name: 'Rupture',
      inStock: false,
    } as Partial<ProductEntity>)) as ProductEntity;
    expect(created.inStock).toBe(false);
  });
});
