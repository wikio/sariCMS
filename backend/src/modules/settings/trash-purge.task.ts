import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class TrashPurgeTask {
  private readonly logger = new Logger(TrashPurgeTask.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  @Cron(process.env.TRASH_PURGE_CRON || '0 3 * * *')
  async handleCron(): Promise<void> {
    await this.purgeAll();
  }

  async purgeAll(): Promise<Record<string, number>> {
    const hours = Number(this.config.get('TRASH_RETENTION_HOURS') ?? 720);
    const olderThan = new Date(Date.now() - hours * 3600_000);
    const result: Record<string, number> = {};
    for (const collection of Object.values(COLLECTIONS)) {
      if (collection === COLLECTIONS.auditLogs || collection === COLLECTIONS.refreshTokens) {
        continue;
      }
      try {
        const repo = this.factory<BaseEntity>(collection);
        result[collection] = await repo.purgeExpired(olderThan);
      } catch (err) {
        this.logger.warn(`purge ${collection}: ${(err as Error).message}`);
        result[collection] = 0;
      }
    }
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    if (total > 0) {
      await this.audit.record({
        action: 'trash_auto_purge',
        resource: 'settings',
        payload: result as unknown as Record<string, unknown>,
      });
    }
    this.logger.log(`Auto-purge done (${total} rows) older than ${hours}h`);
    return result;
  }
}
