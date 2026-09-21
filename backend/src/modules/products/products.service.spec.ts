import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ProductEntity } from './entities/product.entity';
import { ProductsService } from './products.service';

const cache = { delByPrefix: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as AppCacheService;
const audit = { record: jest.fn() } as unknown as AuditService;

interface Deps {
  created: jest.Mock;
  findOne: jest.Mock;
  findMany: jest.Mock;
  reserve: jest.Mock;
  alignFloor: jest.Mock;
  service: ProductsService;
}

/**
 * Le service prend désormais un compteur de références et les réglages d'écran.
 * Les deux sont simulés ici plutôt que rechargés depuis un module : ce que ces
 * tests doivent prouver tient au **jeu entre les deux** (qui consomme un numéro,
 * quand on en garde un saisi, ce qui se passe si la référence est prise), pas à
 * leur fonctionnement interne — celui du compteur est testé pour son compte dans
 * `sku-seq.service.spec.ts`.
 *
 * `from` est le premier numéro que le compteur rend ; chaque réservation suivant
 * consomme le suivant, comme en vrai.
 */
function makeDeps(opts: {
  taken?: string[];
  existingSkus?: string[];
  doc?: Record<string, unknown> | null;
  from?: number;
} = {}): Deps {
  const taken = new Set(opts.taken ?? []);
  const created = jest.fn(async (d: Partial<ProductEntity>) => ({ id: 1, ...d }) as ProductEntity);
  let next = opts.from ?? 1;
  // Comme le vrai compteur : le plancher calculé sur l'existant gagne, et chaque
  // réservation consomme.
  const reserve = jest.fn(async (floor = 1) => {
    const mine = Math.max(next, Math.floor(floor) || 1);
    next = mine + 1;
    return mine;
  });
  const alignFloor = jest.fn(async () => undefined);
  const findMany = jest.fn(async () => ({
    data: (opts.existingSkus ?? []).map((sku) => ({ sku })) as ProductEntity[],
    meta: { total: (opts.existingSkus ?? []).length, page: 1, limit: 200, totalPages: 1 },
  }));
  const findOne = jest.fn(async (where: Record<string, unknown>) =>
    taken.has(String(where.sku)) ? ({ id: 99, sku: where.sku } as ProductEntity) : null,
  );
  const repo = {
    collection: 'products',
    create: created,
    findOne,
    findMany,
  } as unknown as ICrudRepository<ProductEntity>;
  const skuSeq = { reserve, alignFloor, peek: jest.fn(async () => next) };
  const docs = { read: jest.fn(async () => (opts.doc === undefined ? null : opts.doc)) };
  const service = new ProductsService(
    repo,
    cache,
    audit,
    skuSeq as never,
    docs as never,
  );
  return { created, findOne, findMany, reserve, alignFloor, service };
}

describe('ProductsService', () => {
  it('defaults inStock=true, locale=fr and builds a slug from the name', async () => {
    const { service } = makeDeps();
    const created = (await service.create({
      name: 'Échographe portable X1',
      specs: { sonde: 'linéaire' },
      options: [{ name: 'Sonde', choices: ['3-5 MHz', '7-12 MHz'] }],
    } as Partial<ProductEntity>)) as ProductEntity;
    expect(created.slug).toBe('echographe-portable-x1');
    expect(created.inStock).toBe(true);
    expect(created.locale).toBe('fr');
    expect(created.status).toBe('draft');
  });

  it('keeps an explicit inStock=false', async () => {
    const { service } = makeDeps();
    const created = (await service.create({
      name: 'Rupture',
      inStock: false,
    } as Partial<ProductEntity>)) as ProductEntity;
    expect(created.inStock).toBe(false);
  });

  /*
   * Le défaut d'origine : la référence naissait dans le navigateur, dans
   * `localStorage`. Deux postes, deux compteurs, deux produits portant le même
   * SKU — et rien dans la base pour le refuser.
   */
  it('attribue la référence lui-même quand aucune n’est fournie', async () => {
    const { service, created } = makeDeps();
    await service.create({ name: 'Capteur' } as Partial<ProductEntity>);
    const sku = String((created.mock.calls[0][0] as ProductEntity).sku);
    const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
    expect(sku).toBe(`SARI-WPRO${yy}-00001`);
    // Plus de `PRO-<horodatage>` : cinq chiffres qui bouclent toutes les
    // 100 000 ms n'étaient pas une référence, c'était un tirage.
    expect(sku).not.toMatch(/^PRO-\d+$/);
  });

  it('utilise le format enregistré à l’écran Paramètres', async () => {
    const { service, created } = makeDeps({ doc: { codes: { product: 'CAB-{ID}' } } });
    await service.create({ name: 'Câble' } as Partial<ProductEntity>);
    expect((created.mock.calls[0][0] as ProductEntity).sku).toBe('CAB-00001');
  });

  it('garde une référence saisie à la main et recale le compteur au-dessus', async () => {
    const { service, created, alignFloor, reserve } = makeDeps();
    await service.create({ name: 'Écho-endoscope', sku: 'ER-77' } as Partial<ProductEntity>);
    expect((created.mock.calls[0][0] as ProductEntity).sku).toBe('ER-77');
    expect(alignFloor).toHaveBeenCalledWith(77);
    // Surtout : aucun numéro consommé, le code vient de l'opérateur.
    expect(reserve).not.toHaveBeenCalled();
  });

  it('passe à la référence suivante quand la première est déjà en table', async () => {
    const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
    const { service, created } = makeDeps({ taken: [`SARI-WPRO${yy}-00001`] });
    await service.create({ name: 'Palpeur' } as Partial<ProductEntity>);
    expect((created.mock.calls[0][0] as ProductEntity).sku).toBe(`SARI-WPRO${yy}-00002`);
  });

  it('ne repart pas de 1 sur un compteur neuf alors que le catalogue est rempli', async () => {
    const { service, created } = makeDeps({ existingSkus: ['SARI-WPRO25-04812', 'SARI-WPRO25-04810'] });
    await service.create({ name: 'Nouvelle fiche' } as Partial<ProductEntity>);
    expect((created.mock.calls[0][0] as ProductEntity).sku).toBe('SARI-WPRO26-04813');
  });

  it('compte une référence de la corbeille comme occupée', async () => {
    // `findOne(…, true)` : le SKU reste en table tant que la fiche n'est pas
    // purgée, le réattribuer ferait un doublon dès la restauration.
    const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
    const { service, findOne } = makeDeps({ taken: [`SARI-WPRO${yy}-00001`] });
    await service.create({ name: 'Saturimètre' } as Partial<ProductEntity>);
    expect(findOne).toHaveBeenCalledWith({ sku: `SARI-WPRO${yy}-00001` }, true);
  });

  it('refuse d’inventer une référence plutôt que de boucler sans fin', async () => {
    const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
    const everyTaken = Array.from(
      { length: 400 },
      (_, i) => `SARI-WPRO${yy}-${String(i + 1).padStart(5, '0')}`,
    );
    const { service, created } = makeDeps({ taken: everyTaken });
    await expect(service.create({ name: 'Sans place' } as Partial<ProductEntity>)).rejects.toThrow(
      /impossible d'attribuer/,
    );
    expect(created).not.toHaveBeenCalled();
  });
});
