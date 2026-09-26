import { COLLECTIONS } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { DEFAULTS } from './maintenance-settings.service';
import type { MaintenanceSettingsService } from './maintenance-settings.service';
import { DEFAULT_AUDIT_RETENTION_DAYS, LOG_RETENTION_JOB, LogRetentionTask } from './log-retention.task';

interface Call {
  collection: string;
  field: string;
  cutoff: Date;
}

/** Usine factice : note chaque appel et laisse choisir le compte retourné. */
function makeFactory(opts: { fail?: string[]; counts?: Record<string, number> } = {}) {
  const calls: Call[] = [];
  const factory = ((collection: string) => {
    return {
      collection,
      deleteOlderThan: jest.fn(async (field: string, cutoff: Date) => {
        calls.push({ collection, field, cutoff });
        if (opts.fail?.includes(collection)) throw new Error(`${collection} introuvable`);
        return opts.counts?.[collection] ?? 0;
      }),
    } as unknown as ICrudRepository<BaseEntity>;
  }) as unknown as RepositoryFactory;

  return { factory, calls };
}

/** Service de réglages factice — seule `current()` intéresse la tâche. */
function makeMaintenance(overrides: Partial<Record<string, unknown>> = {}) {
  const values = { ...DEFAULTS, ...overrides };
  return {
    current: jest.fn(async () => values),
    values,
  } as unknown as MaintenanceSettingsService & { current: jest.Mock };
}

/**
 * Jobs démarrés par les tests. `applySchedule` appelle `start()`, ce qui pose un
 * timer réel : sans arrêt explicite, Jest ne rend jamais la main et la suite
 * semble pendre.
 */
const startedJobs: Array<{ stop: () => void }> = [];

afterEach(() => {
  while (startedJobs.length) {
    try {
      startedJobs.pop()!.stop();
    } catch {
      /* job déjà arrêté */
    }
  }
});

/** Registre de planification factice : garde les jobs enregistrés. */
function makeScheduler() {
  const jobs = new Map<string, unknown>();
  return {
    jobs,
    registry: {
      getCronJobs: () => jobs,
      addCronJob: jest.fn((name: string, job: unknown) => jobs.set(name, job)),
      deleteCronJob: jest.fn((name: string) => {
        if (!jobs.has(name)) throw new Error(`job inconnu: ${name}`);
        jobs.delete(name);
      }),
    },
  };
}

function makeTask(overrides: Record<string, unknown> = {}, factoryOpts: Parameters<typeof makeFactory>[0] = {}) {
  const { factory, calls } = makeFactory(factoryOpts);
  const maintenance = makeMaintenance(overrides);
  const { registry, jobs } = makeScheduler();
  const task = new LogRetentionTask(factory, maintenance as MaintenanceSettingsService, registry as never);
  // Tout job qui passe par le registre est suivi, pour être arrêté en fin de test.
  const suivre = registry.addCronJob as jest.Mock;
  suivre.mockImplementation((name: string, job: unknown) => {
    jobs.set(name, job);
    startedJobs.push(job as { stop: () => void });
  });
  return { task, calls, maintenance, jobs, registry };
}

const JOUR = 86_400_000;

