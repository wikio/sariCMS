import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface TestimonialEntity extends BaseEntity {
  locale: string;
  name: string;
  role?: string | null;
  clinic?: string | null;
  text: string;
  image?: string | null;
  rating: number;
  sortOrder?: number;
  status: string;
}
