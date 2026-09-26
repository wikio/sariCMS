'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatabaseZap, History, Play, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import {
  isCronShape,
  loadMaintenance,
  resetMaintenance,
  runLogRetention,
  runTrashPurge,
  saveMaintenance,
  validateMaintenance,
  type MaintenanceSettings,
  type MaintenanceSource,
  type MaintenanceStatus,
} from '@/lib/maintenance-settings';

/** Raccourcis de planification — évitent de saisir une crontab à la main. */
const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Chaque nuit à 03:15', value: '15 3 * * *' },
  { label: 'Chaque nuit à minuit', value: '0 0 * * *' },
  { label: 'Toutes les 6 heures', value: '0 */6 * * *' },
  { label: 'Chaque dimanche à 04:00', value: '0 4 * * 0' },
];

const SOURCE_LABEL: Record<MaintenanceSource, string> = {
  db: 'Enregistré en base',
  env: 'Variables d’environnement',
  default: 'Valeurs par défaut',
};

function formFromStatus(status: MaintenanceStatus): MaintenanceSettings {
  return {
    auditRetentionDays: status.auditRetentionDays,
    logRetentionCron: status.logRetentionCron,
    trashRetentionHours: status.trashRetentionHours,
    trashPurgeCron: status.trashPurgeCron,
  };
}

/** Total des lignes supprimées, pour le retour affiché après un lancement. */
function summarize(result: Record<string, number>): string {
  const entries = Object.entries(result).filter(([, n]) => n > 0);
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (!total) return 'Aucune ligne à supprimer.';
  return `${total} ligne(s) supprimée(s) — ${entries.map(([k, n]) => `${k}: ${n}`).join(', ')}`;
}

