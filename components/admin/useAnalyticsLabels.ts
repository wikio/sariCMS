'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { AnalyticsSnapshot } from '@/lib/analytics-types';

/** The analytics locale filter selects records, not the language of the UI.
 * Translate system categories by ID, leaving counts, URLs and authored titles untouched. */
export function useAnalyticsLabels(raw: AnalyticsSnapshot | null) {
  const t = useTranslations('admin');
  return useMemo(() => {
    if (!raw) return null;
    const labels = <T extends { key: string; label: string }>(rows: T[], prefix: string): T[] =>
      rows.map((row) => {
        const key = `${prefix}${row.key}`;
        return t.has(key) ? { ...row, label: t(key) } : row;
      });
    return {
      ...raw,
      applications: { ...raw.applications, byStatus: labels(raw.applications.byStatus, 'applications.step_') },
      eventRegistrations: { ...raw.eventRegistrations, byStatus: labels(raw.eventRegistrations.byStatus, 'eventRegistrations.status_') },
      jobs: { ...raw.jobs, byStatus: labels(raw.jobs.byStatus, 'analytics.job_') },
      newsletter: { ...raw.newsletter, byStatus: labels(raw.newsletter.byStatus, 'newsletter.status_') },
      ged: { ...raw.ged, byKind: labels(raw.ged.byKind, 'analytics.kind_') },
      team: { ...raw.team, queues: labels(raw.team.queues, 'analytics.queue_'), byRole: labels(raw.team.byRole, 'userForm.type.') },
    };
  }, [raw, t]);
}
