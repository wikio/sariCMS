import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

/**
 * Ligne de la table `payment_records`.
 *
 * Vient de `sari_payment_records`, le `localStorage` du poste d'administration :
 * les montants y arrivaient en chaîne ou en nombre selon l'écran, les dates en
 * chaîne ISO, et `cardMasked` y était stocké alors qu'il se déduit. La conversion
 * est faite à l'entrée (`toEntity`) et à la sortie (`toView`) dans le service,
 * pour que le contrat HTTP reste celui que l'interface connaissait déjà — les
 * écrans n'ont pas à apprendre une nouvelle forme en même temps qu'une base.
 */
export interface PaymentRecordEntity extends BaseEntity {
  /** Identifiant du navigateur, conservé pour que l'envoi soit idempotent. */
  externalId: string;
  orderId?: number | null;
  orderCode?: string | null;
  client: string;
  email?: string | null;
  method: string;
  methodName?: string | null;
  amount: number;
  /** `validated` | `pending` | `rejected` — la seule énumération contrôlée ici. */
  status: string;
  cardLast4?: string | null;
  note?: string | null;
  date: Date | string;
  validatedAt?: Date | string | null;
}
