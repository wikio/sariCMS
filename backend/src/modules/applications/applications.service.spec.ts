import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ApplicationEntity } from './entities/application.entity';
import { ApplicationsService } from './applications.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

function makeRepo(existing?: ApplicationEntity) {
  return {
    collection: 'job_applications',
    create: jest.fn(async (d: Partial<ApplicationEntity>) => d as ApplicationEntity),
    update: jest.fn(async (_id: unknown, d: Partial<ApplicationEntity>) => ({ ...existing, ...d }) as ApplicationEntity),
    findById: jest.fn().mockResolvedValue(existing ?? null),
    findOne: jest.fn().mockResolvedValue(null),
  } as unknown as ICrudRepository<ApplicationEntity>;
}

describe('ApplicationsService', () => {
  it('defaults a new application to "new"', async () => {
    const service = new ApplicationsService(makeRepo(), cache, audit);
    const created = (await service.create({
      candidate: 'Amina Belkacem',
      email: 'Amina@Example.DZ',
      jobTitle: 'Ingénieure biomédicale',
    } as Partial<ApplicationEntity>)) as ApplicationEntity;

    expect(created.status).toBe('new');
    expect(created.email).toBe('amina@example.dz');
    expect(created.date).toBeTruthy();
  });

  it('follows the recruitment funnel in history', async () => {
    const existing = { id: 1, candidate: 'A', email: 'a@b.dz', status: 'new', history: [] } as unknown as ApplicationEntity;
    const service = new ApplicationsService(makeRepo(existing), cache, audit);

    const updated = (await service.update(1, { status: 'interview' } as Partial<ApplicationEntity>)) as ApplicationEntity;
    const history = updated.history as Array<{ status: string }>;

    expect(updated.status).toBe('interview');
    expect(history[0].status).toBe('interview');
  });
});
