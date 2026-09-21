import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';

/** Conservation de la piste d'audit quand `AUDIT_RETENTION_DAYS` n'est pas posé. */
export const DEFAULT_AUDIT_RETENTION_DAYS = 30;

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
 * Réglages : `AUDIT_RETENTION_DAYS` (défaut 30) et `LOG_RETENTION_CRON`
 * (défaut 15 3 * * *, décalé de la purge de corbeille à 03:00).
 */
@Injectable()
export class LogRetentionTask {
  private readonly logger = new Logger(LogRetentionTask.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly config: ConfigService,
  ) {}

  @Cron(process.env.LOG_RETENTION_CRON || '15 3 * * *')
  async handleCron(): Promise<void> {
    await this.purgeAll();
  }

  /** Fenêtre de conservation appliquée à la piste d'audit, en jours. */
  retentionDays(): number {
    const raw = Number(this.config.get('AUDIT_RETENTION_DAYS') ?? DEFAULT_AUDIT_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_AUDIT_RETENTION_DAYS;
  }

  async purgeAll(): Promise<Record<string, number>> {
    const days = this.retentionDays();
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
