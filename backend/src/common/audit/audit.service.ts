import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AUDIT_LOG_REPOSITORY } from '../constants/tokens';
import { BaseEntity, ICrudRepository } from '../crud/interfaces/repository.interface';

export interface AuditEntry {
  actorId?: number | null;
  action: string;
  resource: string;
  resourceId?: number | null;
  payload?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogEntity extends BaseEntity {
  actorId?: number | null;
  action: string;
  resource: string;
  resourceId?: number | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Optional()
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repo?: ICrudRepository<AuditLogEntity>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      if (!this.repo) {
        this.logger.debug(`${entry.action} ${entry.resource}/${entry.resourceId ?? '-'}`);
        return;
      }
      const now = new Date();
      await this.repo.create({
        actorId: entry.actorId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        payload: entry.payload ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } as Partial<AuditLogEntity>);
    } catch (err) {
      this.logger.warn(`Failed to persist audit log: ${(err as Error).message}`);
    }
  }
}
