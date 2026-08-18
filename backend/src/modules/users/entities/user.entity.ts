import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export type UserType = 'admin' | 'client' | 'partner' | 'candidate';
export type UserStatus = 'active' | 'blocked' | 'pending';

export interface UserEntity extends BaseEntity {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  company?: string | null;
  avatar?: string | null;
  type: UserType | string;
  status: UserStatus | string;
  locale?: string;
  roleId?: string | null;
  totpEnabled?: boolean;
  totpSecret?: string | null;
  partnerCode?: string | null;
  partnerKey?: string | null;
  address?: string | null;
  wilaya?: string | null;
  country?: string | null;
  position?: string | null;
  experience?: string | null;
  motivation?: string | null;
  cvUrl?: string | null;
  lastLoginAt?: Date | string | null;
}
