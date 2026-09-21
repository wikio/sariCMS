import { COLLECTIONS } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import {
  DEFAULT_PRODUCT_CODE_FORMAT,
  renderSku,
  skuSequence,
  SkuSeqService,
  SKU_SEQ_GROUP,
  SKU_SEQ_KEY,
} from './sku-seq.service';

interface Row {
  id?: number;
  key?: string;
  value?: unknown;
  group?: string;
}

function makeRepo(options: { readThrows?: boolean; writeThrows?: boolean } = {}) {
  let row: Row | null = null;
  const repo = {
    collection: COLLECTIONS.settings,
    findOne: jest.fn(async () => {
      if (options.readThrows) throw new Error('table settings introuvable');
      return row;
    }),
    create: jest.fn(async (data: Partial<Row>) => {
      if (options.writeThrows) throw new Error('écriture refusée');
      row = { ...(data as Row), id: 1 };
      return row;
    }),
    update: jest.fn(async (_id: number, data: Partial<Row>) => {
      if (options.writeThrows) throw new Error('écriture refusée');
      row = { ...row, ...data } as Row;
      return row as Row;
    }),
    get row(): Row | null {
      return row;
    },
    set row(value: Row | null) {
      row = value;
    },
  };
  const factory = (() => repo as unknown as ICrudRepository<BaseEntity>) as unknown as RepositoryFactory;
  return { factory, repo, service: new SkuSeqService(factory) };
}

const yy = String(new Date().getFullYear() % 100).padStart(2, '0');

describe('renderSku / skuSequence — le format, un seul endroit', () => {
  it('forme le numéro sur cinq chiffres et remplace l’année', () => {
    expect(renderSku('SARI-WPRO{XX}-{ID}', 7)).toBe(`SARI-WPRO${yy}-00007`);
    expect(renderSku('CAB-{YY}-{ID}', 123456)).toBe(`CAB-${yy}-123456`);
  });

  it('remplit les deux jetons quand le format en répète un', () => {
    expect(renderSku('{XX}{XX}-{ID}', 1)).toBe(`${yy}${yy}-00001`);
  });

  it('retombe sur le format de l’écran Paramètres si celui reçu est vide', () => {
    expect(renderSku('', 3)).toBe(renderSku(DEFAULT_PRODUCT_CODE_FORMAT, 3));
    expect(DEFAULT_PRODUCT_CODE_FORMAT).toBe('SARI-WPRO{XX}-{ID}');
  });

  it('relit le numéro en fin de référence', () => {
    expect(skuSequence('SARI-WPRO25-04812')).toBe(4812);
    expect(skuSequence('ER-77')).toBe(77);
    expect(skuSequence('  REF-12  ')).toBe(12);
    // Pas de numéro en fin de chaîne, ou un zéro : rien à recalquer.
    expect(skuSequence('ABC')).toBeNull();
    expect(skuSequence('REF-0')).toBeNull();
    expect(skuSequence(undefined)).toBeNull();
    expect(skuSequence(12345)).toBeNull();
  });
});

describe('SkuSeqService — le compteur partagé', () => {
  it('une première réservation crée la ligne, avec le groupe de comptage', async () => {
    const { service, repo } = makeRepo();
    expect(await service.reserve()).toBe(1);
    expect(repo.row?.key).toBe(SKU_SEQ_KEY);
    expect(repo.row?.group).toBe(SKU_SEQ_GROUP);
    expect(repo.row?.value).toEqual({ next: 2, rev: 1 });
  });

  it('fait avancer le compteur et incrémente la révision', async () => {
    const { service, repo } = makeRepo();
    expect(await service.reserve()).toBe(1);
    expect(await service.reserve()).toBe(2);
    expect(await service.reserve()).toBe(3);
    expect(repo.row?.value).toEqual({ next: 4, rev: 3 });
  });

  it('peek ne consomme pas le numéro', async () => {
    const { service, repo } = makeRepo();
    await service.reserve();
    await service.reserve();
    expect(repo.row?.value).toEqual({ next: 3, rev: 2 });
    expect(await service.peek()).toBe(3);
    expect(await service.peek()).toBe(3);
    expect(repo.row?.value).toEqual({ next: 3, rev: 2 });
  });

  /*
   * Le cas qui rend le composant utile : une base restaurée, un poste neuf, une
   * ligne effacée. Sans plancher, le compteur repart de 1 et distribue des
   * références déjà prises — exactement le défaut qu'on combat, sous une autre
   * forme.
   */
  it('le plancher calculé sur l’existant bat un compteur en retard', async () => {
    const { service, repo } = makeRepo();
    expect(await service.reserve(4813)).toBe(4813);
    expect(repo.row?.value).toEqual({ next: 4814, rev: 1 });
    expect(await service.reserve(1)).toBe(4814);
  });

  it('alignFloor ne redescend jamais, et ne consomme pas', async () => {
    const { service, repo } = makeRepo();
    await service.alignFloor(77);
    expect(repo.row?.value).toEqual({ next: 78, rev: 1 });
    await service.alignFloor(5);
    expect(repo.row?.value).toEqual({ next: 78, rev: 1 });
    expect(await service.reserve()).toBe(78);
  });

  it('une ligne dont la valeur est folle est relue comme un compteur vierge', async () => {
    // Une base reprise à la main, un type changé, un JSON partiel : le compteur
    // repart de 1 plutôt que de propager un `NaN` dans une référence publiée.
    const { service, repo } = makeRepo();
    repo.row = { id: 1, key: SKU_SEQ_KEY, value: { next: 'beaucoup' }, group: SKU_SEQ_GROUP };
    expect(await service.peek()).toBe(1);
    expect(await service.reserve()).toBe(1);
    expect(repo.row?.value).toEqual({ next: 2, rev: 1 });
  });

  /*
   * Installations neuves et pilotes en panne : la table `settings` peut être
   * absente. Un compteur indisponible ne doit pas empêcher de créer un produit —
   * l'unicité est assurée par le contrôle en table du service produits, la
   * persistance n'est qu'une optimisation.
   */
  it('la table absente ne bloque pas l’attribution, et la suite reste monotone', async () => {
    const { service } = makeRepo({ readThrows: true, writeThrows: true });
    expect(await service.peek()).toBe(1);
    expect(await service.reserve()).toBe(1);
    expect(await service.reserve()).toBe(2);
    expect(await service.reserve()).toBe(3);
  });

  it('une écriture refusée après une lecture correcte continue d’avancer', async () => {
    const { service } = makeRepo({ writeThrows: true });
    expect(await service.reserve()).toBe(1);
    expect(await service.reserve()).toBe(2);
  });
});
