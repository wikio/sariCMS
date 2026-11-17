'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarCheck, Users } from 'lucide-react';
import { ModuleListPage } from '@/components/admin/CmsModulePages';
import { getEventRegistrationStats, type EventRegistrationStats } from '@/lib/event-registrations-admin';

export default function Page() {
  const locale = useLocale();
  const t = useTranslations('admin.eventRegistrations');
  const [stats, setStats] = useState<EventRegistrationStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEventRegistrationStats()
      .then((res) => {
        if (!cancelled) setStats(res.stats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="ad-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ad-rise">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}
          >
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-sm">{t('title')}</div>
            <div className="text-xs flex flex-wrap gap-2 mt-0.5" style={{ color: 'var(--ad-muted)' }}>
              <span>{t('kpiTotal')}: <strong>{stats?.total ?? 0}</strong></span>
              <span>·</span>
              <span>{t('kpiPending')}: <strong>{stats?.pending ?? 0}</strong></span>
              <span>·</span>
              <span>{t('kpiConfirmed')}: <strong>{stats?.confirmed ?? 0}</strong></span>
              <span>·</span>
              <span>{t('kpiAttended')}: <strong>{stats?.attended ?? 0}</strong></span>
            </div>
          </div>
        </div>
        <Link href={`/${locale}/admin/events/registrations`} className="ad-btn ad-btn-primary shrink-0">
          <Users className="w-4 h-4" /> {t('title')}
        </Link>
      </div>
      <ModuleListPage moduleKey="events" />
    </div>
  );
}
