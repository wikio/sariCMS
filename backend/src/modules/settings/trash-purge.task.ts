import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { AuditService } from '../../common/audit/audit.service';
import { DEFAULTS, MaintenanceSettingsService } from './maintenance-settings.service';

/**
 * Nom du job dans le `SchedulerRegistry` — explicite pour la même raison que
 * `LOG_RETENTION_JOB` : le registre est indexé par nom et les deux tâches
 * portent une méthode `handleCron`.
 */
export const TRASH_PURGE_JOB = 'trash-purge';

@Injectable()
export class TrashPurgeTask implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrashPurgeTask.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly maintenance: MaintenanceSettingsService,
    private readonly scheduler: SchedulerRegistry,
    private readonly audit: AuditService,
  ) {}

  /** Corps de la tâche appelée par le job planifié. */
  async handleCron(): Promise<void> {
    await this.purgeAll();
  }

  /*
   * Enregistrement manuel, pas de décorateur `@Cron` — voir le commentaire
   * identique dans `LogRetentionTask` : l'orchestrateur monte les méthodes
   * décorées au bootstrap et lèverait sur un nom déjà enregistré.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.applySchedule();
    } catch (err) {
      this.logger.warn(`purge de corbeille non planifiée: ${(err as Error).message}`);
    }
  }

  /** (Ré)enregistre le job sur l'expression configurée et le démarre. */
  async applySchedule(): Promise<string> {
    const expression = (await this.maintenance.current()).trashPurgeCron;
    if (this.scheduler.getCronJobs().has(TRASH_PURGE_JOB)) {
      this.scheduler.deleteCronJob(TRASH_PURGE_JOB);
    }
    const job = new CronJob(expression, () => void this.handleCron());
    this.scheduler.addCronJob(TRASH_PURGE_JOB, job);
    job.start();
    this.logger.log(`Purge de la corbeille planifiée sur « ${expression} »`);
    return expression;
  }

  async purgeAll(): Promise<Record<string, number>> {
    const hours = (await this.maintenance.current()).trashRetentionHours;
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
