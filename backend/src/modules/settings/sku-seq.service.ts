import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import {
  BaseEntity,
  RepositoryFactory,
} from '../../common/crud/interfaces/repository.interface';

/* Même forme que chez les autres services de réglages : une ligne de la table
 * `settings`, valeur en JSON. Pas d'entité dédiée — il n'y a rien à modéliser de
 * plus, et une classe de plus pour quatre colonnes serait du bruit. */
interface SettingRow extends BaseEntity {
  key?: string;
  value?: unknown;
  group?: string;
}

/**
 * Compteur de références produits, côté serveur.
 *
 * Le projet générait ses SKU dans le navigateur : `lib/admin-settings.ts`
 * incrementait `sari_sku_seq`, une clé `localStorage`. Deux conséquences, toutes
 * deux vérifiées dans le code :
 *
 * - **deux administrateurs, deux compteurs.** Chacun repart de 1 après un vidage
 *   de cache, un changement de poste ou une réinstallation. Ils publient donc des
 *   produits portant la **même** référence — et `products.sku` n'a aucune
 *   contrainte d'unicité (`String?`, sans `@unique`) : la base accepte le doublon
 *   sans un mot. Tout ce qui s'appuie sur le SKU — import, stock, facture,
 *   rapprochement ERP — confond alors deux fiches.
 * - **le repli du serveur était pire encore.** Quand aucune référence n'était
 *   fournie, `ProductsService.beforeSave` fabriquait `PRO-` suivi des cinq
 *   derniers chiffres de l'horodatage. Ces chiffres bouclent toutes les
 *   100 000 ms : deux produits créés à environ 1 min 40 s d'intervalle portent la
 *   même référence, et deux créations dans la même milliseconde sont certaines de
 *   la porter.
 *
 * Le compteur vit donc ici, dans la table `settings` (clé `sku_seq`), partagé par
 * tous les postes. Ce module ne fait que **compter** : c'est le service produits
 * qui choisit le format, qui vérifie que la référence est libre et qui garde une
 * référence saisie à la main. Un compteur qui saurait formater des SKU serait un
 * deuxième endroit où la règle change sans que l'autre suive.
 *
 * ### Ce que ça ne règle pas, et pourquoi c'est écrit ici
 *
 * L'abstraction de dépôt (`ICrudRepository`) n'expose ni `UPDATE … WHERE`, ni
 * `RETURNING`, ni transaction : une réservation est une lecture suivie d'une
 * écriture. Deux créations *à la milliseconde près* peuvent donc encore obtenir
 * le même nombre — la boucle anti-collision du service produits rattrape le cas
 * dès que la première écriture est validée, ce qui laisse une fenêtre très
 * petite. Supprimer complètement cette fenêtre demande une table de compteur avec
 * contrainte d'unicité, donc une migration Prisma : à faire quand le déploiement
 * pourra appliquer `migrate deploy` (bloqué aujourd'hui — voir
 * `docs/REPRISE-MYSQL.md` §2.1 ter). Comparé au défaut actuel, qui durait des
 * semaines sans aucun signal, ce n'est pas le même ordre de risque.
 */

/** Clé de la ligne de comptage dans `settings`. */
export const SKU_SEQ_KEY = 'sku_seq';

/** Groupe distinct de `settings-doc` : ce n'est pas un réglage relisible à l'écran. */
export const SKU_SEQ_GROUP = 'counter';

/**
 * Format de référence par défaut, identique à celui de l'écran Paramètres
 * (`DEFAULT_SETTINGS.codes.product`). Un serveur qui aurait son propre défaut
 * fabriquerait des références différentes selon que l'opérateur a ouvert l'écran
 * ou non.
 */
export const DEFAULT_PRODUCT_CODE_FORMAT = 'SARI-WPRO{XX}-{ID}';

/** Nombre maximal de références essayées avant de renoncer, dans le service produits. */
export const SKU_ATTEMPTS_LIMIT = 400;

interface SeqValue {
  /** La prochaine valeur à attribuer. */
  next: number;
  /** Nombre d'écritures subies : sert à repérer qu'un autre poste a bougé entre-temps. */
  rev: number;
}

/**
 * Applique le format d'écran. `{XX}` et `{YY}` donnent l'année sur deux chiffres,
 * `{ID}` le numéro sur cinq — la largeur fixe est ce qui rend un tri lexicographique
 * utile au recalage du compteur.
 */
export function renderSku(format: string, n: number): string {
  const y = new Date().getFullYear();
  const yy = String(y % 100).padStart(2, '0');
  return String(format || DEFAULT_PRODUCT_CODE_FORMAT)
    .replace(/\{XX\}/g, yy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{ID\}/g, String(n).padStart(5, '0'));
}

