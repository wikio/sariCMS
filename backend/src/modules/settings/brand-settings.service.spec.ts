import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COLLECTIONS } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import {
  BRAND_DEFAULTS,
  BRAND_KEY,
  BRAND_LIMITS,
  BrandSettingsService,
} from './brand-settings.service';

/** Ligne `settings` telle que le dépôt factice la tient. */
interface Row {
  id?: number;
  key?: string;
  value?: unknown;
  group?: string;
}

function makeRepo(options: { throws?: boolean } = {}) {
  let row: Row | null = null;
  const repo = {
    collection: COLLECTIONS.settings,
    findOne: jest.fn(async () => {
      if (options.throws) throw new Error('table settings introuvable');
      return row;
    }),
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
    get row(): Row | null {
      return row;
    },
    set row(value: Row | null) {
      row = value;
    },
  };
  const factory = (() => repo as unknown as ICrudRepository<BaseEntity>) as unknown as RepositoryFactory;
  return { factory, repo };
}

function makeService(env: Record<string, string> = {}, repoOptions: { throws?: boolean } = {}) {
  const { factory, repo } = makeRepo(repoOptions);
  const config = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
  return { service: new BrandSettingsService(factory, config), repo };
}

describe('BrandSettingsService — provenance', () => {
  it('sans base ni variables, rend les défauts du dépôt', async () => {
    const { service } = makeService();
    await expect(service.current()).resolves.toEqual(BRAND_DEFAULTS);
  });

  it('le défaut est la marque demandée, pas un reste de « SARI OS »', async () => {
    const { service } = makeService();
    const brand = await service.current();
    expect(brand.title).toBe('SARI CMS');
  });

  it('les variables priment sur les défauts', async () => {
    const { service } = makeService({
      SARI_BRAND_TITLE: 'Clinique Horizon',
      SARI_BRAND_SUBTITLE: 'Poste de soin',
      SARI_BRAND_LOGO: '/uploads/horizon.png',
    });
    await expect(service.current()).resolves.toEqual({
      title: 'Clinique Horizon',
      subtitle: 'Poste de soin',
      logo: '/uploads/horizon.png',
    });
  });

  it('une variable vide retire l’accroche au lieu de la remettre par défaut', () => {
    // `SARI_BRAND_SUBTITLE=` veut dire « pas de seconde ligne ». Si le vide
    // retombait sur le défaut, il n’y aurait plus aucun moyen de la supprimer
    // sans passer par la base.
    const present = makeService({ SARI_BRAND_SUBTITLE: '' });
    expect(present.service.fromEnv().subtitle).toBe('');
    const absent = makeService();
    expect(absent.service.fromEnv().subtitle).toBe(BRAND_DEFAULTS.subtitle);
  });

  it('la base prime sur les variables', async () => {
    const { service, repo } = makeService({ SARI_BRAND_TITLE: 'Depuis .env' });
    repo.row = { id: 1, key: BRAND_KEY, value: { title: 'Depuis la base' } };
    const brand = await service.current();
    expect(brand.title).toBe('Depuis la base');
    // subtitle et logo absents de la ligne enregistrée : rien n'est hérité de
    // l'environnement ici, et c'est voulu — la ligne fait foi en bloc.
    expect(brand.subtitle).toBe('');
  });

  it('source dit « db » dès qu’une ligne existe, « env » sinon', async () => {
    const empty = makeService({ SARI_BRAND_TITLE: 'X' });
    expect((await empty.service.status()).source).toBe('env');

    const stored = makeService();
    stored.repo.row = { id: 1, key: BRAND_KEY, value: { title: 'Y', subtitle: '', logo: '' } };
    expect((await stored.service.status()).source).toBe('db');

    const nothing = makeService();
    expect((await nothing.service.status()).source).toBe('default');
  });

  it('une table absente ne casse pas l’affichage : on retombe sur l’environnement', async () => {
    const { service } = makeService({ SARI_BRAND_TITLE: 'Repli .env' }, { throws: true });
    await expect(service.current()).resolves.toMatchObject({ title: 'Repli .env' });
  });
});

