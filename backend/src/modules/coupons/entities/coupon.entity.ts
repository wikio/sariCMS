import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

/**
 * Ligne de la table `coupons`.
 *
 * Vient du `localStorage` (`lib/shop-store.ts`) : les noms de champs côté
 * navigateur sont `start`/`end` (chaînes `AAAA-MM-JJ`) alors que la base porte
 * de vraies dates `startDate`/`endDate`. La conversion se fait dans
 * `CouponsService.toEntity()` à l'entrée et `fromEntity()` à la sortie, pour que
 * le contrat HTTP reste celui que l'interface connaissait déjà.
 */
export interface CouponEntity extends BaseEntity {
  code: string;
  type: string;
  amount: number;
  maxDiscount?: number | null;
  minOrder?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  limitGlobal?: number | null;
  limitPerClient?: number | null;
  used?: number;
  scope?: string;
  scopeValues?: unknown;
  excludeValues?: unknown;
  stackable?: boolean;
  active?: boolean;
  revenue?: number;
  notes?: string | null;
}
