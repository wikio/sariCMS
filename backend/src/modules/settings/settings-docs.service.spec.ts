import { BadRequestException } from '@nestjs/common';
import { COLLECTIONS } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { DOC_KINDS, isDocKind, SettingsDocsService } from './settings-docs.service';

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
  return { factory, repo, service: new SettingsDocsService(factory) };
}

describe('SettingsDocsService — garde-fous', () => {
  it('les six réglages admis sont les seuls connus', () => {
    expect(DOC_KINDS.slice().sort()).toEqual(
      ['admin', 'currencies', 'notify', 'payments', 'shop', 'taxonomies'],
    );
    expect(isDocKind('admin')).toBe(true);
    expect(isDocKind('users')).toBe(false);
  });

  it('une clé inconnue est refusée en lecture comme en écriture', async () => {
    const { service } = makeRepo();
    await expect(service.status('secrets')).rejects.toThrow(BadRequestException);
    await expect(service.save('secrets', { a: 1 })).rejects.toThrow(BadRequestException);
  });

  /**
   * Le point pour lequel la liste blanche existe. Ces quatre champs contiennent
   * des identifiants ; ils ne doivent pas se retrouver dans une base que toute
   * sauvegarde reproduit.
   */
  it('les réglages `admin` perdent smtp, db et erp', async () => {
    const { service, repo } = makeRepo();
    await service.save('admin', {
      defaultLocale: 'fr',
      dates: { format: 'long' },
      smtp: { host: 'smtp.example', pass: 'mot-de-passe' },
      db: { url: 'mysql://root:pass@host/db' },
      erp: { apiKey: 'CLE' },
      siteLogo: '/uploads/x.png',
    });
    const stored = repo.row?.value as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['dates', 'defaultLocale']);
    expect(stored).not.toHaveProperty('smtp');
    expect(stored).not.toHaveProperty('erp');
    expect(stored).not.toHaveProperty('db');
    // Le logo de vitrine a sa place dans `ContactInfo`, pas ici.
    expect(stored).not.toHaveProperty('siteLogo');
  });

  it('un mode de paiement perd sa clé d’API, à l’écriture comme à la relecture', async () => {
    const { service, repo } = makeRepo();
    await service.save('payments', [
      { id: 'p1', name: 'Carte internationale', type: 'card-intl', apiKey: 'sk_live_424242424242' },
      { id: 'p3', name: 'Virement', type: 'transfer', iban: 'DZ58 0079 …' },
    ]);

    // La ligne telle qu'elle est réellement stockée — c'est ce que lira une
    // sauvegarde de la base, et ce que renverrait une API sans projection.
    const stored = (repo.row as { value: { items: Record<string, unknown>[] } }).value;
    expect(stored.items[0].apiKey).toBeUndefined();
    expect(stored.items[0].name).toBe('Carte internationale');

    const again = await service.status('payments');
    expect((again.payload as Record<string, unknown>[])[0].apiKey).toBeUndefined();
  });

  it('une clé d’API déjà en base ne ressort pas à la lecture', async () => {
    // Le cas réel d'une production : le document a été écrit avant la règle, le
    // secret est donc dans `settings.value`. Seule la projection à la sortie le
    // retient — filtrer l'écriture seule ne dirait rien de l'existant. La ligne est
    // posée par-dessus le magasin, comme l'aurait fait un `UPDATE` à la main.
    const { service, repo } = makeRepo();
    await service.save('payments', [{ id: 'p1', name: 'Carte', type: 'card-intl' }]);
    const row = repo.row as { key: string; value: { items: Record<string, unknown>[] } };
    row.value.items[0].apiKey = 'sk_live_avant_la_regue';
    const status = await service.status('payments');
    expect(JSON.stringify(status.payload)).not.toContain('sk_live_');
    expect(JSON.stringify(status.document)).not.toContain('sk_live_');
  });

  it('la config boutique perd importApi, qui porte une clé d’API', async () => {
    const { service, repo } = makeRepo();
    await service.save('shop', {
      currency: 'DZD',
      deliveryZones: [{ id: '1', label: 'Alger' }],
      importApi: { url: 'https://x', apiKey: 'CLE' },
    });
    const stored = repo.row?.value as Record<string, unknown>;
    expect(stored).toHaveProperty('currency', 'DZD');
    expect(stored).toHaveProperty('deliveryZones');
    expect(stored).not.toHaveProperty('importApi');
  });
});

