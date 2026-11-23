'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { cmsAdminFetch } from '@/lib/cms-admin';
import { subjectLabels } from '@/lib/contact-subjects';
import {
  CONTACT_STATUSES,
  SUBJECTS,
  isSubject,
  type ContactMeta,
  type ContactStatus,
} from '@/backend/src/modules/contact/contact-contract';
import DateText from '@/components/shared/DateText';
import { useToast } from './Toast';

interface Row {
  id: number;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: ContactStatus;
  meta?: ContactMeta;
  createdAt: string;
}
interface Page {
  data: Row[];
  meta: { total: number; totalPages: number };
}
const path = '/contact/messages';

/** Boîte CMS partagée : contrairement à Conversations, rien ne passe par le localStorage. */
export default function ContactInbox() {
  const locale = useLocale();
  const t = useTranslations('admin.contactTriage'),
    tc = useTranslations('admin.common');
  const [status, setStatus] = useState('all'),
    [page, setPage] = useState(1),
    [version, refresh] = useState(0);
  const [result, setResult] = useState<Page | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ view: 'block', limit: '15', page: String(page) });
    if (status !== 'all') query.set('filter', JSON.stringify({ status }));
    cmsAdminFetch<Page>(`${path}?${query}`)
      .then((v) => {
        if (!live) return;
        if (page > v.meta.totalPages) setPage(v.meta.totalPages);
        setResult(v);
        setError('');
      })
      .catch((e: Error) => {
        if (live) {
          setResult(null);
          setError(e.message);
        }
      });
    return () => {
      live = false;
    };
  }, [status, page, version]);
  const reload = () => {
    setResult(null);
    refresh((n) => n + 1);
  };
  return (
    <section className="space-y-3">
      <header className="ad-card p-4 space-y-2">
        <h2 className="font-bold">{t('queue')}</h2>
        <p className="text-sm">{t('queueHelp')}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <label>
            {tc('status')}{' '}
            <select
              className="ad-input"
              value={status}
              onChange={(e) => {
                setResult(null);
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{tc('all')}</option>
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </label>
          <button className="ad-btn ad-btn-ghost" onClick={reload}>
            {tc('refresh')}
          </button>
          <Link href={`/${locale}/admin/settings?tab=contactTriage`} className="ad-btn ad-btn-ghost">
            {t('settings')}
          </Link>
        </div>
      </header>
      {error ? (
        <p role="alert">{error}</p>
      ) : !result ? (
        <p role="status">{tc('loading')}</p>
      ) : (
        <>
          {!result.data.length && <p>{tc('noData')}</p>}
          {result.data.map((row) => (
            <ContactItem key={`${row.id}-${version}`} row={row} onChange={reload} />
          ))}
          <nav className="flex items-center gap-3" aria-label={t('queue')}>
            <button
              className="ad-btn ad-btn-ghost"
              disabled={page <= 1}
              onClick={() => {
                setResult(null);
                setPage(page - 1);
              }}
            >
              {t('previous')}
            </button>
            <span>
              {page} / {result.meta.totalPages}
            </span>
            <button
              className="ad-btn ad-btn-ghost"
              disabled={page >= result.meta.totalPages}
              onClick={() => {
                setResult(null);
                setPage(page + 1);
              }}
            >
              {t('next')}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

function ContactItem({ row, onChange }: { row: Row; onChange: () => void }) {
  const t = useTranslations('admin.contactTriage'),
    tc = useTranslations('admin.common'),
    tp = useTranslations('pages.contact');
  const { showToast } = useToast();
  const [subject, setSubject] = useState(row.subject || ''),
    [status, setStatus] = useState(row.status);
  const [followUp, setFollowUp] = useState(row.meta?.followUp || ''),
    [busy, setBusy] = useState(false);
  const label = (v?: string) => (isSubject(v) ? tp(subjectLabels[v]) : v || '—');
  const reason = row.meta?.reason,
    route = row.meta?.route;
  const persist = async (purge: boolean) => {
    if (purge && !confirm(t('confirmPurge'))) return;
    setBusy(true);
    try {
      if (purge) {
        const url = `${path}/${row.id}/purge`;
        const token = await cmsAdminFetch<{ confirm: string }>(url, { method: 'POST' });
        await cmsAdminFetch(`${url}?confirm=${encodeURIComponent(token.confirm)}`, { method: 'DELETE' });
      } else
        await cmsAdminFetch(`${path}/${row.id}`, {
          method: 'PATCH',
          json: { status, followUp, ...(isSubject(subject) && { subject }) },
        });
      showToast(purge ? tc('deleted') : tc('saved'), 'success');
      onChange();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="ad-card p-4">
      <summary className="cursor-pointer break-words">
        <span className={`ad-chip ${row.status === 'review' ? 'ad-chip-warn' : 'ad-chip-acc'}`}>
          {t.has(row.status) ? t(row.status) : row.status}
        </span>{' '}
        <strong>
          #{row.id} · {label(row.subject)}
        </strong>{' '}
        — {row.name} · <DateText value={row.createdAt} />
      </summary>
      <div className="mt-3 space-y-3">
        <div className="text-sm break-words" dir="auto">
          {[row.email, row.phone, row.meta?.company].filter(Boolean).join(' · ')}
        </div>
        <p
          dir="auto"
          className="whitespace-pre-wrap break-words p-3 rounded"
          style={{ background: 'var(--ad-surface-2)' }}
        >
          {row.message}
        </p>
        <dl className="text-sm grid sm:grid-cols-2 gap-2">
          {reason && (
            <div>
              <dt className="font-semibold">{t('decision')}</dt>
              <dd>{t.has(reason) ? t(reason) : reason}</dd>
            </div>
          )}
          {row.meta?.selectedSubject && (
            <div>
              <dt className="font-semibold">{t('selected')}</dt>
              <dd>{label(row.meta.selectedSubject)}</dd>
            </div>
          )}
          {row.meta?.suggestedSubject && (
            <div>
              <dt className="font-semibold">{t('suggested')}</dt>
              <dd>{label(row.meta.suggestedSubject)}</dd>
            </div>
          )}
          {route && (
            <div>
              <dt className="font-semibold">{t('plannedRoute')}</dt>
              <dd>
                {t(route.mode)}
                {route.mode !== 'inbox' && ` · ${route.email || '—'}`}
              </dd>
            </div>
          )}
        </dl>
        <fieldset disabled={busy} className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <label>
              {tc('category')}{' '}
              <select className="ad-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {!isSubject(row.subject) && <option value={row.subject || ''}>{label(row.subject)}</option>}
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tc('status')}{' '}
              <select
                className="ad-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
              >
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            {t('followUp')}
            <textarea
              className="ad-input w-full"
              maxLength={1500}
              rows={2}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </label>
          <div className="flex gap-2 flex-wrap">
            <button className="ad-btn ad-btn-primary" onClick={() => persist(false)}>
              {tc('save')}
            </button>
            <button className="ad-btn ad-btn-danger" onClick={() => persist(true)}>
              {t('discard')}
            </button>
          </div>
        </fieldset>
      </div>
    </details>
  );
}
