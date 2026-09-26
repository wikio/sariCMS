/**
 * lib/maintenance-settings.ts — accès client aux réglages de maintenance.
 *
 * Miroir de `backend/src/modules/settings/maintenance-settings.service.ts`.
 * Les valeurs effectives viennent de la base, puis des variables
 * d'environnement, puis des défauts ; `source` dit d'où vient ce qui est affiché.
 */
import { cmsAdminFetch } from '@/lib/cms-admin';

export interface MaintenanceSettings {
  /** Jours de conservation de la piste d'audit. */
  auditRetentionDays: number;
  /** Planification de la purge des journaux et des jetons (crontab 5 champs). */
  logRetentionCron: string;
  /** Heures de conservation de la corbeille. */
  trashRetentionHours: number;
  /** Planification de la purge de la corbeille. */
  trashPurgeCron: string;
}

export type MaintenanceSource = 'db' | 'env' | 'default';

export interface MaintenanceStatus extends MaintenanceSettings {
  source: MaintenanceSource;
  /** Valeurs des variables d'environnement, pour montrer ce qui est surchargé. */
  env: MaintenanceSettings;
  lastRun?: { at: string; removed: Record<string, number> } | null;
}

/** Compte de lignes supprimées par table, rendu par un déclenchement manuel. */
export type PurgeResult = Record<string, number>;

export async function loadMaintenance(): Promise<MaintenanceStatus> {
  return cmsAdminFetch<MaintenanceStatus>('/settings/maintenance', { timeoutMs: 8000 });
}

/** Enregistre, puis le backend replanifie les deux tâches. */
export async function saveMaintenance(form: MaintenanceSettings): Promise<MaintenanceStatus> {
  return cmsAdminFetch<MaintenanceStatus>('/settings/maintenance', {
    method: 'PUT',
    json: form,
    timeoutMs: 15000,
  });
}

/** Supprime la ligne enregistrée : on revient aux variables d'environnement. */
export async function resetMaintenance(): Promise<MaintenanceStatus> {
  return cmsAdminFetch<MaintenanceStatus>('/settings/maintenance', {
    method: 'DELETE',
    timeoutMs: 15000,
  });
}

/** Déclenche la purge des journaux et des jetons sans attendre le cron. */
export async function runLogRetention(): Promise<PurgeResult> {
  return cmsAdminFetch<PurgeResult>('/settings/logs/apply-retention', {
    method: 'POST',
    timeoutMs: 30000,
  });
}

/** Déclenche la purge de la corbeille sans attendre le cron. */
export async function runTrashPurge(): Promise<PurgeResult> {
  return cmsAdminFetch<PurgeResult>('/settings/trash/purge-expired', {
    method: 'POST',
    timeoutMs: 30000,
  });
}

/**
 * Validation côté écran, sur les mêmes règles que le serveur — pour refuser
 * avant l'aller-retour, pas pour s'y substituer.
 */
export function validateMaintenance(form: MaintenanceSettings): string | null {
  const days = Number(form.auditRetentionDays);
  if (!Number.isFinite(days) || Math.floor(days) < 1 || Math.floor(days) > 3650) {
    return 'La conservation de l’audit doit être un entier entre 1 et 3650 jours.';
  }
  const hours = Number(form.trashRetentionHours);
  if (!Number.isFinite(hours) || Math.floor(hours) < 1 || Math.floor(hours) > 8760) {
    return 'La conservation de la corbeille doit être un entier entre 1 et 8760 heures.';
  }
  if (!isCronShape(form.logRetentionCron)) {
    return 'La planification des journaux doit comporter cinq champs (minute heure jour mois jour-de-semaine).';
  }
  if (!isCronShape(form.trashPurgeCron)) {
    return 'La planification de la corbeille doit comporter cinq champs (minute heure jour mois jour-de-semaine).';
  }
  return null;
}

/** Contrôle de forme only : le serveur valide les bornes champ par champ. */
export function isCronShape(expression: string): boolean {
  if (typeof expression !== 'string') return false;
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => f.length > 0);
}