describe('SettingsDocsService — formes de document', () => {
  /**
   * Régression que la liste blanche seule aurait installée : les taxonomies sont
   * indexées par taxon, et le jeu de taxons s'étend depuis l'écran. Restreindre
   * leurs clés aurait vidé silencieusement tout taxon non prévu.
   */
  it('les taxonomies conservent n’importe quelle clé de taxon', async () => {
    const { service, repo } = makeRepo();
    await service.save('taxonomies', {
      'partner-categories': [{ value: 'Cardiologie', label: 'Cardiologie' }],
      'un-taxon-ajoute-hier': [{ value: 'X', label: 'X' }],
    });
    const stored = repo.row?.value as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['partner-categories', 'un-taxon-ajoute-hier']);
  });

  it('une valeur qui n’est pas une liste de termes est écartée', async () => {
    const { service, repo } = makeRepo();
    await service.save('taxonomies', { ok: [{ value: 'a', label: 'a' }], pasOk: 'chaîne', nul: null });
    expect(Object.keys(repo.row?.value as Record<string, unknown>)).toEqual(['ok']);
  });

  it('un tableau est stocké enveloppé et rendu nu', async () => {
    const { service } = makeRepo();
    const status = await service.save('currencies', [
      { code: 'DZD', label: 'Dinar algérien' },
      { code: 'EUR', label: 'Euro' },
    ]);
    expect(status.payload).toEqual([
      { code: 'DZD', label: 'Dinar algérien' },
      { code: 'EUR', label: 'Euro' },
    ]);
  });

  /*
   * Le défaut que ce cas empêche : à l'écriture, une liste est enveloppée
   * `{ items: [...] }`. Si la relecture repasse cette enveloppe par la projection
   * réservée au client — qui attend un tableau nu — elle devient `{ items: [] }`,
   * la base semble vide, et l'écran écrit `[]` dans son cache : la liste de
   * l'opérateur disparaît au rechargement. Découvert ici, et non en production.
   */
  it('une liste survit à une écriture puis une relecture séparées', async () => {
    const { service } = makeRepo();
    await service.save('currencies', [{ code: 'DZD', label: 'Dinar algérien' }]);
    // La forme de stockage est l'enveloppe ; c'est `status` qui la déplie pour
    // l'écran. Les deux doivent rendre la liste, pas seulement l'une des deux.
    expect(await service.read('currencies')).toEqual({
      items: [{ code: 'DZD', label: 'Dinar algérien' }],
    });
    const again = await service.status('currencies');
    expect(again.payload).toEqual([{ code: 'DZD', label: 'Dinar algérien' }]);
  });

  it('le corps HTML d’un gabarit de message est conservé tel quel', async () => {
    const { service } = makeRepo();
    const row = {
      id: 'm1',
      name: 'Réapprovisionnement prévu',
      trigger: 'stock_backorder',
      subject: 'Votre commande {{numero_commande}} sera traitée',
      body: '<p>Bonjour {{nom_client}},</p><p>Nouvel arrivage le <strong>12/10</strong>.</p>',
      active: true,
      locale: 'fr',
    };
    await service.save('notify', [row]);
    expect(await service.read('notify')).toEqual({ items: [row] });
  });

  it('un objet envoyé pour une clé attendue en liste est refusé', async () => {
    const { service } = makeRepo();
    await expect(service.save('currencies', { items: [] })).rejects.toThrow(BadRequestException);
  });

  it('une liste envoyée pour une clé attendue en objet est refusée', async () => {
    const { service } = makeRepo();
    await expect(service.save('admin', [{ a: 1 }])).rejects.toThrow(BadRequestException);
  });

  it('une liste vide enregistrée est une suppression consentie, pas une absence', async () => {
    const { service, repo } = makeRepo();
    await service.save('payments', []);
    expect(repo.row).not.toBeNull();
    const status = await service.status('payments');
    expect(status.source).toBe('db');
    expect(status.payload).toEqual([]);
  });
});

describe('SettingsDocsService — écriture et tolérance', () => {
  it('une première sauvegarde crée la ligne, la suivante la met à jour', async () => {
    const { service, repo } = makeRepo();
    await service.save('shop', { currency: 'DZD' });
    expect(repo.create).toHaveBeenCalledTimes(1);
    await service.save('shop', { currency: 'EUR' });
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('la ligne porte le préfixe doc_ et un groupe, pour la purge et l’audit', async () => {
    const { service, repo } = makeRepo();
    await service.save('currencies', []);
    expect(repo.row?.key).toBe('doc_currencies');
    expect(repo.row?.group).toBe('settings-doc');
  });

  it('réinitialiser supprime et fait revenir aux défauts de l’écran', async () => {
    const { service, repo } = makeRepo();
    await service.save('shop', { currency: 'DZD' });
    const status = await service.reset('shop');
    expect(status).toMatchObject({ document: null, source: 'default' });
    expect(repo.hardDelete).toHaveBeenCalled();
  });

  it('une table absente ne casse pas l’ouverture de l’écran', async () => {
    const { service } = makeRepo({ throws: true });
    await expect(service.read('admin')).resolves.toBeNull();
    await expect(service.status('admin')).resolves.toMatchObject({ source: 'default' });
  });

  it('une taille démesurée est refusée avant écriture', async () => {
    const { service } = makeRepo();
    const huge = { defaultLocale: 'x'.repeat(300 * 1024) };
    await expect(service.save('admin', huge)).rejects.toThrow(/maximum/);
  });
});
