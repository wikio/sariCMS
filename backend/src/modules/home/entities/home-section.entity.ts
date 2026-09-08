import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

/**
 * Configuration d'un bloc de la page d'accueil, pour une langue donnée.
 *
 * Une ligne = un bloc + une langue (`key` + `locale`). Le bloc lui-même reste
 * une fiche du module correspondant (slide hero, produit, témoignage…) : ici
 * on n'enregistre que *la façon dont il est présenté sur la vitrine* —
 * textes vus par le visiteur, sélection de fiches, réglages de style, blocs
 * répétables et, le cas échéant, le HTML produit par le constructeur de page.
 *
 * Pourquoi un enregistrement par langue plutôt qu'une ligne unique avec un
 * objet `{"fr": …, "en": …}` : les traductions du site sont stockées de la
 * même façon partout ailleurs (une fiche par langue), et cela permet
 * d'ajouter/modifier une langue sans réécrire les autres.
 */
export interface HomeSectionEntity extends BaseEntity {
  /** Identifiant du bloc : hero, mission, products, blocks, stats… */
  key: string;
  locale: string;
  /** Libellé interne (optionnel), affiché dans le studio. */
  label?: string | null;
  /** Affiché sur la page ? */
  enabled: boolean;
  /** Ordre du bloc sur la page. */
  sortOrder: number;
  /**
   * Textes vus par le visiteur : titre, sous-titre, description, libellés de
   * bouton… Un champ absent laisse la traduction du site (`messages/*.json`)
   * s'appliquer.
   */
  texts: Record<string, unknown>;
  /** Sélection des fiches à afficher (mode auto/manuel, ids, ordre, limite). */
  selection: Record<string, unknown>;
  /** Réglages du bloc : nombre de colonnes, animation, style, couleurs… */
  settings: Record<string, unknown>;
  /**
   * Apparence du bloc (fond, hauteur, alignement, grille, CSS libre).
   * Séparé de `settings` parce qu'il est commun aux trois langues et que le
   * studio l'expose dans un onglet propre.
   */
  style: Record<string, unknown>;
  /** Blocs répétables (chiffres clés, blocs alternés, arguments newsletter…). */
  items: Array<Record<string, unknown>>;
  /** Constructeur de page : mode natif ou HTML/CSS produit par GrapesJS. */
  builder: Record<string, unknown>;
  /** `published` = la vitrine tient compte du bloc ; `draft` = ignoré. */
  status: string;
}