export default function MaintenanceSection() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [form, setForm] = useState<MaintenanceSettings | null>(null);
  const [baseline, setBaseline] = useState<MaintenanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | 'save' | 'reset' | 'logs' | 'trash'>('');
  const [loadError, setLoadError] = useState('');
  const [lastResult, setLastResult] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await loadMaintenance();
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Réglages illisibles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dirty = useMemo(
    () => !!form && !!baseline && JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const patch = (p: Partial<MaintenanceSettings>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    if (!form) return;
    const problem = validateMaintenance(form);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setBusy('save');
    try {
      const s = await saveMaintenance(form);
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      showToast('Réglages enregistrés, tâches replanifiées.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Enregistrement impossible', 'error');
    } finally {
      setBusy('');
    }
  };

  const reset = async () => {
    setBusy('reset');
    try {
      const s = await resetMaintenance();
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      showToast('Réglages d’usine : les variables d’environnement s’appliquent.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Réinitialisation impossible', 'error');
    } finally {
      setBusy('');
    }
  };

  const run = async (kind: 'logs' | 'trash') => {
    setBusy(kind);
    try {
      const result = kind === 'logs' ? await runLogRetention() : await runTrashPurge();
      const text = summarize(result);
      setLastResult(text);
      showToast(text, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Purge impossible', 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <section className="ad-card p-5">
        <PixelGridLoader compact label="Maintenance" />
      </section>
    );
  }

  if (loadError || !form || !status) {
    return (
      <section className="ad-card p-5 space-y-3">
        <h2 className="ad-section-title">Journaux &amp; maintenance</h2>
        <p className="text-sm" style={{ color: 'var(--ad-danger, #e5484d)' }}>
          {loadError || 'Réglages indisponibles.'}
        </p>
        <button className="ad-btn ad-btn-ghost" onClick={() => void refresh()}>
          <RotateCcw className="w-4 h-4" /> Réessayer
        </button>
      </section>
    );
  }

  const cronInvalid = (value: string) => !isCronShape(value);

  return (
    <section className="ad-card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="ad-section-title">Journaux &amp; maintenance</h2>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            La piste d'audit ne passe jamais par la corbeille : sans rétention, elle grossit à
            chaque écriture. Les jetons expirés sont nettoyés au même passage.
          </p>
        </div>
        <span
          className="ad-chip"
          title="Provenance des valeurs affichées"
        >
          <DatabaseZap className="w-3 h-3" /> {SOURCE_LABEL[status.source]}
        </span>
      </div>

      {/* ---------------------------------------------------------------- Audit */}
      <div className="space-y-2">
        <h3 className="text-sm font-black flex items-center gap-2">
          <History className="w-4 h-4" /> Piste d'audit
        </h3>
        <label className="block space-y-1.5">
          <span className="field-label">Conservation (jours)</span>
          <input
            className="ad-input"
            style={{ maxWidth: '12rem' }}
            type="number"
            min={1}
            max={3650}
            value={form.auditRetentionDays}
            onChange={(e) => patch({ auditRetentionDays: Number(e.target.value) })}
          />
          <span className="text-xs block" style={{ color: 'var(--ad-muted)' }}>
            Les lignes de `audit_logs` plus anciennes sont supprimées. Variables :{' '}
            {status.env.auditRetentionDays} j.
          </span>
        </label>
      </div>

      {/* ------------------------------------------------------- Planifications */}
      <div className="space-y-2">
        <h3 className="text-sm font-black">Planification</h3>
        <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
          Expression crontab à cinq champs : minute heure jour mois jour-de-semaine. Le changement
          prend effet immédiatement, sans redémarrer le backend.
        </p>

        {(['logRetentionCron', 'trashPurgeCron'] as const).map((key) => (
          <label key={key} className="block space-y-1.5">
            <span className="field-label">
              {key === 'logRetentionCron' ? 'Purge des journaux et jetons' : 'Purge de la corbeille'}
            </span>
            <input
              className="ad-input font-mono"
              style={{ maxWidth: '18rem' }}
              value={form[key]}
              onChange={(e) => patch({ [key]: e.target.value } as Partial<MaintenanceSettings>)}
            />
            {cronInvalid(form[key]) && (
              <span className="text-xs block" style={{ color: 'var(--ad-danger, #e5484d)' }}>
                Cinq champs séparés par des espaces sont attendus.
              </span>
            )}
            <span className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`ad-chip ${form[key] === preset.value ? 'ad-chip-acc' : ''}`}
                  onClick={() => patch({ [key]: preset.value } as Partial<MaintenanceSettings>)}
                >
                  {preset.label}
                </button>
              ))}
            </span>
          </label>
        ))}
      </div>

      {/* ------------------------------------------------------------ Corbeille */}
      <div className="space-y-2">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Corbeille
        </h3>
        <label className="block space-y-1.5">
          <span className="field-label">Conservation (heures)</span>
          <input
            className="ad-input"
            style={{ maxWidth: '12rem' }}
            type="number"
            min={1}
            max={8760}
            value={form.trashRetentionHours}
            onChange={(e) => patch({ trashRetentionHours: Number(e.target.value) })}
          />
          <span className="text-xs block" style={{ color: 'var(--ad-muted)' }}>
            Éléments supprimés définitivement au-delà. Variable : {status.env.trashRetentionHours} h.
          </span>
        </label>
      </div>

      {lastResult && (
        <p className="text-xs ad-chip w-full justify-start py-2 px-3">{lastResult}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="ad-btn ad-btn-primary" onClick={() => void save()} disabled={busy !== '' || !dirty}>
          <Save className="w-4 h-4" /> Enregistrer
        </button>
        <button className="ad-btn ad-btn-ghost" onClick={() => void run('logs')} disabled={busy !== ''}>
          <Play className="w-4 h-4" /> Lancer la purge des journaux
        </button>
        <button className="ad-btn ad-btn-ghost" onClick={() => void run('trash')} disabled={busy !== ''}>
          <Trash2 className="w-4 h-4" /> Vider la corbeille expirée
        </button>
        <button
          className="ad-btn ad-btn-ghost"
          onClick={() => void reset()}
          disabled={busy !== '' || status.source !== 'db'}
          title={status.source === 'db' ? '' : 'Aucun réglage enregistré en base'}
        >
          <RotateCcw className="w-4 h-4" /> Revenir aux variables
        </button>
      </div>
    </section>
  );
}
