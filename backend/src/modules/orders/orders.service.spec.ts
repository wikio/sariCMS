import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { OrderEntity } from './entities/order.entity';
import { OrdersService } from './orders.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

function makeRepo(existing?: OrderEntity) {
  return {
    collection: 'orders',
    create: jest.fn(async (d: Partial<OrderEntity>) => d as OrderEntity),
    update: jest.fn(async (_id: unknown, d: Partial<OrderEntity>) => ({ ...existing, ...d }) as OrderEntity),
    findById: jest.fn().mockResolvedValue(existing ?? null),
    findOne: jest.fn().mockResolvedValue(null),
  } as unknown as ICrudRepository<OrderEntity>;
}

describe('OrdersService', () => {
  it('applies defaults on create', async () => {
    const service = new OrdersService(makeRepo(), cache, audit);
    const created = (await service.create({
      client: 'Sonatrach',
      email: 'Achats@Sonatrach.DZ',
      total: 1250000.5,
    } as Partial<OrderEntity>)) as OrderEntity;

    expect(created.status).toBe('pending');
    expect(created.currency).toBe('DZD');
    expect(created.paid).toBe(false);
    expect(created.date).toBeTruthy();
  });

  it('normalises the email so a customer is not duplicated by letter case', async () => {
    const service = new OrdersService(makeRepo(), cache, audit);
    const created = (await service.create({
      client: 'Naftal',
      email: '  Achats@Naftal.DZ ',
    } as Partial<OrderEntity>)) as OrderEntity;

    expect(created.email).toBe('achats@naftal.dz');
  });

  it('records a history entry when the status changes', async () => {
    const existing = {
      id: 1,
      client: 'Naftal',
      email: 'a@b.dz',
      status: 'pending',
      history: [],
    } as unknown as OrderEntity;
    const service = new OrdersService(makeRepo(existing), cache, audit);

    const updated = (await service.update(1, { status: 'shipped' } as Partial<OrderEntity>)) as OrderEntity;
    const history = updated.history as Array<{ status: string }>;

    expect(updated.status).toBe('shipped');
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('shipped');
  });

  it('leaves history untouched when the status does not change', async () => {
    const existing = {
      id: 1,
      client: 'Naftal',
      email: 'a@b.dz',
      status: 'pending',
      history: [],
    } as unknown as OrderEntity;
    const service = new OrdersService(makeRepo(existing), cache, audit);

    const updated = (await service.update(1, { phone: '021 00 00 00' } as Partial<OrderEntity>)) as OrderEntity;

    expect(updated.history).toEqual([]);
  });
});
