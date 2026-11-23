import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { CONTACT_MESSAGE_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ContactMessageEntity } from './entities/contact.entity';
import { UpdateContactMessageDto } from './dto/contact.dto';

@Injectable()
export class ContactMessagesService extends BaseCrudService<ContactMessageEntity> {
  protected readonly repository: ICrudRepository<ContactMessageEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'contact',
    // Un message reçu, dans la langue où il a été écrit : pas de `legacyId`.
    hasLegacyId: false,

    searchFields: ['name', 'email', 'subject', 'message'],
    sortableFields: ['createdAt', 'status', 'name'],
    listFields: ['id', 'name', 'email', 'subject', 'status', 'createdAt'],
    cardFields: ['id', 'name', 'email', 'phone', 'subject', 'message', 'status', 'createdAt'],
  };

  constructor(
    @Inject(CONTACT_MESSAGE_REPOSITORY) repository: ICrudRepository<ContactMessageEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  /** Une révision ou un suivi n'émet pas de courrier et ne sanctionne pas le compte. */
  async followUp(id: number, dto: UpdateContactMessageDto, actor: ActorContext) {
    const patch: Partial<ContactMessageEntity> = {};
    if (dto.subject) patch.subject = dto.subject;
    if (dto.status) patch.status = dto.status;
    if (typeof dto.followUp === 'string') {
      const existing = await this.requireById(id);
      patch.meta = { ...existing.meta, followUp: dto.followUp.trim() };
    }
    return this.update(id, patch, actor);
  }

  /** Les données privées restent dans la fiche, jamais une deuxième copie dans l'audit. */
  protected override safeAuditPayload(): undefined {
    return undefined;
  }
}
