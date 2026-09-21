import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COLLECTIONS } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import {
  DEFAULTS,
  MAINTENANCE_KEY,
  MaintenanceSettingsService,
} from './maintenance-settings.service';

/** Ligne `settings` telle que le dépôt factice la tient — les horodatages de
 *  `BaseEntity` n'ont rien à faire dans ces amorces. */
interface Row {
  id?: number;
  key?: string;
  value?: unknown;
  group?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Dépôt factice tenant la ligne `maintenance` en mémoire. */
function makeRepo() {
  let row: Row | null = null;
  const repo = {
    collection: COLLECTIONS.settings,
    findOne: jest.fn(async (where: Record<string, unknown>) =>
      row && row.key === where.key ? row : null,
    ),
    create: jest.fn(async (data: Partial<Row>) => {
      row = { ...(data as Row), id: 1 };
      return row;
    }),
    update: jest.fn(async (_id: number, data: Partial<Row>) => {
      row = { ...row, ...data } as Row;
      return row as Row;
    }),
    hardDelete: jest.fn(async () => {
      row = null;
    }),
    get row() {
      return row;
    },
    set row(value: Row | null) {
      row = value;
    },
  };
  const factory = ((collection: string) => {
    if (collection !== COLLECTIONS.settings) throw new Error(`collection inattendue: ${collection}`);
    return repo as unknown as ICrudRepository<BaseEntity>;
  }) as unknown as RepositoryFactory;
  return { factory, repo };
}

function makeConfig(env: Record<string, string> = {}) {
  return { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
}

function makeService(env: Record<string, string> = {}) {
  const { factory, repo } = makeRepo();
  return {
    service: new MaintenanceSettingsService(factory, makeConfig(env)),
    repo,
  };
}

const VALID = {
  auditRetentionDays: 45,
  logRetentionCron: '0 4 * * *',
  trashRetentionHours: 48,
  trashPurgeCron: '30 3 * * *',
};

describe('MaintenanceSettingsService — provenance', () => {
  it('sans base ni variables, rend les défauts', async () => {
    const { service } = makeService();
    await expect(service.current()).resolves.toEqual(DEFAULTS);
  });

  it('les variables priment sur les défauts', async () => {
    const { service } = makeService({
      AUDIT_RETENTION_DAYS: '90',
      LOG_RETENTION_CRON: '0 5 * * *',
      TRASH_RETENTION_HOURS: '24',
      TRASH_PURGE_CRON: '0 2 * * *',
    });
    await expect(service.current()).resolves.toEqual({
      auditRetentionDays: 90,
      logRetentionCron: '0 5 * * *',
      trashRetentionHours: 24,
      trashPurgeCron: '0 2 * * *',
    });
  });

  it('une variable cron invalide retombe sur le défaut sans lever', () => {
    const { service } = makeService({ LOG_RETENTION_CRON: 'pas une cron' });
    return expect(service.current()).resolves.toMatchObject({
      logRetentionCron: DEFAULTS.logRetentionCron,
    });
  });

  it('une variable numérique hors bornes retombe sur le défaut', () => {
    const { service } = makeService({ AUDIT_RETENTION_DAYS: '99999' });
    return expect(service.current()).resolves.toMatchObject({
      auditRetentionDays: DEFAULTS.auditRetentionDays,
    });
  });

  it('la base prime sur les variables', async () => {
    const { service, repo } = makeService({ AUDIT_RETENTION_DAYS: '90' });
    repo.row = { id: 1, key: MAINTENANCE_KEY, value: VALID };

    const out = await service.current();
    expect(out.auditRetentionDays).toBe(45);
    expect(out.logRetentionCron).toBe('0 4 * * *');
  });

  it('un champ invalide en base retombe champ par champ sur l’environnement', async () => {
    const { service, repo } = makeService({ AUDIT_RETENTION_DAYS: '90', LOG_RETENTION_CRON: '0 5 * * *' });
    repo.row = {
      id: 1,
      key: MAINTENANCE_KEY,
      value: { ...VALID, auditRetentionDays: 'absurde', logRetentionCron: 'invalide' },
    };

    await expect(service.current()).resolves.toMatchObject({
      auditRetentionDays: 90,
      logRetentionCron: '0 5 * * *',
      trashRetentionHours: 48,
    });
  });

  it('une base injoignable ne bloque pas : on sert l’environnement', async () => {
    const { service, repo } = makeService({ AUDIT_RETENTION_DAYS: '15' });
    repo.findOne.mockRejectedValue(new Error('table absente'));

    await expect(service.current()).resolves.toMatchObject({ auditRetentionDays: 15 });
  });

  it('status indique la provenance', async () => {
    const fresh = makeService();
    expect((await fresh.service.status()).source).toBe('default');

    const withEnv = makeService({ AUDIT_RETENTION_DAYS: '15' });
    expect((await withEnv.service.status()).source).toBe('env');

    const { service, repo } = makeService();
    repo.row = { id: 1, key: MAINTENANCE_KEY, value: VALID };
    expect((await service.status()).source).toBe('db');
  });
});

describe('MaintenanceSettingsService — validation', () => {
  const { service } = makeService();

  it('accepte un jeu complet et le normalise', () => {
    expect(service.validate({ ...VALID, logRetentionCron: '  0 4 * * *  ' })).toEqual(VALID);
  });

  it('arrondit par défaut une valeur fractionnaire', () => {
    expect(service.validate({ ...VALID, auditRetentionDays: 12.9 }).auditRetentionDays).toBe(12);
  });

  it.each([
    ['auditRetentionDays', 0],
    ['auditRetentionDays', -1],
    ['auditRetentionDays', 3_651],
    ['auditRetentionDays', 'abc'],
    ['trashRetentionHours', 0],
    ['trashRetentionHours', 8_761],
  ])('refuse %s = %p', (field, value) => {
    expect(() => service.validate({ ...VALID, [field]: value })).toThrow(BadRequestException);
    expect(() => service.validate({ ...VALID, [field]: value })).toThrow(new RegExp(String(field)));
  });

  it.each([
    ['logRetentionCron', 'pas une cron'],
    ['logRetentionCron', '* * * *'],
    ['logRetentionCron', '* * * * * *'],
    ['trashPurgeCron', ''],
  ])('refuse %s = %p', (field, value) => {
    expect(() => service.validate({ ...VALID, [field]: value })).toThrow(BadRequestException);
    expect(() => service.validate({ ...VALID, [field]: value })).toThrow(new RegExp(String(field)));
  });
});

describe('MaintenanceSettingsService — enregistrement', () => {
  it('crée la ligne au premier enregistrement, puis la met à jour', async () => {
    const { service, repo } = makeService();

    await service.save(VALID);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.row).toMatchObject({ key: MAINTENANCE_KEY, group: 'maintenance', value: VALID });

    await service.save({ ...VALID, auditRetentionDays: 60 });
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect((repo.row!.value as Record<string, number>).auditRetentionDays).toBe(60);
  });

  it('n’écrit rien si la validation échoue', async () => {
    const { service, repo } = makeService();
    await expect(service.save({ ...VALID, logRetentionCron: 'faux' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('reset supprime la ligne et revient à l’environnement', async () => {
    const { service, repo } = makeService({ AUDIT_RETENTION_DAYS: '15' });
    await service.save(VALID);
    expect((await service.current()).auditRetentionDays).toBe(45);

    const out = await service.reset();

    expect(repo.hardDelete).toHaveBeenCalled();
    expect(out.auditRetentionDays).toBe(15);
    expect(out.source).toBe('env');
  });

  it('reset sans ligne enregistrée ne lève pas', async () => {
    const { service, repo } = makeService();
    await expect(service.reset()).resolves.toMatchObject({ source: 'default' });
    expect(repo.hardDelete).not.toHaveBeenCalled();
  });
});