describe('LogRetentionTask — cibles et fenêtres', () => {
  it('cible les trois tables attendues', async () => {
    const { task, calls } = makeTask();
    await task.purgeAll();

    expect(calls.map((c) => c.collection)).toEqual([
      COLLECTIONS.auditLogs,
      COLLECTIONS.refreshTokens,
      COLLECTIONS.passwordResetTokens,
    ]);
  });

  it('applique la fenêtre glissante à l’audit, et « maintenant » aux jetons', async () => {
    const { task, calls } = makeTask();
    const avant = Date.now();
    await task.purgeAll();
    const apres = Date.now();

    const audit = calls.find((c) => c.collection === COLLECTIONS.auditLogs)!;
    expect(audit.field).toBe('createdAt');
    const jours = (avant - audit.cutoff.getTime()) / JOUR;
    expect(jours).toBeGreaterThanOrEqual(DEFAULT_AUDIT_RETENTION_DAYS - 0.01);

    for (const label of [COLLECTIONS.refreshTokens, COLLECTIONS.passwordResetTokens]) {
      const c = calls.find((x) => x.collection === label)!;
      expect(c.field).toBe('expiresAt');
      expect(c.cutoff.getTime()).toBeGreaterThanOrEqual(avant);
      expect(c.cutoff.getTime()).toBeLessThanOrEqual(apres);
    }
  });

  it('respecte la fenêtre configurée', async () => {
    const { task, calls } = makeTask({ auditRetentionDays: 7 });
    await task.purgeAll();

    const audit = calls.find((c) => c.collection === COLLECTIONS.auditLogs)!;
    expect(Math.round((Date.now() - audit.cutoff.getTime()) / JOUR)).toBe(7);
  });

  it('additionne les compteurs retournés', async () => {
    const { task } = makeTask(
      {},
      {
        counts: {
          [COLLECTIONS.auditLogs]: 120,
          [COLLECTIONS.refreshTokens]: 8,
          [COLLECTIONS.passwordResetTokens]: 3,
        },
      },
    );
    const out = await task.purgeAll();

    expect(out).toEqual({ audit_logs: 120, refresh_tokens: 8, password_reset_tokens: 3 });
  });

  it('continue sur les autres cibles quand l’une échoue', async () => {
    const { task, calls } = makeTask(
      {},
      { fail: [COLLECTIONS.refreshTokens], counts: { [COLLECTIONS.auditLogs]: 42 } },
    );
    const out = await task.purgeAll();

    expect(out.audit_logs).toBe(42);
    expect(out.refresh_tokens).toBe(0);
    expect(calls.map((c) => c.collection)).toHaveLength(3);
  });
});

describe('LogRetentionTask — planification', () => {
  it('enregistre le job sous un nom explicite, pas celui de la méthode', async () => {
    // Les deux tâches portent une méthode `handleCron` et le registre est indexé
    // par nom : sans nom explicite elles s'y écraseraient.
    const { task, jobs } = makeTask();
    await task.applySchedule();

    expect(jobs.has(LOG_RETENTION_JOB)).toBe(true);
    expect(jobs.has('handleCron')).toBe(false);
  });

  it('planifie sur l’expression configurée', async () => {
    const { task } = makeTask({ logRetentionCron: '0 4 * * 0' });
    await expect(task.applySchedule()).resolves.toBe('0 4 * * 0');
  });

  it('remplace un job déjà enregistré au lieu de lever', async () => {
    const { task, jobs, registry } = makeTask();
    await task.applySchedule();
    const premier = jobs.get(LOG_RETENTION_JOB);

    await task.applySchedule();

    expect(jobs.size).toBe(1);
    expect(jobs.get(LOG_RETENTION_JOB)).not.toBe(premier);
    expect(registry.deleteCronJob).toHaveBeenCalledWith(LOG_RETENTION_JOB);
  });

  it('au démarrage, enregistre le job', async () => {
    const { task, jobs } = makeTask({ logRetentionCron: '30 2 * * *' });
    await task.onApplicationBootstrap();

    expect(jobs.has(LOG_RETENTION_JOB)).toBe(true);
  });

  it('démarre le job — l’ajouter au registre ne suffit pas', async () => {
    // `SchedulerRegistry.addCronJob` ne fait que ranger le job dans une carte ;
    // sans `start()` il ne se déclencherait jamais.
    const { task, jobs } = makeTask();
    await task.applySchedule();

    expect((jobs.get(LOG_RETENTION_JOB) as { running: boolean }).running).toBe(true);
  });

  it('un démarrage sans base ne casse pas l’application', async () => {
    const { task } = makeTask();
    (task as unknown as { maintenance: { current: jest.Mock } }).maintenance.current = jest.fn(
      async () => {
        throw new Error('base injoignable');
      },
    );

    await expect(task.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
