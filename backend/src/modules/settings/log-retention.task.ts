import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { DEFAULTS, MaintenanceSettingsService } from './maintenance-settings.service';

/** Conservation de la piste d'audit quand rien n'est configuré. */
export const DEFAULT_AUDIT_RETENTION_DAYS = DEFAULTS.auditRetentionDays;

/**
 * Nom du job dans le `SchedulerRegistry`.
 *
 * Explicite, et non le nom de la méthode : deux tâches portent `handleCron`, et
 * le registre est une carte indexée par nom — elles s'y écraseraient.
 */
export const LOG_RETENTION_JOB = 'log-retention';

/**
 * Rétention des journaux et des jetons.
 *
 * `TrashPurgeTask` ne couvre pas ces tables, et pour cause : sa purge s'appuie
 * sur `deletedAt`, or la piste d'audit et les jetons ne passent jamais par la
 * corbeille. Sans cette tâche, `audit_logs`, `refresh_tokens` et
 * `password_reset_tokens` croissaient sans limite — une ligne d'audit par
 * création, modification ou suppression, sur 26 modules.
 *
 * Trois cibles, deux critères distincts :
 * - `audit_logs` : glissant, `createdAt` au-delà de la fenêtre de conservation ;
 * - `refresh_tokens` et `password_reset_tokens` : ce qui est déjà expiré, donc
 *   inutilisable par définition. Aucune fenêtre configurable, rien à décider.
 *
 * Réglages modifiables depuis l'écran d'administration (Paramètres > Journaux &
 * maintenance), avec repli sur `AUDIT_RETENTION_DAYS` / `LOG_RETENTION_CRON`
 * puis sur les défauts.
 */
@Injectable()
export class LogRetentionTask implements OnApplicationBootstrap {
  private readonly logger = new Logger(LogRetentionTask.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly maintenance: MaintenanceSettingsService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /** Corps de la tâche appelée par le job planifié. */
  async handleCron(): Promise<void> {
    await this.purgeAll();
  }

  /*
   * Enregistrement manuel, et non via le décorateur `@Cron`.
   *
   * `SchedulerOrchestrator` monte les méthodes décorées pendant
   * `onApplicationBootstrap` : si l'on réenregistrait le même nom avant lui
   * (`onModuleInit`), son propre `addCronJob` levait « Cron Job with the given
   * name already exists » et le processus mourait au démarrage. Sans décorateur,
   * rien n'est monté pour cette classe et l'enregistrement est le seul.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.applySchedule();
    } catch (err) {
      this.logger.warn(`rétention non planifiée: ${(err as Error).message}`);
    }
  }

  /**
   * (Ré)enregistre le job sur l'expression configurée et le démarre. Appelée au
   * démarrage puis après chaque sauvegarde depuis l'écran d'administration.
   * `deleteCronJob` arrête l'ancien job : pas de double exécution.
   */
  async applySchedule(): Promise<string> {
    const expression = (await this.maintenance.current()).logRetentionCron;
    if (this.scheduler.getCronJobs().has(LOG_RETENTION_JOB)) {
      this.scheduler.deleteCronJob(LOG_RETENTION_JOB);
    }
    const job = new CronJob(expression, () => void this.handleCron());
    this.scheduler.addCronJob(LOG_RETENTION_JOB, job);
    job.start();
    this.logger.log(`Rétention des journaux planifiée sur « ${expression} »`);
    return expression;
  }

  /** Fenêtre de conservation appliquée à la piste d'audit, en jours. */
  async retentionDays(): Promise<number> {
    return (await this.maintenance.current()).auditRetentionDays;
  }

  async purgeAll(): Promise<Record<string, number>> {
    const days = await this.retentionDays();
    const now = new Date();
    const auditCutoff = new Date(now.getTime() - days * 86_400_000);

    const targets: Array<{ label: string; collection: string; field: string; cutoff: Date }> = [
      { label: 'audit_logs', collection: COLLECTIONS.auditLogs, field: 'createdAt', cutoff: auditCutoff },
      { label: 'refresh_tokens', collection: COLLECTIONS.refreshTokens, field: 'expiresAt', cutoff: now },
      { label: 'password_reset_tokens', collection: COLLECTIONS.passwordResetTokens, field: 'expiresAt', cutoff: now },
    ];

    const result: Record<string, number> = {};
    for (const target of targets) {
      try {
        const repo = this.factory<BaseEntity>(target.collection);
        result[target.label] = await repo.deleteOlderThan(target.field, target.cutoff);
      } catch (err) {
        // Une cible absente (pilote JSON non amorcé, modèle non migré) ne doit
        // pas empêcher les autres d'être nettoyées.
        this.logger.warn(`rétention ${target.label}: ${(err as Error).message}`);
        result[target.label] = 0;
      }
    }

    const total = Object.values(result).reduce((a, b) => a + b, 0);
    this.logger.log(
      `Rétention appliquée (${total} lignes) — audit > ${days} j, jetons expirés`,
    );
    return result;
  }
}
