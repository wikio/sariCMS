import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { isValidCron } from '../../common/schedule/cron-expression';

/** Clé de la ligne `settings` qui porte ces réglages. */
export const MAINTENANCE_KEY = 'maintenance';

export interface MaintenanceSettings {
  /** Jours de conservation de la piste d'audit. */
  auditRetentionDays: number;
  /** Planification de la purge des journaux et jetons. */
  logRetentionCron: string;
  /** Heures de conservation de la corbeille. */
  trashRetentionHours: number;
  /** Planification de la purge de la corbeille. */
  trashPurgeCron: string;
}

/** Provenance de chaque valeur — l'écran doit dire ce qui est surchargé. */
export type MaintenanceSource = 'db' | 'env' | 'default';

export interface MaintenanceStatus extends MaintenanceSettings {
  /** Provenance globale : `db` dès qu'un enregistrement existe. */
  source: MaintenanceSource;
  /** Valeurs des variables d'environnement, pour comparaison à l'écran. */
  env: MaintenanceSettings;
  /** Nombre de lignes supprimées au dernier passage connu, si l'info existe. */
  lastRun?: { at: string; removed: Record<string, number> } | null;
}

interface SettingRow extends BaseEntity {
  key?: string;
  value?: unknown;
  group?: string;
}

export const DEFAULTS: MaintenanceSettings = {
  auditRetentionDays: 30,
  logRetentionCron: '15 3 * * *',
  trashRetentionHours: 720,
  trashPurgeCron: '0 3 * * *',
};

const LIMITS = {
  auditRetentionDays: { min: 1, max: 3_650 },
  trashRetentionHours: { min: 1, max: 8_760 },
} as const;

