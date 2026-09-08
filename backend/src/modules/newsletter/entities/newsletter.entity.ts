import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export const NEWSLETTER_STATUSES = ['pending', 'subscribed', 'unsubscribed', 'bounced', 'blocked'] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

/**
 * Motifs proposés au visiteur qui se désinscrit. Des codes courts, stables :
 * c'est eux qui sont enregistrés, l'écran d'administration traduit le libellé.
 * `other` s'accompagne alors du texte libre `unsubscribeNote`.
 */
export const NEWSLETTER_UNSUBSCRIBE_REASONS = [
  'no-longer-wants',
  'too-many-emails',
  'not-relevant',
  'never-subscribed',
  'other',
] as const;
export type NewsletterUnsubscribeReason = (typeof NEWSLETTER_UNSUBSCRIBE_REASONS)[number];

/**
 * Abonné·e à la newsletter.
 *
 * Une seule liste pour tout le site : le bloc newsletter de la page d'accueil,
 * le formulaire d'un article, la case à cocher de la page de contact… écrivent
 * tous ici, et `source` dit lequel. C'est ce qui permet de trier les adresses
 * par page d'origine sans multiplier les listes.
 *
 * L'adresse est unique (insensible à la casse) : une personne qui se réinscrit
 * après s'être désinscrite remet sa fiche à jour au lieu de créer un doublon.
 */
export interface NewsletterSubscriberEntity extends BaseEntity {
  email: string;
  name?: string | null;
  locale: string;
  status: NewsletterStatus | string;
  /** Bloc / page d'origine : home.newsletter, news.detail, contact, footer… */
  source?: string | null;
  /** Consentement RGPD explicite (cases à cocher). */
  consent?: boolean;
  /** Case à cocher « recevoir aussi les offres » ou préférences de contenu. */
  topics?: string[];
  notes?: string | null;
  /** Jeton de confirmation / désinscription, transmis par lien. */
  token?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  subscribedAt?: string | null;
  unsubscribedAt?: string | null;
  /** Motif du retrait, choisi par le visiteur (`NEWSLETTER_UNSUBSCRIBE_REASONS`). */
  unsubscribeReason?: string | null;
  /** Commentaire libre qui accompagne le motif. */
  unsubscribeNote?: string | null;
}