/** Le numéro inscrit dans une référence existante, ou null si elle n'en porte pas. */
export function skuSequence(sku: unknown): number | null {
  if (typeof sku !== 'string') return null;
  const m = /(\d{1,9})\s*$/.exec(sku.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

@Injectable()
export class SkuSeqService {
  private readonly logger = new Logger(SkuSeqService.name);

  constructor(@Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory) {}

  private repo() {
    return this.factory<SettingRow>(COLLECTIONS.settings);
  }

  /**
   * Ligne courante. Une table absente, un pilote JSON froid, une ligne jamais
   * écrite : toutes ces situations rendent un compteur vierge plutôt qu'une
   * erreur — le service produits le recalera de toute façon sur l'existant.
   */
  private async read(): Promise<SeqValue> {
    try {
      const row = await this.repo().findOne({ key: SKU_SEQ_KEY }, true);
      const value = row?.value as Partial<SeqValue> | undefined;
      const next = Number(value?.next);
      const rev = Number(value?.rev);
      return {
        next: Number.isFinite(next) && next > 0 ? Math.floor(next) : 1,
        rev: Number.isFinite(rev) && rev >= 0 ? Math.floor(rev) : 0,
      };
    } catch (err) {
      this.logger.warn(`compteur de références illisible: ${(err as Error).message}`);
      return { next: 1, rev: 0 };
    }
  }

  /**
   * Dernier numéro distribué dans CE processus. Garde-fou, pas doublon de la base :
   * il intervient quand la ligne n'est ni lisible ni écrivable (table `settings`
   * absente d'une installation neuve, pilote en panne), cas dans quoi le compteur
   * persisté ne peut pas avancer. Sans lui, chaque appel relirait la même valeur et
   * distribuerait le même numéro en boucle.
   *
   * La persistance est une optimisation ; l'unicité, elle, est garantie par le
   * contrôle que le service produits fait en table avant d'insérer. Un compteur
   * qui tombe ne doit pas empêcher de créer un produit.
   */
  private distributedLocally = 0;

  private async write(next: number, rev: number): Promise<boolean> {
    try {
      const existing = await this.repo().findOne({ key: SKU_SEQ_KEY }, true);
      const value = { next, rev };
      if (existing?.id) {
        await this.repo().update(existing.id, { value } as Partial<SettingRow>);
      } else {
        await this.repo().create({
          key: SKU_SEQ_KEY,
          value,
          group: SKU_SEQ_GROUP,
        } as Partial<SettingRow>);
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `compteur de références non persisté (${(err as Error).message}) : la suite est assurée en mémoire, ` +
          'et l’unicité par le contrôle en table du service produits',
      );
      return false;
    }
  }

  /** Ce que la prochaine réservation rendrait, sans rien consommer. */
  async peek(): Promise<number> {
    return (await this.read()).next;
  }

  /**
   * Réserve la valeur courante et fait avancer le compteur.
   *
   * `floor` est le plancher calculé par le service produits à partir des références
   * déjà en table : sans lui, un compteur neuf (base restaurée, poste neuf, ligne
   * effacée) repartirait de 1 et attribuerait des références déjà prises. Le
   * plancher gagne, toujours — un compteur en retard est un accident de
   * restauration, pas une intention.
   *
   * La relecture qui suit l'écriture ne remplace pas un `UPDATE … WHERE` : elle ne
   * fait que signaler, dans le journal, qu'un autre poste a progressé pendant
   * notre écriture. C'est un instrument de diagnostic, pas une garantie, et il
   * serait malhonnête de le vendre comme une atomicité.
   */
  async reserve(floor = 1): Promise<number> {
    const current = await this.read();
    const mine = Math.max(current.next, Math.floor(floor) || 1, this.distributedLocally + 1);
    if (!Number.isSafeInteger(mine) || mine < 1) {
      throw new BadRequestException('compteur de références: valeur hors bornes');
    }
    this.distributedLocally = mine;
    const persisted = await this.write(mine + 1, current.rev + 1);
    if (persisted) {
      const after = await this.read();
      if (after.next < mine + 1) {
        this.logger.warn(
          `compteur de références: un autre poste a écrit pendant la réservation (${after.next} < ${mine + 1})`,
        );
      }
    }
    return mine;
  }

  /**
   * Recale le compteur sans consommer de numéro — utilisé quand une référence a
   * été saisie à la main plus haut que le compteur, pour que le poste suivant ne
   * reparte pas en dessous.
   */
  async alignFloor(floor: number): Promise<void> {
    const wanted = Math.floor(Number(floor) || 0);
    if (wanted < 1) return;
    const current = await this.read();
    this.distributedLocally = Math.max(this.distributedLocally, wanted);
    if (current.next >= wanted + 1) return;
    await this.write(wanted + 1, current.rev + 1);
  }
}
