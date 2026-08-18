import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { CONTACT_INFO_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ContactInfoEntity } from './entities/contact.entity';

@Injectable()
export class ContactInfoService extends BaseCrudService<ContactInfoEntity> {
  protected readonly repository: ICrudRepository<ContactInfoEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'contact',
    searchFields: ['company', 'email', 'phone', 'address'],
    sortableFields: ['locale', 'updatedAt'],
    uniqueFields: ['locale'],
    listFields: ['id', 'locale', 'company', 'email', 'phone', 'updatedAt'],
    cardFields: ['id', 'locale', 'company', 'tagline', 'email', 'phone', 'address', 'logo'],
  };

  constructor(
    @Inject(CONTACT_INFO_REPOSITORY) repository: ICrudRepository<ContactInfoEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  async findByLocale(locale: string) {
    return this.repository.findOne({ locale });
  }
}
