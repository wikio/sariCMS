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
      const data: Partial<AuditLogEntity> & Record<string, unknown> = {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        payload: entry.payload ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } as Partial<AuditLogEntity> & Record<string, unknown>;
      // actorId null -> on omet complètement le champ : sur create Prisma n'accepte pas `actor: {disconnect:true}` (uniquement connect/create).
      // Laisser undefined = le délégué ne touche pas à la relation et la colonne reste NULL.
      if (entry.actorId !== undefined && entry.actorId !== null) {
        (data as Record<string, unknown>).actorId = entry.actorId;
      }
      await this.repo.create(data as Partial<AuditLogEntity>);
    } catch (err) {
      this.logger.warn(`Failed to persist audit log: ${(err as Error).message}`);
    }
  }
}
