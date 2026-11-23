'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmsAdminFetch } from '@/lib/cms-admin';
import { subjectLabels } from '@/lib/contact-subjects';
import {
  SUBJECTS,
  type ContactPolicy,
  type ContactPolicyState,
  type Route,
  type Subject,
} from '@/backend/src/modules/contact/contact-contract';
import { useToast } from './Toast';

const path = '/contact/triage/policy';
export default function ContactTriageSettings() {
  const t = useTranslations('admin.contactTriage'),
    tc = useTranslations('admin.common'),
    tp = useTranslations('pages.contact');
  const { showToast } = useToast();
  const [state, setState] = useState<ContactPolicyState | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    cmsAdminFetch<ContactPolicyState>(path)
      .then((s) => {
        if (live) setState(s);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  if (!state) return <p role="status">{error || tc('loading')}</p>;
  const { policy, ai } = state;
  const patch = (diff: Partial<ContactPolicy>) => setState({ ...state, policy: { ...policy, ...diff } });
  const setRoute = (subject: Subject, route: Route) => patch({ routes: { ...policy.routes, [subject]: route } });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setState(await cmsAdminFetch<ContactPolicyState>(path, { method: 'PUT', json: policy }));
      showToast(tc('saved'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : tc('saveError'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="ad-card p-5 space-y-5">
      <header>
        <h2 className="text-lg font-black">{t('settings')}</h2>
        <p className="text-sm mt-1">{t('settingsHelp')}</p>
      </header>
      <div className="rounded border p-3 text-sm" role="status">
        <strong>{ai.configured ? t('provider', { model: ai.model }) : t('noProvider')}</strong>
        <br />
        {t('providerHelp')}
      </div>
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            {t('minConfidence')}
            <input
              className="ad-input w-full"
              type="number"
              min={50}
              max={100}
              required
              value={policy.minConfidence}
              onChange={(e) => patch({ minConfidence: Number(e.target.value) })}
            />
          </label>
          <label>
            {t('penaltyPoints')}
            <input
              className="ad-input w-full"
              type="number"
              min={0}
              max={100}
              required
              value={policy.penaltyPoints}
              onChange={(e) => patch({ penaltyPoints: Number(e.target.value) })}
            />
          </label>
          {(['spam', 'inappropriate', 'mismatch'] as const).map((key) => (
            <label key={key}>
              {t(key)}
              <select
                className="ad-input w-full"
                value={policy[key]}
                onChange={(e) => patch({ [key]: e.target.value })}
              >
                <option value="review">{t('review')}</option>
                {key === 'mismatch' ? (
                  <option value="reclassify">{t('reclassify')}</option>
                ) : (
                  <option value="discard">{t('discard')}</option>
                )}
              </select>
            </label>
          ))}
        </div>
        <section>
          <h3 className="font-bold">{t('routes')}</h3>
          <p className="text-sm mb-3">{t('routesHelp')}</p>
          <div className="space-y-2">
            {SUBJECTS.map((s) => {
              const route = policy.routes[s];
              return (
                <div key={s} className="grid md:grid-cols-3 items-center gap-2">
                  <label htmlFor={`route-${s}`}>{tp(subjectLabels[s])}</label>
                  <select
                    id={`route-${s}`}
                    className="ad-input"
                    value={route.mode}
                    onChange={(e) => {
                      const mode = e.target.value as Route['mode'];
                      setRoute(s, mode === 'external' ? { mode, email: '' } : { mode });
                    }}
                  >
                    {(['inbox', 'company', 'external'] as const).map((m) => (
                      <option key={m} value={m}>
                        {t(m)}
                      </option>
                    ))}
                  </select>
                  {route.mode === 'external' && (
                    <input
                      className="ad-input"
                      type="email"
                      required
                      maxLength={254}
                      dir="ltr"
                      aria-label={`${tp(subjectLabels[s])} — ${tc('email')}`}
                      value={route.email}
                      onChange={(e) => setRoute(s, { mode: 'external', email: e.target.value.trim() })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <button className="ad-btn ad-btn-primary" type="submit">
          {tc('save')}
        </button>
      </fieldset>
    </form>
  );
}
