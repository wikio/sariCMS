import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface NewsEntity extends BaseEntity {
  locale: string;
  slug: string;
  title: string;
  category?: string | null;
  classification?: string | null;
  sujet?: string | null;
  authorName?: string | null;
  authorId?: string | null;
  date?: Date | string | null;
  readTime?: string | null;
  shortDesc?: string | null;
  fullContent?: string | null;
  image?: string | null;
  tags?: string[] | unknown;
  status: string;
  publishedAt?: Date | string | null;
}
