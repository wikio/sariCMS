import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { PRODUCT_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';
import { SettingsDocsService } from '../settings/settings-docs.service';
import {
  DEFAULT_PRODUCT_CODE_FORMAT,
  renderSku,
  skuSequence,
  SkuSeqService,
  SKU_ATTEMPTS_LIMIT,
} from '../settings/sku-seq.service';
import { ProductEntity } from './entities/product.entity';

@Injectable()
export class ProductsService extends BaseCrudService<ProductEntity> {
  private readonly logger = new Logger(ProductsService.name);
  protected readonly repository: ICrudRepository<ProductEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'products',
    searchFields: ['name', 'shortDesc', 'category', 'sku'],
    // `sku` triable : c'est ce qui permet de retrouver la plus haute référence
    // existante sans parcourir le catalogue entier, et un écran de liste qui peut
    // trier par référence n'est pas un défaut.
    sortableFields: ['createdAt', 'updatedAt', 'name', 'category', 'price', 'sortOrder', 'sku'],
    listFields: ['id', 'slug', 'name', 'category', 'price', 'inStock', 'status'],
    cardFields: [
      'id',
      'slug',
      'name',
      'category',
      'price',
      'shortDesc',
      'image',
      'inStock',
      'status',
    ],
  };

  constructor(
    @Inject(PRODUCT_REPOSITORY) repository: ICrudRepository<ProductEntity>,
    cache: AppCacheService,
    audit: AuditService,
    private readonly skuSeq: SkuSeqService,
    private readonly docs: SettingsDocsService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  /**
   * Attribution de la référence, à la création seulement, ici et pas dans le
   * navigateur. Le pourquoi est développé dans `sku-seq.service.ts` : deux
   * compteurs locaux indépendants publiaient des produits portant le même SKU,
   * et la base — `sku` sans contrainte d'unicité — n'a rien signalé.
   *
   * Une référence saisie à la main reste telle quelle : c'est souvent un code
   * fabricant ou un code repris de l'ERP, et le réécrire en silence serait
   * pire que le défaut combattu. Le compteur est seulement recalé au-dessus,
   * pour qu'une attribution ultérieure ne redescende pas dessous.
   */
  override async create(dto: Partial<ProductEntity>, actor?: ActorContext): Promise<unknown> {
    const payload = { ...dto };
    const typed = String(payload.sku ?? '').trim();
    if (typed) {
      const n = skuSequence(typed);
      if (n) await this.skuSeq.alignFloor(n).catch(() => undefined);
    } else {
      payload.sku = await this.assignSku();
    }
    return super.create(payload, actor);
  }

  protected override beforeSave(
    dto: Partial<ProductEntity>,
    op: 'create' | 'update',
  ): Partial<ProductEntity> {
    const out = { ...dto };
    if (out.slug === '') delete out.slug;
    if (!out.slug && out.name) out.slug = slugify(String(out.name));
    if (op === 'create') {
      out.locale = out.locale || 'fr';
      out.status = out.status || 'draft';
      if (out.inStock === undefined) out.inStock = true;
      // Plus de repli `PRO-<horodatage>` ici : les cinq derniers chiffres de
      // `Date.now()` bouclent toutes les 100 000 ms, ce qui rendait le doublon
      // probable à environ 1 min 40 s d'intervalle entre deux créations. La
      // référence est attribuée par `create()`, qui consulte le compteur partagé.
    }
    return out;
  }

  /**
   * Première référence libre.
   *
   * Chaque essai consomme un numéro : c'est ce qui fait avancer le compteur au-delà
   * des références déjà prises plutôt que de tourner sur la même. La borne haute
   * évite une boucle sans fin si la table est saturée de codes dans ce format ; la
   * sortie est alors une erreur explicite, jamais une référence inventée en
   * catastrophe.
   *
   * Les lignes de la corbeille comptent comme occupées : le SKU y est toujours en
   * table, et le réattribuer produirait un doublon dès qu'une fiche serait restaurée.
   */
  private async assignSku(): Promise<string> {
    const format = await this.codeFormat();
    const floor = await this.skuFloor();
    for (let attempt = 0; attempt < SKU_ATTEMPTS_LIMIT; attempt += 1) {
      const sequence = await this.skuSeq.reserve(floor);
      const candidate = renderSku(format, sequence);
      const taken = await this.repository.findOne({ sku: candidate }, true);
      if (!taken) return candidate;
      this.logger.log(`référence ${candidate} déjà en table: on passe à la suivante`);
    }
    throw new ServiceUnavailableException(
      `impossible d'attribuer une référence produit libre après ${SKU_ATTEMPTS_LIMIT} essais`,
    );
  }

  /**
   * Format tel que l'écran Paramètres l'a enregistré (`codes.product`), pas un
   * format que le serveur se choisirait lui-même : sinon la référence dépendrait du
   * hasard de savoir qui a sauvegardé l'écran.
   */
  private async codeFormat(): Promise<string> {
    const doc = (await this.docs.read('admin')) as { codes?: { product?: unknown } } | null;
    const format = doc?.codes?.product;
    return typeof format === 'string' && format.trim() ? format.trim() : DEFAULT_PRODUCT_CODE_FORMAT;
  }

  /**
   * Le numéro suivant la plus haute référence déjà en table.
   *
   * Un compteur tout neuf — base restaurée, ligne effacée, premier déploiement — ne
   * doit pas reprendre à 1 là où le catalogue s'arrête à 4 812. On ne scanne pas la
   * table : les références ont un numéro en fin de chaîne et une largeur fixe, donc
   * un tri descendant suivi de la lecture des suffixes suffit.
   *
   * Le `limit` borne le coût ; il arrive qu'un produit hors de l'échantillon porte
   * un numéro plus haut, auquel cas la boucle d'attribution saute par-dessus.
   */
  private async skuFloor(): Promise<number> {
    try {
      const page = await this.repository.findMany({ limit: 200, sortBy: 'sku', sortOrder: 'desc' });
      let max = 0;
      for (const row of page.data) {
        const n = skuSequence(row.sku);
        if (n && n > max) max = n;
      }
      return max + 1;
    } catch (err) {
      this.logger.warn(`plancher de référence indisponible: ${(err as Error).message}`);
      return 1;
    }
  }
}