/** Lit un entier borné, ou null si la valeur n'est pas exploitable. */
function intInRange(raw: unknown, min: number, max: number): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.floor(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

/**
 * Réglages de maintenance : rétention des journaux et planification des purges.
 *
 * Ordre de lecture : ligne `settings` en base, puis variables d'environnement,
 * puis défauts. L'écran d'administration peut donc reprendre la main sans qu'on
 * redéploie, tout en laissant `.env` servir de socle.
 *
 * La sauvegarde valide avant d'écrire : une expression cron invalide ne se
 * plaint qu'au redémarrage du planificateur, quand plus personne ne regarde.
 */
@Injectable()
export class MaintenanceSettingsService {
  private readonly logger = new Logger(MaintenanceSettingsService.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly config: ConfigService,
  ) {}

  private repo() {
    return this.factory<SettingRow>(COLLECTIONS.settings);
  }

  /** Valeurs portées par les variables d'environnement, défauts compris. */
  fromEnv(): MaintenanceSettings {
    return {
      auditRetentionDays:
        intInRange(this.config.get('AUDIT_RETENTION_DAYS'), LIMITS.auditRetentionDays.min, LIMITS.auditRetentionDays.max) ??
        DEFAULTS.auditRetentionDays,
      logRetentionCron: this.cronFromEnv('LOG_RETENTION_CRON', DEFAULTS.logRetentionCron),
      trashRetentionHours:
        intInRange(this.config.get('TRASH_RETENTION_HOURS'), LIMITS.trashRetentionHours.min, LIMITS.trashRetentionHours.max) ??
        DEFAULTS.trashRetentionHours,
      trashPurgeCron: this.cronFromEnv('TRASH_PURGE_CRON', DEFAULTS.trashPurgeCron),
    };
  }

  private cronFromEnv(name: string, fallback: string): string {
    const raw = this.config.get<string>(name);
    return raw && isValidCron(raw) ? raw.trim() : fallback;
  }

  /** Ligne enregistrée en base, ou null si l'écran n'a jamais sauvegardé. */
  private async stored(): Promise<Partial<MaintenanceSettings> | null> {
    try {
      const row = await this.repo().findOne({ key: MAINTENANCE_KEY }, true);
      const value = row?.value;
      if (!value || typeof value !== 'object') return null;
      return value as Partial<MaintenanceSettings>;
    } catch (err) {
      // Table absente (base non migrée) : on retombe sur l'environnement.
      this.logger.warn(`lecture des réglages de maintenance: ${(err as Error).message}`);
      return null;
    }
  }

  /** Valeurs effectives : base, puis environnement, puis défauts. */
  async current(): Promise<MaintenanceSettings> {
    const env = this.fromEnv();
    const stored = await this.stored();
    if (!stored) return env;
    return {
      auditRetentionDays:
        intInRange(stored.auditRetentionDays, LIMITS.auditRetentionDays.min, LIMITS.auditRetentionDays.max) ??
        env.auditRetentionDays,
      logRetentionCron:
        typeof stored.logRetentionCron === 'string' && isValidCron(stored.logRetentionCron)
          ? stored.logRetentionCron.trim()
          : env.logRetentionCron,
      trashRetentionHours:
        intInRange(stored.trashRetentionHours, LIMITS.trashRetentionHours.min, LIMITS.trashRetentionHours.max) ??
        env.trashRetentionHours,
      trashPurgeCron:
        typeof stored.trashPurgeCron === 'string' && isValidCron(stored.trashPurgeCron)
          ? stored.trashPurgeCron.trim()
          : env.trashPurgeCron,
    };
  }

  async status(): Promise<MaintenanceStatus> {
    const [current, stored] = await Promise.all([this.current(), this.stored()]);
    return {
      ...current,
      source: stored ? 'db' : this.config.get('AUDIT_RETENTION_DAYS') || this.config.get('LOG_RETENTION_CRON') ? 'env' : 'default',
      env: this.fromEnv(),
      lastRun: null,
    };
  }

  /**
   * Valide un jeu de réglages. Lève `BadRequestException` au premier champ
   * invalide, avec le nom du champ — l'écran l'affiche tel quel.
   */
  validate(input: Partial<MaintenanceSettings>): MaintenanceSettings {
    const base = { ...input };
    const days = intInRange(base.auditRetentionDays, LIMITS.auditRetentionDays.min, LIMITS.auditRetentionDays.max);
    if (days === null) {
      throw new BadRequestException(
        `auditRetentionDays doit être un entier entre ${LIMITS.auditRetentionDays.min} et ${LIMITS.auditRetentionDays.max}`,
      );
    }
    const hours = intInRange(base.trashRetentionHours, LIMITS.trashRetentionHours.min, LIMITS.trashRetentionHours.max);
    if (hours === null) {
      throw new BadRequestException(
        `trashRetentionHours doit être un entier entre ${LIMITS.trashRetentionHours.min} et ${LIMITS.trashRetentionHours.max}`,
      );
    }
    const logCron = String(base.logRetentionCron ?? '').trim();
    if (!isValidCron(logCron)) {
      throw new BadRequestException('logRetentionCron n’est pas une expression cron à cinq champs valide');
    }
    const trashCron = String(base.trashPurgeCron ?? '').trim();
    if (!isValidCron(trashCron)) {
      throw new BadRequestException('trashPurgeCron n’est pas une expression cron à cinq champs valide');
    }
    return {
      auditRetentionDays: days,
      logRetentionCron: logCron,
      trashRetentionHours: hours,
      trashPurgeCron: trashCron,
    };
  }

  /** Enregistre les réglages, puis renvoie l'état complet. */
  async save(input: Partial<MaintenanceSettings>): Promise<MaintenanceStatus> {
    const validated = this.validate(input);
    const existing = await this.repo().findOne({ key: MAINTENANCE_KEY }, true);
    if (existing?.id) {
      await this.repo().update(existing.id, { value: validated } as Partial<SettingRow>);
    } else {
      await this.repo().create({
        key: MAINTENANCE_KEY,
        value: validated,
        group: 'maintenance',
      } as Partial<SettingRow>);
    }
    return this.status();
  }

  /** Supprime la ligne : on revient aux variables d'environnement. */
  async reset(): Promise<MaintenanceStatus> {
    const existing = await this.repo().findOne({ key: MAINTENANCE_KEY }, true);
    if (existing?.id) await this.repo().hardDelete(existing.id);
    return this.status();
  }
}
