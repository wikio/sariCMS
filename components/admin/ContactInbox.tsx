'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Archive, Bot, CheckCheck, Eye, Inbox, Mail, MailOpen, RefreshCw, RotateCcw, Trash2,
} from 'lucide-react';
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
interface Page { data: Row[]; meta: { total: number; totalPages: number } }
const path = '/contact/messages';

export default function ContactInbox() {
  const locale = useLocale();
  const t = useTranslations('admin.contactTriage');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();

  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [version, refresh] = useState(0);
  const [result, setResult] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ view: 'block', limit: '15', page: String(page) });
    if (status !== 'all') query.set('filter', JSON.stringify({ status }));
    cmsAdminFetch<Page>(`${path}?${query}`)
      .then((v) => {
        if (!live) return;
        if (page > v.meta.totalPages && v.meta.totalPages > 0) setPage(v.meta.totalPages);
        setResult(v);
        setError('');
      })
      .catch((e: Error) => {
        if (live) { setResult(null); setError(e.message); }
      });
    return () => { live = false; };
  }, [status, page, version]);

  const reload = () => { setSelected([]); setResult(null); refresh((n) => n + 1); };

  const rows = result?.data || [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id));

  const runBulk = async (action: 'status' | 'delete' | 'triage', nextStatus?: ContactStatus) => {
    if (!selected.length) return;
    if (action === 'delete' && !confirm(t('confirmBulkDelete', { count: selected.length }))) return;
    setBusy(action + (nextStatus || ''));
    try {
      if (action === 'triage') {
        const r = await cmsAdminFetch<{ updated: number; failed: number }>(`${path}/bulk/triage`, {
          method: 'POST', json: { ids: selected },
        });
        showToast(t('bulkTriageDone', { updated: r.updated, failed: r.failed }), r.failed ? 'error' : 'success');
      } else if (action === 'delete') {
        const r = await cmsAdminFetch<{ deleted: number; failed: number }>(`${path}/bulk/delete`, {
          method: 'POST', json: { ids: selected },
        });
        showToast(t('bulkDeleteDone', { deleted: r.deleted, failed: r.failed }), r.failed ? 'error' : 'success');
      } else if (nextStatus) {
        const r = await cmsAdminFetch<{ updated: number; failed: number }>(`${path}/bulk/status`, {
          method: 'POST', json: { ids: selected, status: nextStatus },
        });
        showToast(t('bulkStatusDone', { updated: r.updated, failed: r.failed }), r.failed ? 'error' : 'success');
      }
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tc('error'), 'error');
    } finally { setBusy(null); }
  };

  const one = async (row: Row, action: 'triage' | 'delete' | 'status', nextStatus?: ContactStatus) => {
    if (action === 'delete' && !confirm(t('confirmPurge'))) return;
    setBusy(`${action}-${row.id}`);
    try {
      if (action === 'triage') {
        await cmsAdminFetch(`${path}/${row.id}/triage`, { method: 'POST' });
        showToast(t('triageDone'), 'success');
      } else if (action === 'delete') {
        await cmsAdminFetch(`${path}/${row.id}`, { method: 'DELETE' });
        showToast(tc('deleted'), 'success');
      } else if (nextStatus) {
        await cmsAdminFetch(`${path}/${row.id}`, { method: 'PATCH', json: { status: nextStatus } });
        showToast(tc('saved'), 'success');
      }
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tc('error'), 'error');
    } finally { setBusy(null); }
  };

  return (
    <section className="space-y-3">
      <header className="ad-card p-4 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold">{t('queue')}</h2>
            <p className="text-sm">{t('queueHelp')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label>
              {tc('status')}{' '}
              <select className="ad-input" value={status} onChange={(e) => { setResult(null); setStatus(e.target.value); setPage(1); setSelected([]); }}>
                <option value="all">{tc('all')}</option>
                {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
              </select>
            </label>
            <button className="ad-btn ad-btn-ghost" onClick={reload}><RefreshCw className="w-4 h-4" /> {tc('refresh')}</button>
            <Link href={`/${locale}/admin/settings?tab=contactTriage`} className="ad-btn ad-btn-ghost">{t('settings')}</Link>
          </div>
        </div>
      </header>

      {selected.length > 0 && (
        <div className="ad-card p-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{t('selectedCount', { count: selected.length })}</span>
          <button className="ad-btn ad-btn-ghost" disabled={!!busy} onClick={() => runBulk('status', 'new')}><MailOpen className="w-4 h-4" /> {t('markNew')}</button>
          <button className="ad-btn ad-btn-ghost" disabled={!!busy} onClick={() => runBulk('status', 'read')}><CheckCheck className="w-4 h-4" /> {t('markRead')}</button>
          <button className="ad-btn ad-btn-ghost" disabled={!!busy} onClick={() => runBulk('status', 'review')}><Eye className="w-4 h-4" /> {t('markReview')}</button>
          <button className="ad-btn ad-btn-ghost" disabled={!!busy} onClick={() => runBulk('status', 'archived')}><Archive className="w-4 h-4" /> {t('markArchived')}</button>
          <button className="ad-btn ad-btn-ghost" disabled={!!busy} onClick={() => runBulk('triage')}><Bot className="w-4 h-4" /> {busy === 'triage' ? t('triaging') : t('verifyAi')}</button>
          <button className="ad-btn ad-btn-danger" disabled={!!busy} onClick={() => runBulk('delete')}><Trash2 className="w-4 h-4" /> {tc('delete')}</button>
        </div>
      )}

      {error ? (
        <p role="alert">{error}</p>
      ) : !result ? (
        <p role="status">{tc('loading')}</p>
      ) : !rows.length ? (
        <div className="ad-card p-8 text-center" style={{ color: 'var(--ad-muted)' }}>
          <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />{tc('noData')}
        </div>
      ) : (
        <>
          <div className="ad-card overflow-x-auto">
            <table className="ad-table">
              <thead>
                <tr>
                  <th className="w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('selectAll')} /></th>
                  <th>{t('contactLabel')}</th>
                  <th>{tc('category')}</th>
                  <th>{tc('status')}</th>
                  <th>{t('date')}</th>
                  <th className="text-right">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ContactRow
                    key={row.id}
                    row={row}
                    checked={selected.includes(row.id)}
                    onToggle={() => toggle(row.id)}
                    open={openId === row.id}
                    onOpen={() => setOpenId(openId === row.id ? null : row.id)}
                    busy={busy}
                    onAction={(action, nextStatus) => one(row, action, nextStatus)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <nav className="flex items-center gap-3" aria-label={t('queue')}>
            <button className="ad-btn ad-btn-ghost" disabled={page <= 1} onClick={() => { setResult(null); setPage(page - 1); }}>{t('previous')}</button>
            <span>{page} / {result.meta.totalPages || 1}</span>
            <button className="ad-btn ad-btn-ghost" disabled={page >= (result.meta.totalPages || 1)} onClick={() => { setResult(null); setPage(page + 1); }}>{t('next')}</button>
          </nav>
        </>
      )}
    </section>
  );
}

function ContactRow({ row, checked, onToggle, open, onOpen, busy, onAction }: {
  row: Row; checked: boolean; onToggle: () => void; open: boolean; onOpen: () => void;
  busy: string | null; onAction: (action: 'triage' | 'delete' | 'status', nextStatus?: ContactStatus) => void;
}) {
  const t = useTranslations('admin.contactTriage');
  const tc = useTranslations('admin.common');
  const tp = useTranslations('pages.contact');
  const [subject, setSubject] = useState(row.subject || '');
  const [statusValue, setStatusValue] = useState<ContactStatus>(row.status);
  const [followUp, setFollowUp] = useState(row.meta?.followUp || '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { setSubject(row.subject || ''); setStatusValue(row.status); setFollowUp(row.meta?.followUp || ''); }, [row]);

  const label = (v?: string) => (isSubject(v) ? tp(subjectLabels[v]) : v || '—');
  const reason = row.meta?.reason;
  const route = row.meta?.route;
  const confidence = (row.meta as any)?.confidence;
  const rowBusy = !!busy;

  const save = async () => {
    setSaving(true);
    try {
      await cmsAdminFetch(`${path}/${row.id}`, {
        method: 'PATCH',
        json: { status: statusValue, followUp, ...(isSubject(subject) && { subject }) },
      });
      showToast(tc('saved'), 'success');
    } catch (e) { showToast(e instanceof Error ? e.message : tc('error'), 'error'); }
    finally { setSaving(false); }
  };

  const mailto = `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Re: ${label(row.subject)}`)}`;

  return (
    <>
      <tr>
        <td><input type="checkbox" checked={checked} onChange={onToggle} aria-label={`${tc('select')} ${row.name}`} /></td>
        <td>
          <div className="font-semibold break-words">{row.name}</div>
          <div className="text-xs break-words" style={{ color: 'var(--ad-muted)' }}>{row.email}{row.phone ? ` · ${row.phone}` : ''}</div>
        </td>
        <td>{label(row.subject)}</td>
        <td>
          <span className={`ad-chip ${row.status === 'review' ? 'ad-chip-warn' : row.status === 'archived' ? 'ad-chip-mute' : 'ad-chip-acc'}`}>
            {t.has(row.status) ? t(row.status) : row.status}
          </span>
        </td>
        <td className="whitespace-nowrap text-sm"><DateText value={row.createdAt} /></td>
        <td>
          <div className="flex items-center justify-end gap-1">
            <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t('viewDetails')} onClick={onOpen}><Eye className="w-4 h-4" /></button>
            <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t('markRead')} disabled={rowBusy} onClick={() => onAction('status', 'read')}><CheckCheck className="w-4 h-4" /></button>
            <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t('markReview')} disabled={rowBusy} onClick={() => onAction('status', 'review')}><RotateCcw className="w-4 h-4" /></button>
            <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t('verifyAi')} disabled={rowBusy} onClick={() => onAction('triage')}><Bot className="w-4 h-4" /></button>
            <a className="ad-btn ad-btn-icon ad-btn-ghost" title={t('sendMail')} href={mailto}><Mail className="w-4 h-4" /></a>
            <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t('markArchived')} disabled={rowBusy} onClick={() => onAction('status', 'archived')}><Archive className="w-4 h-4" /></button>
            <button className="ad-btn ad-btn-icon ad-btn-danger" title={tc('delete')} disabled={rowBusy} onClick={() => onAction('delete')}><Trash2 className="w-4 h-4" /></button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            <div className="p-3 space-y-3" style={{ background: 'var(--ad-surface-2)' }}>
              <div className="text-sm break-words" dir="auto">{[row.email, row.phone, row.meta?.company].filter(Boolean).join(' · ')}</div>
              <p dir="auto" className="whitespace-pre-wrap break-words p-3 rounded" style={{ background: 'var(--ad-surface)' }}>{row.message}</p>
              <dl className="text-sm grid sm:grid-cols-2 gap-2">
                {reason && <div><dt className="font-semibold">{t('decision')}</dt><dd>{t.has(reason) ? t(reason) : reason}</dd></div>}
                {typeof confidence === 'number' && <div><dt className="font-semibold">{t('confidence')}</dt><dd>{confidence}%</dd></div>}
                {row.meta?.selectedSubject && <div><dt className="font-semibold">{t('selected')}</dt><dd>{label(row.meta.selectedSubject)}</dd></div>}
                {row.meta?.suggestedSubject && <div><dt className="font-semibold">{t('suggested')}</dt><dd>{label(row.meta.suggestedSubject)}</dd></div>}
                {route && <div><dt className="font-semibold">{t('plannedRoute')}</dt><dd>{t(route.mode)}{route.mode !== 'inbox' && ` · ${route.email || '—'}`}</dd></div>}
              </dl>
              <fieldset disabled={saving} className="space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <label>{tc('category')}{' '}
                    <select className="ad-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                      {!isSubject(row.subject) && <option value={row.subject || ''}>{label(row.subject)}</option>}
                      {SUBJECTS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </label>
                  <label>{tc('status')}{' '}
                    <select className="ad-input" value={statusValue} onChange={(e) => setStatusValue(e.target.value as ContactStatus)}>
                      {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block">{t('followUp')}
                  <textarea className="ad-input w-full" maxLength={1500} rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button className="ad-btn ad-btn-primary" onClick={save}>{tc('save')}</button>
                </div>
              </fieldset>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
