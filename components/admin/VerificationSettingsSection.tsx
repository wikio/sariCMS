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
import { useLocale } from 'next-intl';
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
};

export default function VerificationSettingsSection() {
  const { showToast } = useToast();
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
        if (json && json.api) setApi({ ...EMPTY, ...json.api, response: { ...EMPTY.response, ...(json.api.response || {}) } });
      } catch {
        showToast('Réglages de vérification illisibles — les valeurs par défaut sont affichées.', 'error');
      } finally {
        setLoaded(true);
      }
    })();
  }, [showToast]);

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
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Enregistrement refusé.');
      showToast('Réglages de vérification enregistrés.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Enregistrement impossible.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTest((t) => ({ ...t, result: null, error: '' }));
    try {
      const res = await fetch('/api/admin/verification/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api, code: test.code, key: test.key }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || `Test refusé (${res.status}).`);
      setTest((t) => ({ ...t, result: json as Record<string, unknown> }));
    } catch (error) {
      setTest((t) => ({ ...t, error: error instanceof Error ? error.message : 'Test impossible.' }));
    }
  };

  if (!loaded) {
    return <section className="ad-card p-5 text-sm" style={{ color: 'var(--ad-muted)' }}>Chargement des réglages de vérification…</section>;
  }

  return (
    <section className="ad-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ad-section-title">Vérification des documents</h2>
        <span
          className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${api.enabled && api.url ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          {api.enabled && api.url ? 'API externe active' : 'Régime local (démonstration)'}
        </span>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--ad-muted)' }}>
        La page <code>/{locale}/verification</code> accepte un couple <strong>code + clé</strong>, lu depuis un lien
        <code> /{locale}/verification/{'{code}'}/{'{hash}'}</code> ou saisi à la main. Après le contrôle anti-robot, ce couple est
        soumis à l’API définie ci-dessous, qui renvoie un <strong>code de vérification</strong> — 1 valide, 0 falsifié, 2 expiré,
        3 révoqué, et tout autre code que vous ajoutez au{' '}
        <Link href={`/${locale}/admin/verification-codes`} className="font-bold underline decoration-dotted">catalogue des codes</Link>.
      </p>

      <div
        className="flex items-start justify-between gap-4 py-2 rounded-lg px-3"
        style={{ border: '1px solid var(--ad-line)' }}
      >
        <div className="space-y-0.5">
          <div className="text-sm font-bold">Vérification par l’API externe</div>
          <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            Désactivé, la page consulte le registre local <code>data/&lt;locale&gt;/verification-codes.json</code> — le mode historique, avec ses codes de démonstration.
          </div>
        </div>
        <button type="button" onClick={() => set({ enabled: !api.enabled })} className={`ad-toggle ${api.enabled ? 'is-on' : ''}`} aria-pressed={api.enabled} role="switch">
          {api.enabled ? (
            <>
              <span className="ad-toggle-label">Activé</span>
              <span className="ad-toggle-knob" />
            </>
          ) : (
            <>
              <span className="ad-toggle-knob" />
              <span className="ad-toggle-label">Désactivé</span>
            </>
          )}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="md:col-span-2 space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>URL de l’API de vérification</span>
          <input
            className="ad-input font-mono"
            placeholder="https://api.exemple.com/v1/verify"
            value={api.url}
            onChange={(e) => set({ url: e.target.value })}
          />
          <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
            En GET, le code et la clé voyagent en query string ; en POST, en corps JSON — mêmes noms de champs.
          </span>
        </label>

        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Clé d’API</span>
          <input
            className="ad-input font-mono"
            type="password"
            autoComplete="off"
            placeholder={api.apiKey ? '•••• enregistrée — laisser vide pour la conserver' : ''}
            value={api.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>En-tête d’authentification</span>
          <select className="ad-select" value={api.authHeader} onChange={(e) => set({ authHeader: e.target.value as ApiSettings['authHeader'] })}>
            <option value="X-API-Key">X-API-Key</option>
            <option value="Authorization">Authorization: Bearer</option>
            <option value="none">Aucun (API ouverte)</option>
          </select>
        </label>

        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Méthode</span>
          <select className="ad-select" value={api.method} onChange={(e) => set({ method: e.target.value as ApiSettings['method'] })}>
            <option value="GET">GET — paramètres en query string</option>
            <option value="POST">POST — paramètres en corps JSON</option>
          </select>
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Délai (ms)</span>
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
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Nom du paramètre « code »</span>
          <input className="ad-input font-mono" value={api.codeParam} onChange={(e) => set({ codeParam: e.target.value })} />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Nom du paramètre « hash »</span>
          <input className="ad-input font-mono" value={api.hashParam} onChange={(e) => set({ hashParam: e.target.value })} />
        </label>

        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['code', 'type', 'issuer', 'message'] as const).map((field) => (
            <label key={field} className="space-y-1.5 block">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                Réponse · {field === 'code' ? 'code de vérification' : field === 'type' ? 'Type' : field === 'issuer' ? 'Émetteur' : 'Message'}
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
          Chemins pointés dans le JSON renvoyé par l’API : <code>code</code> lit la racine, <code>data.result.code</code> lit trois
          niveaux plus bas. Le champ « code de vérification » est <strong>obligatoire</strong> — sans lui, aucune réponse n’est traduisible.
        </p>

        <div className="md:col-span-2 flex items-start justify-between gap-4 py-2 rounded-lg px-3" style={{ border: '1px solid var(--ad-line)' }}>
          <div className="space-y-0.5">
            <div className="text-sm font-bold">Repli sur le registre local si l’API tombe</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
              Si l’API est injoignable, la page répond avec le registre local et l’annonce. Désactivé, une panne d’API affiche une
              erreur — plus honnête quand un tiers se fie à la vérification pour accepter un document.
            </div>
          </div>
          <button type="button" onClick={() => set({ fallbackToLocal: !api.fallbackToLocal })} className={`ad-toggle ${api.fallbackToLocal ? 'is-on' : ''}`} aria-pressed={api.fallbackToLocal} role="switch">
            {api.fallbackToLocal ? (
              <>
                <span className="ad-toggle-label">Activé</span>
                <span className="ad-toggle-knob" />
              </>
            ) : (
              <>
                <span className="ad-toggle-knob" />
                <span className="ad-toggle-label">Désactivé</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Le test : l'API telle que saisie, avant enregistrement. */}
      <div className="pt-2 space-y-3" style={{ borderTop: '1px solid var(--ad-line)' }}>
        <h3 className="ad-section-title flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />
          Tester la configuration
        </h3>
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Code du document</span>
            <input className="ad-input font-mono uppercase" value={test.code} onChange={(e) => setTest((t) => ({ ...t, code: e.target.value }))} />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Clé de vérification</span>
            <input className="ad-input font-mono" value={test.key} onChange={(e) => setTest((t) => ({ ...t, key: e.target.value }))} placeholder="CTdxXe6ZdFVzWQ==" />
          </label>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={runTest}>Tester</button>
        </div>
        {test.error && (
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">{test.error}</p>
        )}
        {test.result && (
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-green-700 dark:text-green-400">
              Réponse reçue — code « {String((test.result as { codeValue?: unknown }).codeValue ?? '')} »
              {test.result.mapped ? ` → ${String((test.result.mapped as { label?: string }).label || '')}` : ''}
            </p>
            {test.result.warning ? (
              <p className="font-semibold text-orange-600 dark:text-orange-400">⚠ {String(test.result.warning)}</p>
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
          Catalogue des codes de vérification
        </Link>
        <button type="button" className="ad-btn ad-btn-primary inline-flex items-center gap-2" onClick={save} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer la vérification'}
        </button>
      </div>
    </section>
  );
}
