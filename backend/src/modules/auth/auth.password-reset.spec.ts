/**
 * Réinitialisation de mot de passe — ce qui doit tenir.
 *
 * Trois propriétés comptent plus que le reste : l'absence de compte ne doit pas
 * se lire dans la réponse, un jeton ne sert qu'une fois, et un jeton expiré ne
 * passe pas. Un test qui ne couvre pas ça ne couvre pas le risque.
 */
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function makeService(state: {
  user?: Record<string, unknown> | null;
  resetTokens?: Record<string, unknown>[];
}) {
  const users = {
    findOne: jest.fn(async (where: Record<string, unknown>) =>
      state.user && state.user.email === where.email ? state.user : null,
    ),
    findById: jest.fn(async (_id: number) => state.user ?? null),
    update: jest.fn(async (_id: number, _data: Record<string, unknown>) => state.user),
  };
  const resetTokens = {
    create: jest.fn(async (data: Record<string, unknown>) => {
      // La ligne stockée porte son id : le service s'en sert pour marquer le
      // jeton comme consommé, et un faux qui l'omettrait ferait passer à tort le
      // test d'usage unique.
      const row = { id: (state.resetTokens || []).length + 1, ...data };
      state.resetTokens = [...(state.resetTokens || []), row];
      return row;
    }),
    findOne: jest.fn(async (where: Record<string, unknown>) =>
      (state.resetTokens || []).find((t) => t.tokenHash === where.tokenHash) ?? null,
    ),
    update: jest.fn(async (id: number, data: Record<string, unknown>) => {
      const row = (state.resetTokens || []).find((_t, i) => i + 1 === id);
      if (row) Object.assign(row, data);
      return row;
    }),
  };
  const refreshTokens = {
    findMany: jest.fn(async (_options: unknown) => ({ data: [] as Record<string, unknown>[] })),
    update: jest.fn(async (_id: number, _data: Record<string, unknown>) => ({})),
  };

  const service = new AuthService(
    users as never,
    {} as never,
    {} as never,
    refreshTokens as never,
    resetTokens as never,
    {} as never,
    { get: () => undefined } as never,
    {} as never,
    {} as never,
  );
  return { service, users, resetTokens, refreshTokens };
}

const activeUser = {
  id: 7,
  email: 'client@example.com',
  status: 'active',
  passwordHash: 'ancien',
};

describe('AuthService — réinitialisation de mot de passe', () => {
  it('émet un jeton haché et ne stocke jamais le jeton en clair', async () => {
    const { service, resetTokens } = makeService({ user: activeUser });
    const res = await service.requestPasswordReset('Client@Example.com', { ip: '203.0.113.9' });

    expect(res.found).toBe(true);
    const stored = resetTokens.create.mock.calls[0][0];
    expect(stored.tokenHash).toBe(sha256((res as { token: string }).token));
    expect(JSON.stringify(stored)).not.toContain((res as { token: string }).token);
    expect(stored.userId).toBe(7);
    expect(stored.ip).toBe('203.0.113.9');
  });

  it('ne révèle pas si l’adresse existe', async () => {
    const { service, resetTokens } = makeService({ user: null });
    const res = await service.requestPasswordReset('inconnu@example.com', {});

    expect(res).toEqual({ found: false });
    expect(resetTokens.create).not.toHaveBeenCalled();
  });

  it('refuse un compte inactif sans le dire', async () => {
    const { service } = makeService({ user: { ...activeUser, status: 'blocked' } });
    expect(await service.requestPasswordReset('client@example.com', {})).toEqual({ found: false });
  });

  it('consomme le jeton : une seconde utilisation est refusée', async () => {
    const state: { user: Record<string, unknown> | null; resetTokens?: Record<string, unknown>[] } = {
      user: activeUser,
    };
    const { service, users } = makeService(state);
    const res = (await service.requestPasswordReset('client@example.com', {})) as { token: string };

    await service.resetPassword({ token: res.token, password: 'Nouveau_Mot2passe' });
    expect(users.update).toHaveBeenCalledTimes(1);
    expect((users.update.mock.calls[0][1] as { passwordHash: string }).passwordHash).not.toBe('ancien');

    await expect(
      service.resetPassword({ token: res.token, password: 'Encore_Un2mot' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuse un jeton expiré', async () => {
    const state = {
      user: activeUser,
      resetTokens: [
        {
          id: 1,
          userId: 7,
          tokenHash: sha256('perime'),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          usedAt: null,
        },
      ],
    };
    const { service, users } = makeService(state);

    await expect(
      service.resetPassword({ token: 'perime', password: 'Nouveau_Mot2passe' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it('révoque les sessions ouvertes après réinitialisation', async () => {
    const state: { user: Record<string, unknown> | null; resetTokens?: Record<string, unknown>[] } = {
      user: activeUser,
    };
    const { service, refreshTokens } = makeService(state);
    refreshTokens.findMany.mockResolvedValueOnce({
      data: [{ id: 11, revokedAt: null }, { id: 12, revokedAt: '2026-01-01' }],
    } as never);

    const res = (await service.requestPasswordReset('client@example.com', {})) as { token: string };
    await service.resetPassword({ token: res.token, password: 'Nouveau_Mot2passe' });

    // Une seule des deux sessions était encore valide.
    expect(refreshTokens.update).toHaveBeenCalledTimes(1);
    expect(refreshTokens.update.mock.calls[0][0]).toBe(11);
  });
});
