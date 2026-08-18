import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export const PAGE_KINDS = ['legal', 'about', 'generic'] as const;
export const PAGE_SUBTYPES = ['simple', 'gallery', 'flyer', 'slide', 'scroll', 'full'] as const;
export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const;

export type PageKind = (typeof PAGE_KINDS)[number];
export type PageSubtype = (typeof PAGE_SUBTYPES)[number];

export interface PageSlide {
  title?: string;
  subtitle?: string;
  description?: string;
  media?: string;
  mediaType?: 'image' | 'video' | 'youtube';
  cta?: string;
  ctaLink?: string;
}

export interface PageEntity extends BaseEntity {
  slug: string;
  locale: string;
  kind: PageKind | string;
  subtype: PageSubtype | string;
  title: string;
  subtitle?: string | null;
  category?: string | null;
  content?: string | null;
  media?: unknown;
  slides?: PageSlide[] | unknown;
  sections?: PageSlide[] | unknown;
  features?: string[] | unknown;
  pdfUrl?: string | null;
  status: string;
  publishedAt?: Date | string | null;
  sortOrder?: number;
}
