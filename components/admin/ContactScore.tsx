'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cmsAdminFetch } from '@/lib/cms-admin';
import type { ContactDossier } from '@/backend/src/modules/contact/contact-contract';
import DateText from '@/components/shared/DateText';

export default function ContactScore({ account }: { account: string }) {
  const t = useTranslations('admin.contactTriage'),
    tc = useTranslations('admin.common');
  const [dossier, setDossier] = useState<ContactDossier | null>(null),
    [error, setError] = useState('');
  const [version, refresh] = useState(0),
    [busy, setBusy] = useState(false);
  const path = `/contact/triage/accounts/${encodeURIComponent(account)}`;
  useEffect(() => {
    let live = true;
    cmsAdminFetch<ContactDossier>(path)
      .then((r) => {
        if (live) {
          setDossier(r);
          setError('');
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, version]);
  const retract = async (id: number) => {
    if (!confirm(t('confirmRetract'))) return;
    setBusy(true);
    try {
      await cmsAdminFetch(`${path}/penalties/${id}`, { method: 'DELETE' });
      refresh((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h3 className="font-bold">{t('score')}</h3>
      {error && <p role="alert">{error}</p>}
      {dossier ? (
        <>
          <p className="text-sm">{t('balance', { score: dossier.score, total: dossier.total })}</p>
          <ul>
            {dossier.notes.map((n) => (
              <li key={n.id} className="text-sm py-1">
                <DateText value={n.createdAt} /> · {t(n.reason)} ({n.points}){' '}
                <button disabled={busy} className="ad-btn ad-btn-ghost" onClick={() => retract(n.id)}>
                  {t('retract')}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        !error && <p>{tc('loading')}</p>
      )}
    </section>
  );
}
