import { ConfigService } from '@nestjs/config';
import { COLLECTIONS } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { DEFAULT_AUDIT_RETENTION_DAYS, LogRetentionTask } from './log-retention.task';

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

function makeConfig(env: Record<string, string | number> = {}) {
  return { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
}

const JOUR = 86_400_000;

describe('LogRetentionTask', () => {
  it('cible les trois tables attendues', async () => {
    const { factory, calls } = makeFactory();
    await new LogRetentionTask(factory, makeConfig()).purgeAll();

    expect(calls.map((c) => c.collection)).toEqual([
      COLLECTIONS.auditLogs,
      COLLECTIONS.refreshTokens,
      COLLECTIONS.passwordResetTokens,
    ]);
  });

  it('applique la fenêtre glissante à l’audit, et « maintenant » aux jetons', async () => {
    const { factory, calls } = makeFactory();
    const avant = Date.now();
    await new LogRetentionTask(factory, makeConfig()).purgeAll();
    const apres = Date.now();

    const audit = calls.find((c) => c.collection === COLLECTIONS.auditLogs)!;
    expect(audit.field).toBe('createdAt');
    const jours = (avant - audit.cutoff.getTime()) / JOUR;
    expect(jours).toBeGreaterThanOrEqual(DEFAULT_AUDIT_RETENTION_DAYS - 0.01);
    expect(jours).toBeLessThanOrEqual(((apres - audit.cutoff.getTime()) / JOUR) + 0.01);

    for (const label of [COLLECTIONS.refreshTokens, COLLECTIONS.passwordResetTokens]) {
      const c = calls.find((x) => x.collection === label)!;
      expect(c.field).toBe('expiresAt');
      expect(c.cutoff.getTime()).toBeGreaterThanOrEqual(avant);
      expect(c.cutoff.getTime()).toBeLessThanOrEqual(apres);
    }
  });

  it('respecte AUDIT_RETENTION_DAYS', async () => {
    const { factory, calls } = makeFactory();
    await new LogRetentionTask(factory, makeConfig({ AUDIT_RETENTION_DAYS: 7 })).purgeAll();

    const audit = calls.find((c) => c.collection === COLLECTIONS.auditLogs)!;
    expect(Math.round((Date.now() - audit.cutoff.getTime()) / JOUR)).toBe(7);
  });

  it('retombe sur le défaut si la variable est absente ou invalide', async () => {
    const envs: Array<Record<string, string | number>> = [
      {},
      { AUDIT_RETENTION_DAYS: 'abc' },
      { AUDIT_RETENTION_DAYS: 0 },
      { AUDIT_RETENTION_DAYS: -5 },
    ];
    for (const env of envs) {
      const { factory, calls } = makeFactory();
      const task = new LogRetentionTask(factory, makeConfig(env));
      expect(task.retentionDays()).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
      await task.purgeAll();
      const audit = calls.find((c) => c.collection === COLLECTIONS.auditLogs)!;
      expect(Math.round((Date.now() - audit.cutoff.getTime()) / JOUR)).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    }
  });

  it('arrondit une fenêtre fractionnaire sans descendre sous un jour', () => {
    const { factory } = makeFactory();
    expect(new LogRetentionTask(factory, makeConfig({ AUDIT_RETENTION_DAYS: 2.9 })).retentionDays()).toBe(2);
  });

  it('additionne les compteurs retournés', async () => {
    const { factory } = makeFactory({
      counts: { [COLLECTIONS.auditLogs]: 120, [COLLECTIONS.refreshTokens]: 8, [COLLECTIONS.passwordResetTokens]: 3 },
    });
    const out = await new LogRetentionTask(factory, makeConfig()).purgeAll();

    expect(out).toEqual({ audit_logs: 120, refresh_tokens: 8, password_reset_tokens: 3 });
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(131);
  });

  it('continue sur les autres cibles quand l’une échoue', async () => {
    const { factory, calls } = makeFactory({
      fail: [COLLECTIONS.refreshTokens],
      counts: { [COLLECTIONS.auditLogs]: 42 },
    });
    const out = await new LogRetentionTask(factory, makeConfig()).purgeAll();

    expect(out.audit_logs).toBe(42);
    expect(out.refresh_tokens).toBe(0);
    expect(out.password_reset_tokens).toBe(0);
    expect(calls.map((c) => c.collection)).toHaveLength(3);
  });

});
