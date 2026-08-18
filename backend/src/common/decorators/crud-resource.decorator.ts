import { SetMetadata } from '@nestjs/common';

export const CRUD_RESOURCE_KEY = 'crudResource';
export const CrudResource = (resource: string) => SetMetadata(CRUD_RESOURCE_KEY, resource);
