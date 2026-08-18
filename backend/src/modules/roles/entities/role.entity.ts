import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface RoleEntity extends BaseEntity {
  name: string;
  slug: string;
  description?: string | null;
  isSystem?: boolean;
  permissionIds?: string[];
}

export interface PermissionEntity extends BaseEntity {
  resource: string;
  action: string;
  description?: string | null;
}

export interface RolePermissionEntity extends BaseEntity {
  roleId: string;
  permissionId: string;
}
