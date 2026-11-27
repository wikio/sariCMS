'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmsAdminFetch } from '@/lib/cms-admin';
import type {
  ContactAiDraft,
  ContactAiStatus,
  ContactAiTestCode,
} from '@/backend/src/modules/contact/contact-contract';

const path = '/contact/triage/connection';
const draftFrom = (s: ContactAiStatus): ContactAiDraft => ({
  url: s.overrides.url,
  model: s.overrides.model,
  systemPrompt: s.overrides.systemPrompt || '',
  userPromptTemplate: s.overrides.userPromptTemplate || '',
});

/** Formulaire indépendant : tester un brouillon ne sauvegarde ni les identifiants ni les règles. */
export default function ContactAiConnection({ initial }: { initial: ContactAiStatus }) {
  const t = useTranslations('admin.contactTriage');
  const [status, setStatus] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [busy, setBusy] = useState<'test' | 'save' | 'reset' | null>(null);
  const [feedback, setFeedback] = useState('');
  const set = (p: Partial<ContactAiDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setFeedback('');
  };

  const run = async (action: 'test' | 'save' | 'reset') => {
    const clearing =
      action === 'save' &&
      status.source === 'admin' &&
      !draft.url.trim() &&
      !draft.model.trim() &&
      !draft.apiKey?.trim();
    if ((action === 'reset' || clearing) && !window.confirm(t('confirmEnv'))) return;
    setBusy(action);
    setFeedback('');
    try {
      if (action === 'test') {
        const { code } = await cmsAdminFetch<{ code: ContactAiTestCode }>(`${path}/test`, {
          method: 'POST',
          json: draft,
        });
        setFeedback(t(`testResult_${code}`));
      } else {
        const next = await cmsAdminFetch<ContactAiStatus>(
          path,
          action === 'reset' ? { method: 'DELETE' } : { method: 'PUT', json: draft },
        );
        setStatus(next);
        setDraft(draftFrom(next)); // La clé saisie disparaît après l’enregistrement.
        setFeedback(t(next.source === 'admin' ? 'connectionSaved' : 'envRestored'));
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : t('connectionError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      method="post"
      autoComplete="off"
      className="rounded border p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run('save');
      }}
    >
      <h3 className="font-bold">{t('connectionTitle')}</h3>
      <p className="text-sm">{t('providerHelp')}</p>
      <p className="text-sm" role="status">
        <span className="ad-chip">{t(`connectionSource_${status.source}`)}</span>{' '}
        {status.configured ? t('provider', { model: status.model }) : t('noProvider')}
      </p>
      <fieldset disabled={!!busy} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2">
            {t('connectionUrl')}
            <input
              id="contact-ai-url"
              className="ad-input w-full"
              type="url"
              dir="ltr"
              maxLength={2048}
              spellCheck={false}
              placeholder="https://…/v1/chat/completions"
              value={draft.url}
              onChange={(e) => set({ url: e.target.value })}
            />
          </label>
          <label>
            {t('connectionModel')}
            <input
              id="contact-ai-model"
              className="ad-input w-full"
              dir="ltr"
              maxLength={256}
              spellCheck={false}
              placeholder="CONTACT_AI_MODEL (.env)"
              value={draft.model}
              onChange={(e) => set({ model: e.target.value })}
            />
          </label>
          <label>
            {t('connectionKey')}
            <input
              id="contact-ai-key"
              className="ad-input w-full"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              maxLength={4096}
              placeholder={status.overrides.hasKey ? t('keyStored') : 'CONTACT_AI_API_KEY (.env)'}
              aria-describedby="contact-ai-key-help"
              value={draft.apiKey || ''}
              onChange={(e) => set({ apiKey: e.target.value })}
            />
          </label>
        </div>
        <p id="contact-ai-key-help" className="text-sm">
          {t('keyHelp')}
        </p>
        <details className="rounded border p-3" style={{ borderColor: 'var(--ad-line)' }}>
          <summary className="font-semibold cursor-pointer">{t('promptSettings')}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm">{t('promptSettingsHelp')}</p>
            <label className="block">
              {t('systemPrompt')}
              <textarea
                className="ad-input w-full min-h-[140px] font-mono text-xs"
                maxLength={8000}
                value={draft.systemPrompt || ''}
                onChange={(e) => set({ systemPrompt: e.target.value })}
                placeholder={t('systemPromptPlaceholder')}
              />
            </label>
            <label className="block">
              {t('userPromptTemplate')}
              <textarea
                className="ad-input w-full min-h-[90px] font-mono text-xs"
                maxLength={8000}
                value={draft.userPromptTemplate || ''}
                onChange={(e) => set({ userPromptTemplate: e.target.value })}
                placeholder="{{json}}"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{t('userPromptTemplateHelp')}</p>
            </label>
            <div className="rounded p-3 text-xs" style={{ background: 'var(--ad-surface-2)' }}>
              <div className="font-semibold mb-1">{t('outputContract')}</div>
              <pre className="whitespace-pre-wrap break-words" dir="ltr">{`{
  "spam": boolean,
  "inappropriate": boolean,
  "matchesSubject": boolean,
  "suggestedSubject": "devis"|"technique"|"commercial"|"rh"|"partenaire"|"client"|null,
  "confidence": 0-100
}`}</pre>
              <p className="mt-2" style={{ color: 'var(--ad-muted)' }}>{t('outputContractHelp')}</p>
            </div>
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => void run('test')}>
            {busy === 'test' ? t('testingConnection') : t('testConnection')}
          </button>
          <button type="submit" className="ad-btn ad-btn-primary">
            {t('saveConnection')}
          </button>
          {(status.source === 'admin' || status.source === 'unreadable') && (
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => void run('reset')}>
              {t('useEnv')}
            </button>
          )}
        </div>
        <p className="text-sm">{t('testHelp')}</p>
      </fieldset>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {feedback}
      </p>
    </form>
  );
}