describe('BrandSettingsService — validation', () => {
  it('un titre vide est refusé', () => {
    const { service } = makeService();
    expect(() => service.validate({ title: '   ' })).toThrow(BadRequestException);
  });

  it('un titre trop long est tronqué à la borne affichée', () => {
    const { service } = makeService();
    const out = service.validate({ title: 'Z'.repeat(BRAND_LIMITS.title.max + 30) });
    expect(out.title).toHaveLength(BRAND_LIMITS.title.max);
  });

  it('les espaces de bordure sont retirés', () => {
    const { service } = makeService();
    expect(service.validate({ title: '  SARI CMS  ' }).title).toBe('SARI CMS');
  });

  it('un schéma d’URL autre qu’image est refusé à l’enregistrement', () => {
    const { service } = makeService();
    expect(() => service.validate({ title: 'A', logo: 'javascript:alert(1)' })).toThrow(BadRequestException);
    expect(() => service.validate({ title: 'A', logo: 'data:text/html,<script>' })).toThrow(BadRequestException);
  });

  it('les trois formes attendues sont acceptées', () => {
    const { service } = makeService();
    expect(service.validate({ title: 'A', logo: '/uploads/logo.png' }).logo).toBe('/uploads/logo.png');
    expect(service.validate({ title: 'A', logo: 'https://cdn.example/logo.svg' }).logo).toBe('https://cdn.example/logo.svg');
    expect(service.validate({ title: 'A', logo: 'data:image/png;base64,AAA' }).logo).toContain('data:image/png');
  });

  it('une accroche vide est l’option légitime, pas un défaut', () => {
    const { service } = makeService();
    expect(service.validate({ title: 'A', subtitle: '   ' }).subtitle).toBe('');
  });
});

describe('BrandSettingsService — une valeur hostile déjà en base', () => {
  /**
   * La base peut contenir une valeur écrite avant ces contrôles, ou injectée
   * ailleurs. `current()` ne lève pas — il est appelé par l'écran de connexion,
   * avant authentification — il écarte ce qui ne peut pas être affiché.
   */
  it('le logo douteux est vidé à la lecture, et non rendu', async () => {
    const { service, repo } = makeService();
    repo.row = { id: 1, key: BRAND_KEY, value: { title: 'A', subtitle: '', logo: 'javascript:alert(1)' } };
    await expect(service.current()).resolves.toMatchObject({ logo: '' });
  });

  it('un titre réduit à vide en base retrouve le défaut', async () => {
    const { service, repo } = makeService();
    repo.row = { id: 1, key: BRAND_KEY, value: { title: '   ', subtitle: 'x', logo: '' } };
    const brand = await service.current();
    expect(brand.title).toBe(BRAND_DEFAULTS.title);
    expect(brand.subtitle).toBe('x');
  });
});

describe('BrandSettingsService — écriture', () => {
  it('une première sauvegarde crée la ligne, la suivante la met à jour', async () => {
    const { service, repo } = makeService();
    await service.save({ title: 'SARI CMS', subtitle: 'Administration', logo: '' });
    expect(repo.create).toHaveBeenCalledTimes(1);
    await service.save({ title: 'SARI CMS', subtitle: 'v2', logo: '' });
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('réinitialiser supprime la ligne et fait revenir les variables', async () => {
    const { service, repo } = makeService({ SARI_BRAND_TITLE: 'Depuis .env' });
    await service.save({ title: 'Depuis la base', subtitle: '', logo: '' });
    await service.reset();
    await expect(service.current()).resolves.toMatchObject({ title: 'Depuis .env' });
    expect(repo.hardDelete).toHaveBeenCalled();
  });

  it('la sauvegarde renvoie l’état complet, pas le seul corps envoyé', async () => {
    const { service } = makeService();
    const status = await service.save({ title: 'SARI CMS', subtitle: '', logo: '' });
    expect(status).toHaveProperty('source', 'db');
    expect(status.title).toBe('SARI CMS');
  });
});
