import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface ContactInfoEntity extends BaseEntity {
  locale: string;
  company?: string | null;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  currency?: string | null;
  logo?: string | null;
  social?: Record<string, string> | unknown;
  extras?: Record<string, unknown> | unknown;
}

export interface ContactMessageEntity extends BaseEntity {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  status: string;
  meta?: Record<string, unknown> | unknown;
}
