'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarCheck, Users } from 'lucide-react';
import { ModuleEditPage } from '@/components/admin/CmsModulePages';
import { getEventRegistrationStats, type EventRegistrationStats } from '@/lib/event-registrations-admin';

export default function Page() {
  const params = useParams();
  const id = String(params.id);
  const locale = useLocale();
  const t = useTranslations('admin.eventRegistrations');
  const [stats, setStats] = useState<EventRegistrationStats | null>(null);

  useEffect(() => {
    if (!id || id === 'new') return;
    let cancelled = false;
    getEventRegistrationStats(id)
      .then((res) => {
        if (!cancelled) setStats(res.stats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-4">
      {id !== 'new' && (
        <div className="ad-card p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <CalendarCheck className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
            <span className="font-bold">{t('title')}</span>
            {stats && (
              <span className="ad-chip ad-chip-acc">
                {stats.total} · {t('kpiConfirmed')}: {stats.confirmed} · {t('kpiAttended')}: {stats.attended}
              </span>
            )}
          </div>
          <Link
            href={`/${locale}/admin/events/registrations?eventId=${encodeURIComponent(id)}`}
            className="ad-btn ad-btn-primary !py-1.5 text-xs"
          >
            <Users className="w-3.5 h-3.5" /> {t('title')}
          </Link>
        </div>
      )}
      <ModuleEditPage moduleKey="events" id={id} />
    </div>
  );
}
