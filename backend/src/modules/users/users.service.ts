import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { USER_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { UserEntity } from './entities/user.entity';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService extends BaseCrudService<UserEntity> {
  protected readonly repository: ICrudRepository<UserEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'users',
    searchFields: ['email', 'firstName', 'lastName', 'company', 'phone'],
    sortableFields: ['createdAt', 'updatedAt', 'email', 'lastName', 'type', 'status'],
    uniqueFields: ['email'],
    listFields: ['id', 'email', 'firstName', 'lastName', 'type', 'status', 'company', 'createdAt'],
    cardFields: [
      'id',
      'email',
      'firstName',
      'lastName',
      'type',
      'status',
      'company',
      'phone',
      'avatar',
      'position',
      'createdAt',
    ],
  };

  constructor(
    @Inject(USER_REPOSITORY) repository: ICrudRepository<UserEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  protected override beforeSave(
    dto: Partial<UserEntity> & { password?: string },
    op: 'create' | 'update',
  ): Partial<UserEntity> {
    const { password, ...rest } = dto;
    const out: Partial<UserEntity> = { ...rest };
    if (out.email) out.email = String(out.email).toLowerCase().trim();
    if (password) {
      out.passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    } else if (op === 'create' && !out.passwordHash) {
      out.passwordHash = bcrypt.hashSync(randomBytes(18).toString('base64url'), BCRYPT_ROUNDS);
    }
    delete (out as { password?: string }).password;
    return out;
  }

  async setStatus(id: string, status: string, actor?: ActorContext) {
    return this.update(id, { status } as Partial<UserEntity>, actor);
  }

  async generateTempPassword(id: string, actor?: ActorContext) {
    await this.requireById(id);
    const password = `Tmp${randomBytes(5).toString('base64url')}!1A`;
    await this.update(id, { password } as unknown as Partial<UserEntity>, actor);
    await this.audit.record({
      actorId: actor?.id,
      action: 'temp_password',
      resource: 'users',
      resourceId: id,
    });
    return { password };
  }

  async generatePartnerCredentials(id: string, actor?: ActorContext) {
    const user = await this.requireById(id);
    const partnerCode = `PART-${randomBytes(3).toString('hex').toUpperCase()}`;
    const partnerKey = `sk_live_${randomBytes(16).toString('hex')}`;
    const updated = await this.update(
      user.id,
      { partnerCode, partnerKey } as Partial<UserEntity>,
      actor,
    );
    return { ...(updated as object), partnerKey };
  }
}
