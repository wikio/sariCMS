import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';
import { JsonRepository } from './json-repository';
import { JsonStore } from './json-store';

/**
 * Rétention sur l’adaptateur JSON réel — pas un mock.
 *
 * `deleteOlderThan` est la méthode sur laquelle repose `LogRetentionTask`. Elle
 * diffère de `purgeExpired` sur un point décisif : elle supprime des lignes
 * vivantes, alors que `purgeExpired` ne vide que la corbeille. C’est justement
 * ce que les deux tests ci-dessous vérifient.
 */
describe('JsonRepository.deleteOlderThan', () => {
  let dir: string;
  let store: JsonStore;
  let repo: JsonRepository<BaseEntity>;

  const jours = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'saricms-retention-'));
    store = new JsonStore(dir);
    repo = new JsonRepository<BaseEntity>('audit_logs', store);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('supprime les lignes vivantes antérieures au seuil', async () => {
    await store.write('audit_logs', [
      { id: 1, action: 'create', createdAt: jours(90) },
      { id: 2, action: 'update', createdAt: jours(45) },
      { id: 3, action: 'create', createdAt: jours(10) },
      { id: 4, action: 'update', createdAt: new Date().toISOString() },
    ]);

    const removed = await repo.deleteOlderThan('createdAt', new Date(Date.now() - 30 * 86_400_000));

    expect(removed).toBe(2);
    expect(store.read('audit_logs').map((r) => r.id)).toEqual([3, 4]);
  });

  it('supprime là où purgeExpired ne touche à rien', async () => {
    // Une ligne d’audit n’est jamais passée par la corbeille : `deletedAt` est
    // nul. `purgeExpired` la laisse — c’est exactement pourquoi
    // `TrashPurgeTask` exclut `audit_logs` et qu’il faut cette méthode.
    await store.write('audit_logs', [{ id: 1, action: 'create', createdAt: jours(400), deletedAt: null }]);

    expect(await repo.purgeExpired(new Date())).toBe(0);
    expect(store.read('audit_logs')).toHaveLength(1);

    expect(await repo.deleteOlderThan('createdAt', new Date(Date.now() - 30 * 86_400_000))).toBe(1);
    expect(store.read('audit_logs')).toHaveLength(0);
  });

  it('conserve les lignes sans date exploitable', async () => {
    await store.write('audit_logs', [
      { id: 1, action: 'create', createdAt: jours(60) },
      { id: 2, action: 'create' },
      { id: 3, action: 'create', createdAt: null },
      { id: 4, action: 'create', createdAt: 'pas-une-date' },
    ]);

    const removed = await repo.deleteOlderThan('createdAt', new Date(Date.now() - 30 * 86_400_000));

    expect(removed).toBe(1);
    expect(store.read('audit_logs').map((r) => r.id)).toEqual([2, 3, 4]);
  });

  it('n’écrit pas le fichier quand il n’y a rien à supprimer', async () => {
    await store.write('audit_logs', [{ id: 1, action: 'create', createdAt: new Date().toISOString() }]);
    const avant = store.fileOf('audit_logs');
    const mtimeAvant = (await import('fs')).statSync(avant).mtimeMs;

    expect(await repo.deleteOlderThan('createdAt', new Date(Date.now() - 30 * 86_400_000))).toBe(0);

    const mtimeApres = (await import('fs')).statSync(avant).mtimeMs;
    expect(mtimeApres).toBe(mtimeAvant);
  });

  it('borne une table d’audit par le champ de son choix', async () => {
    await store.write('refresh_tokens', [
      { id: 1, userId: 1, expiresAt: jours(2) },
      { id: 2, userId: 1, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    ]);
    const tokens = new JsonRepository<BaseEntity>('refresh_tokens', store);

    expect(await tokens.deleteOlderThan('expiresAt', new Date())).toBe(1);
    expect(store.read('refresh_tokens').map((r) => r.id)).toEqual([2]);
  });
});
