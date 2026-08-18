import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { TESTIMONIAL_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { TestimonialEntity } from './entities/testimonial.entity';

@Injectable()
export class TestimonialsService extends BaseCrudService<TestimonialEntity> {
  protected readonly repository: ICrudRepository<TestimonialEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'testimonials',
    searchFields: ['name', 'role', 'clinic', 'text'],
    sortableFields: ['createdAt', 'rating', 'sortOrder', 'name'],
    listFields: ['id', 'name', 'clinic', 'rating', 'status', 'locale'],
    cardFields: ['id', 'name', 'role', 'clinic', 'text', 'image', 'rating', 'status'],
  };

  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) repository: ICrudRepository<TestimonialEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }
}
