/**
 * `POST /auth/register` — le seul point d'entrée public d'inscription.
 *
 * Ce qui compte ici n'est pas que ça crée un compte, c'est **quel** compte :
 * le type doit être forcé à `client`, quoi que le visiteur envoie. Sans cette
 * garantie, n'importe qui pourrait s'inscrire en `admin` ou en `partner`.
 */
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/auth.dto';

function makeController(users: Partial<UsersService>) {
  const auth = {} as AuthService;
  const controller = new AuthController(auth, users as UsersService);
  return controller;
}

const req = { ip: '203.0.113.7', headers: { 'user-agent': 'jest' } } as never;

const dto: RegisterDto = {
  email: 'Client@Example.com',
  password: 'Mot2passe!Solide',
  firstName: 'Sofiane',
  lastName: 'Arkam',
  locale: 'fr',
};

describe('AuthController — POST /auth/register', () => {
  it('crée le compte et transmet l’origine de la requête', async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    await makeController({ create }).register(dto, req);

    expect(create).toHaveBeenCalledTimes(1);
    const [payload, actor] = create.mock.calls[0];
    expect(payload).toMatchObject({
      email: 'Client@Example.com',
      firstName: 'Sofiane',
      lastName: 'Arkam',
      locale: 'fr',
    });
    expect(actor).toEqual({ ip: '203.0.113.7', userAgent: 'jest' });
  });

  it('force le type à client — même si la requête demande admin', async () => {
    const create = jest.fn().mockResolvedValue({ id: 2 });
    const hostile = { ...dto, type: 'admin' } as unknown as RegisterDto;
    await makeController({ create }).register(hostile, req);

    const [payload] = create.mock.calls[0];
    expect(payload.type).toBe('client');
  });

  it('complète le nom manquant sans rejeter la demande', async () => {
    const create = jest.fn().mockResolvedValue({ id: 3 });
    await makeController({ create }).register({ ...dto, lastName: undefined }, req);

    const [payload] = create.mock.calls[0];
    expect(payload.lastName).toBe('');
  });

  it('laisse remonter l’échec du service — adresse déjà prise, mot de passe faible', async () => {
    const create = jest.fn().mockRejectedValue(new UnauthorizedException('email déjà utilisé'));
    await expect(makeController({ create }).register(dto, req)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
