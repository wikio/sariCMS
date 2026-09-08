import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface AuthorEntity extends BaseEntity {
  locale: string;
  slug?: string | null;
  name: string;
  email?: string | null;
  /** Qualification affichée sous le nom de l'auteur sur la fiche article. */
  role?: string | null;
  /** Présentation courte, affichée dans le bloc « À propos de l'auteur ». */
  bio?: string | null;
  photo?: string | null;
  /** Auteur retenu lorsqu'un article n'en désigne aucun. Un seul à la fois. */
  isFallback?: boolean;
  sortOrder?: number;
  status: string;
  legacyId?: string | null;
  parentId?: number | null;
  isDefault?: boolean;
  publishedAt?: Date | string | null;
}
