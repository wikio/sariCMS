import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface MenuItem {
  id?: string;
  label: string;
  href: string;
  desc?: string;
  icon?: string;
  children?: MenuItem[];
}

export interface MenuEntity extends BaseEntity {
  locale: string;
  name: string;
  location: string;
  items: MenuItem[] | unknown;
  status: string;
}
