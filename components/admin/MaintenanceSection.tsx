'use client';

import { useTranslations } from 'next-intl';

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

  type MaintenanceStatus,
} from '@/lib/maintenance-settings';

/** Raccourcis de planification — évitent de saisir une crontab à la main. */
const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'nightly', value: '15 3 * * *' },
  { label: 'midnight', value: '0 0 * * *' },
  { label: 'sixHours', value: '0 */6 * * *' },
  { label: 'sunday', value: '0 4 * * 0' },
];

function formFromStatus(status: MaintenanceStatus): MaintenanceSettings {
  return {
    auditRetentionDays: status.auditRetentionDays,
    logRetentionCron: status.logRetentionCron,
    trashRetentionHours: status.trashRetentionHours,
    trashPurgeCron: status.trashPurgeCron,
  };
}

export default function MaintenanceSection() {
  const t = useTranslations('admin.maintenance');
  const ts = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
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
      setLoadError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      showToast(t(problem), 'error');
      return;
    }
    setBusy('save');
    try {
      const s = await saveMaintenance(form);
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      showToast(t('saved'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : tc('saveError'), 'error');
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
      showToast(t('reset'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('resetError'), 'error');
    } finally {
      setBusy('');
    }
  };

  const run = async (kind: 'logs' | 'trash') => {
    setBusy(kind);
    try {
      const result = kind === 'logs' ? await runLogRetention() : await runTrashPurge();
      const total = Object.values(result).reduce((sum, count) => sum + count, 0);
      const details = Object.entries(result).filter(([, n]) => n > 0).map(([key, n]) => `${key}: ${n}`).join(', ');
      const text = total ? t('purgeResult', { total, details }) : t('nothingToDelete');
      setLastResult(text);
      showToast(text, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('purgeError'), 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <section className="ad-card p-5">
        <PixelGridLoader compact label={ts('maintenance')} />
      </section>
    );
  }

  if (loadError || !form || !status) {
    return (
      <section className="ad-card p-5 space-y-3">
        <h2 className="ad-section-title">{ts('maintenance')}</h2>
        <p className="text-sm" style={{ color: 'var(--ad-danger, #e5484d)' }}>
          {loadError || t('unavailable')}
        </p>
        <button className="ad-btn ad-btn-ghost" onClick={() => void refresh()}>
          <RotateCcw className="w-4 h-4" /> {t('retry')}
        </button>
      </section>
    );
  }

  const cronInvalid = (value: string) => !isCronShape(value);

  return (
    <section className="ad-card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="ad-section-title">{ts('maintenance')}</h2>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            {t('intro')}
          </p>
        </div>
        <span
          className="ad-chip"
          title={t('source')}
        >
          <DatabaseZap className="w-3 h-3" /> {t(`source_${status.source}`)}
        </span>
      </div>

      {/* ---------------------------------------------------------------- Audit */}
      <div className="space-y-2">
        <h3 className="text-sm font-black flex items-center gap-2">
          <History className="w-4 h-4" /> {t('audit')}
        </h3>
        <label className="block space-y-1.5">
          <span className="field-label">{t('days')}</span>
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
            {t('auditHint', { days: status.env.auditRetentionDays })}
          </span>
        </label>
      </div>

      {/* ------------------------------------------------------- Planifications */}
      <div className="space-y-2">
        <h3 className="text-sm font-black">{t('schedule')}</h3>
        <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
          {t('cronHelp')}
        </p>

        {(['logRetentionCron', 'trashPurgeCron'] as const).map((key) => (
          <label key={key} className="block space-y-1.5">
            <span className="field-label">
              {key === 'logRetentionCron' ? t('logsJob') : t('trashJob')}
            </span>
            <input
              className="ad-input font-mono"
              style={{ maxWidth: '18rem' }}
              value={form[key]}
              onChange={(e) => patch({ [key]: e.target.value } as Partial<MaintenanceSettings>)}
            />
            {cronInvalid(form[key]) && (
              <span className="text-xs block" style={{ color: 'var(--ad-danger, #e5484d)' }}>
                {t('cronInvalid')}
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
                  {t(preset.label)}
                </button>
              ))}
            </span>
          </label>
        ))}
      </div>

      {/* ------------------------------------------------------------ Corbeille */}
      <div className="space-y-2">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> {tc('trash')}
        </h3>
        <label className="block space-y-1.5">
          <span className="field-label">{t('hours')}</span>
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
            {t('trashHint', { hours: status.env.trashRetentionHours })}
          </span>
        </label>
      </div>

      {lastResult && (
        <p className="text-xs ad-chip w-full justify-start py-2 px-3">{lastResult}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="ad-btn ad-btn-primary" onClick={() => void save()} disabled={busy !== '' || !dirty}>
          <Save className="w-4 h-4" /> {tc('save')}
        </button>
        <button className="ad-btn ad-btn-ghost" onClick={() => void run('logs')} disabled={busy !== ''}>
          <Play className="w-4 h-4" /> {t('purgeLogs')}
        </button>
        <button className="ad-btn ad-btn-ghost" onClick={() => void run('trash')} disabled={busy !== ''}>
          <Trash2 className="w-4 h-4" /> {t('purgeTrash')}
        </button>
        <button
          className="ad-btn ad-btn-ghost"
          onClick={() => void reset()}
          disabled={busy !== '' || status.source !== 'db'}
          title={status.source === 'db' ? '' : t('noSettings')}
        >
          <RotateCcw className="w-4 h-4" /> {t('restoreEnv')}
        </button>
      </div>
    </section>
  );
}
