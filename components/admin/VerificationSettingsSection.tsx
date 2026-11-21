'use client';

/**
 * Onglet « Vérification des documents » des paramètres — l'API externe.
 *
 * Contrairement aux autres onglets, cette section n'écrit pas dans le
 * `localStorage` : la vérification se décide côté serveur (la route publique
 * `/api/verification/check` ne peut pas lire le navigateur de l'administrateur),
 * et l'onglet « Codes de vérification » partage le même fichier. On lit donc, on
 * enregistre, tout par `/api/admin/verification` — la clé d'API part en clair
 * entre cet écran et le dépôt `data/verification.json`, comme SMTP et l'ERP.
 *
 * Le bouton « Tester » appelle l'API configurée sans l'enregistrer : on peut
 * valider URL, en-tête et chemins de réponse avant de basculer `enabled`, et le
 * test signale si un code renvoyé n'a pas d'entrée au catalogue — sans catalog
 * entry, la page publique refuse d'afficher le résultat, autant le voir ici.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Save, ShieldCheck, FlaskConical } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';

interface ApiSettings {
  enabled: boolean;
  url: string;
  apiKey: string;
  authHeader: 'X-API-Key' | 'Authorization' | 'none';
  method: 'GET' | 'POST';
  timeoutMs: number;
  codeParam: string;
  hashParam: string;
  response: { code: string; type: string; issuer: string; message: string };
  fallbackToLocal: boolean;
  showDemoCodes: boolean;
}

const EMPTY: ApiSettings = {
  enabled: false,
  url: '',
  apiKey: '',
  authHeader: 'X-API-Key',
  method: 'GET',
  timeoutMs: 15000,
  codeParam: 'code',
  hashParam: 'hash',
  response: { code: 'code', type: 'type', issuer: 'issuer', message: 'message' },
  fallbackToLocal: true,
  showDemoCodes: true,
};

export default function VerificationSettingsSection() {
  const t = useTranslations('admin.verificationSettings');
  const { showToast } = useToast();
  const ts = useTranslations('admin.settings');
  const tv = useTranslations('admin.verificationCodes');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [api, setApi] = useState<ApiSettings>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ code: 'SARI-FAC24-00001', key: '', result: null as null | Record<string, unknown>, error: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/verification', { cache: 'no-store' });
        const json = await res.json();
        if (json && json.api) {
          const srv = json.api as ApiSettings & { apiKey?: string };
          // Le GET masque la clé (***MASKED***) : ne pas l'afficher, laisser vide pour « conserver »
          const apiKey = srv.apiKey === '***MASKED***' ? '' : (srv.apiKey as string);
          setApi({ ...EMPTY, ...srv, apiKey, response: { ...EMPTY.response, ...((srv as unknown as { response?: ApiSettings['response'] }).response || {}) } });
        }
      } catch {
        showToast(t('loadError'), 'error');
      } finally {
        setLoaded(true);
      }
    })();
  }, [showToast, t]);

  const set = useCallback((patch: Partial<ApiSettings>) => setApi((prev) => ({ ...prev, ...patch })), []);
  const setResp = (patch: Partial<ApiSettings['response']>) => setApi((prev) => ({ ...prev, response: { ...prev.response, ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/verification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || t('saveDenied'));
      showToast(t('saved'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tc('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTest((prev) => ({ ...prev, result: null, error: '' }));
    try {
      const res = await fetch('/api/admin/verification/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api, locale, code: test.code, key: test.key }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = `test_${json.code}`;
        throw new Error(t.has(key) ? t(key) : t('testRefused', { status: res.status }));
      }
      setTest((prev) => ({ ...prev, result: json as Record<string, unknown> }));
    } catch (error) {
      setTest((prev) => ({ ...prev, error: error instanceof Error ? error.message : t('testError') }));
    }
  };

  if (!loaded) {
    return <section className="ad-card p-5 text-sm" style={{ color: 'var(--ad-muted)' }}>{t('loading')}</section>;
  }

  return (
    <section className="ad-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ad-section-title">{ts('verification')}</h2>
        <span
          className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${api.enabled && api.url ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          {api.enabled && api.url ? t('apiActive') : t('localMode')}
        </span>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--ad-muted)' }}>
        {t.rich('intro', {
          path: `/${locale}/verification`, link: `/${locale}/verification/{code}/{hash}`,
          catalog: (text) => <Link href={`/${locale}/admin/verification-codes`} className="font-bold underline decoration-dotted">{text}</Link>,
        })}
      </p>

      <div
        className="flex items-start justify-between gap-4 py-2 rounded-lg px-3"
        style={{ border: '1px solid var(--ad-line)' }}
      >
        <div className="space-y-0.5">
          <div className="text-sm font-bold">{t('external')}</div>
          <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            {t('localHint', { path: 'data/<locale>/verification-codes.json' })}
          </div>
        </div>
        <button type="button" onClick={() => set({ enabled: !api.enabled })} className={`ad-toggle ${api.enabled ? 'is-on' : ''}`} aria-pressed={api.enabled} role="switch">
          {api.enabled ? (
            <>
              <span className="ad-toggle-label">{ts('enabled')}</span>
              <span className="ad-toggle-knob" />
            </>
          ) : (
            <>
              <span className="ad-toggle-knob" />
              <span className="ad-toggle-label">{ts('disabled')}</span>
            </>
          )}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="md:col-span-2 space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('url')}</span>
          <input
            className="ad-input font-mono"
            placeholder="https://api.exemple.com/v1/verify"
            value={api.url}
            onChange={(e) => set({ url: e.target.value })}
          />
          <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
            {t('requestHint')}
          </span>
        </label>

        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{ts('apiKey')}</span>
          <input
            className="ad-input font-mono"
            type="password"
            autoComplete="off"
            placeholder={api.apiKey ? t('keepKey') : ''}
            value={api.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('authHeader')}</span>
          <select className="ad-select" value={api.authHeader} onChange={(e) => set({ authHeader: e.target.value as ApiSettings['authHeader'] })}>
            <option value="X-API-Key">X-API-Key</option>
            <option value="Authorization">Authorization: Bearer</option>
            <option value="none">{t('noAuth')}</option>
          </select>
        </label>

        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('method')}</span>
          <select className="ad-select" value={api.method} onChange={(e) => set({ method: e.target.value as ApiSettings['method'] })}>
            <option value="GET">{t('get')}</option>
            <option value="POST">{t('post')}</option>
          </select>
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('timeout')}</span>
          <input
            className="ad-input"
            type="number"
            min={2000}
            max={60000}
            step={500}
            value={api.timeoutMs}
            onChange={(e) => set({ timeoutMs: Number(e.target.value) || 15000 })}
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('codeParam')}</span>
          <input className="ad-input font-mono" value={api.codeParam} onChange={(e) => set({ codeParam: e.target.value })} />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('hashParam')}</span>
          <input className="ad-input font-mono" value={api.hashParam} onChange={(e) => set({ hashParam: e.target.value })} />
        </label>

        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['code', 'type', 'issuer', 'message'] as const).map((field) => (
            <label key={field} className="space-y-1.5 block">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                {t(`response_${field}`)}
              </span>
              <input
                className="ad-input font-mono"
                placeholder="data.result.code"
                value={api.response[field]}
                onChange={(e) => setResp({ [field]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="md:col-span-2 text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          {t('responseHint')}
        </p>

        <div className="md:col-span-2 flex items-start justify-between gap-4 py-2 rounded-lg px-3" style={{ border: '1px solid var(--ad-line)' }}>
          <div className="space-y-0.5">
            <div className="text-sm font-bold">{t('fallback')}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
              {t('fallbackHint')}
            </div>
          </div>
          <button type="button" onClick={() => set({ fallbackToLocal: !api.fallbackToLocal })} className={`ad-toggle ${api.fallbackToLocal ? 'is-on' : ''}`} aria-pressed={api.fallbackToLocal} role="switch">
            {api.fallbackToLocal ? (
              <>
                <span className="ad-toggle-label">{ts('enabled')}</span>
                <span className="ad-toggle-knob" />
              </>
            ) : (
              <>
                <span className="ad-toggle-knob" />
                <span className="ad-toggle-label">{ts('disabled')}</span>
              </>
            )}
          </button>
        </div>

        <div className="md:col-span-2 flex items-start justify-between gap-4 py-2 rounded-lg px-3" style={{ border: '1px solid var(--ad-line)' }}>
          <div className="space-y-0.5">
            <div className="text-sm font-bold">{t('demo')}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
              {t('demoHint', { path: `/${locale}/verification` })}
            </div>
          </div>
          <button type="button" onClick={() => set({ showDemoCodes: !api.showDemoCodes })} className={`ad-toggle ${api.showDemoCodes ? 'is-on' : ''}`} aria-pressed={api.showDemoCodes} role="switch">
            {api.showDemoCodes ? (
              <>
                <span className="ad-toggle-label">{tv('shown')}</span>
                <span className="ad-toggle-knob" />
              </>
            ) : (
              <>
                <span className="ad-toggle-knob" />
                <span className="ad-toggle-label">{tv('hidden')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Le test : l'API telle que saisie, avant enregistrement. */}
      <div className="pt-2 space-y-3" style={{ borderTop: '1px solid var(--ad-line)' }}>
        <h3 className="ad-section-title flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />
          {t('testConfig')}
        </h3>
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('documentCode')}</span>
            <input className="ad-input font-mono uppercase" value={test.code} onChange={(e) => setTest((prev) => ({ ...prev, code: e.target.value }))} />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('key')}</span>
            <input className="ad-input font-mono" value={test.key} onChange={(e) => setTest((prev) => ({ ...prev, key: e.target.value }))} placeholder="CTdxXe6ZdFVzWQ==" />
          </label>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={runTest}>{t('test')}</button>
        </div>
        {test.error && (
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">{test.error}</p>
        )}
        {test.result && (
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-green-700 dark:text-green-400">
              {t('received', { code: String(test.result.codeValue ?? '') })}
              {test.result.mapped ? ` → ${String((test.result.mapped as { label?: string }).label || '')}` : ''}
            </p>
            {test.result.warning ? (
              <p className="font-semibold text-orange-600 dark:text-orange-400">⚠ {t('unmapped', { code: String(test.result.codeValue ?? '') })}</p>
            ) : null}
            <pre className="ad-card p-3 overflow-auto max-h-48 text-[11px] font-mono">
              {JSON.stringify(test.result.raw, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Link href={`/${locale}/admin/verification-codes`} className="ad-btn ad-btn-ghost inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {t('catalog')}
        </Link>
        <button type="button" className="ad-btn ad-btn-primary inline-flex items-center gap-2" onClick={save} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? tc('saving') : t('save')}
        </button>
      </div>
    </section>
  );
}
