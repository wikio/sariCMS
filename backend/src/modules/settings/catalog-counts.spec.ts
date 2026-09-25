import { COLLECTIONS } from '../../common/constants/tokens';
import {
  BaseEntity,
  ICrudRepository,
  RepositoryFactory,
} from '../../common/crud/interfaces/repository.interface';
import { CatalogImportService } from './catalog-import.service';

/**
 * Ce que l'accueil de l'administration affiche comme volumes, et ce qu'il doit
 * afficher quand la base ne sait pas répondre.
 *
 * Le défaut qui a motivé ces lignes : `payment_records` n'avait pas été créée sur
 * une base de production, `count()` levait P2021, et `/settings/status` — un seul
 * `await` par collection, sans garde — répondait 500. L'accueil se retrouvait donc
 * **sans aucun chiffre**, y compris les produits et les pages qui se comptaient
 * très bien. Un compteur indisponible doit être une absence nommée, pas une page
 * vide : la clé sort de `counts` (le front affiche `—`, jamais `0`) et la
 * collection est listée dans `unavailable`.
 */
function service(opts: { fail?: string[]; counts?: Record<string, number> } = {}) {
  const factory = ((collection: string) =>
    ({
      collection,
      count: async () => {
        if (opts.fail?.includes(collection)) {
          throw new Error(`The table \`${collection}\` does not exist in this database.`);
        }
        return opts.counts?.[collection] ?? 0;
      },
    }) as unknown as ICrudRepository<BaseEntity>) as unknown as RepositoryFactory;
  return new CatalogImportService(factory, { get: () => undefined } as never);
}

describe('CatalogImportService.inventory — un chiffre indisponible n’est pas un zéro', () => {
  it('compte ce que la base fournit', async () => {
    const { counts, unavailable } = await service({
      counts: { [COLLECTIONS.products]: 7, [COLLECTIONS.orders]: 3 },
    }).inventory();

    expect(counts.products).toBe(7);
    expect(counts.orders).toBe(3);
    expect(unavailable).toEqual([]);
  });

  it('omet la collection muette au lieu de l’écrire à zéro', async () => {
    const { counts, unavailable } = await service({
      counts: { [COLLECTIONS.products]: 7 },
      fail: [COLLECTIONS.paymentRecords],
    }).inventory();

    // La clé absente est le signal attendu par l'accueil : `paymentRecords` n'est
    // pas 0, il est inconnu.
    expect('paymentRecords' in counts).toBe(false);
    expect(counts.products).toBe(7);
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0]).toContain('paymentRecords');
  });

  it('continue de compter après un échec — pas de boucle interrompue', async () => {
    const { counts } = await service({
      counts: { [COLLECTIONS.taxRules]: 4 },
      fail: [COLLECTIONS.coupons],
      // `coupons` est compté AVANT `taxRules` dans la liste du service : si la
      // boucle s'arrêtait sur l'échec, le compteur suivant serait absent.
      // est testé ici par la présence de taxRules après un échec antérieur.
    }).inventory();

    expect(counts.taxRules).toBe(4);
  });
});
