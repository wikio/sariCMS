'use client';

import { useTranslations } from 'next-intl';

/**
 * Onglet « SMTP / Email » des paramètres.
 *
 * Cet écran écrivait autrefois dans le `localStorage` du navigateur : les
 * réglages n'arrivaient jamais au serveur d'API, qui ne lisait que ses variables
 * d'environnement. On pouvait donc remplir l'hôte, le port et le mot de passe,
 * enregistrer, et voir « SMTP non configuré » s'afficher indéfiniment — aucun
 * email réel ne partait.
 *
 * Désormais tout passe par le serveur (`/mail/smtp`), qui range les réglages dans
 * `storage/mail/smtp.json` et reconstruit son transport aussitôt. Les variables
 * d'environnement restent lues en secours tant que rien n'a été enregistré ici.
 *
 * Deux tests, parce qu'ils ne prouvent pas la même chose :
 *   • « Tester la connexion » ouvre une session et s'authentifie. Il dit si
 *     l'hôte, le port et les identifiants sont bons, sans rien envoyer.
 *   • « Envoyer un email de test » remet un vrai message. C'est le seul qui
 *     prouve que la boîte de réception le reçoit — un serveur peut accepter la
 *     session puis refuser l'expéditeur.
 *
 * Le test porte sur les réglages **enregistrés** : le serveur ne peut pas deviner
 * ce que contient un formulaire non soumis. D'où l'avertissement et le bouton
 * « Enregistrer puis tester » quand le formulaire a été modifié.
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Mail, PlugZap, Save, Send, Trash2, XCircle } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import {
  clearSmtp,
  loadSmtp,
  saveSmtp,
  testSmtp,
  type SmtpForm,
  type SmtpStatus,
  type SmtpTestResult,
} from '@/lib/mail';

/** Formulaire vide : port 587, STARTTLS — le réglage le plus courant. */
const EMPTY: SmtpForm = { host: '', port: 587, secure: false, user: '', pass: '', from: '', replyTo: '' };

/** Ce que le serveur nous a renvoyé, pour détecter un formulaire modifié. */
function formFromStatus(s: SmtpStatus): SmtpForm {
  return {
    host: s.host,
    port: s.port,
    secure: s.secure,
    user: s.user,
    // Le serveur ne renvoie jamais le mot de passe : le champ reste vide et un
    // envoi vide conserve celui déjà enregistré.
    pass: '',
    from: s.from,
    replyTo: s.replyTo,
  };
}

function differs(a: SmtpForm, b: SmtpForm): boolean {
  return (
    a.host !== b.host ||
    a.port !== b.port ||
    a.secure !== b.secure ||
    a.user !== b.user ||
    a.from !== b.from ||
    a.replyTo !== b.replyTo ||
    // Un mot de passe saisi est toujours un changement ; vide, il ne change rien.
    Boolean(a.pass)
  );
}

type DisplayResult = SmtpTestResult & { diagnostic?: string };

const SMTP_ERRORS: Record<string, string> = {
  EAUTH: 'authError', ECONNECTION: 'hostError', ENOTFOUND: 'hostError', EAI_AGAIN: 'hostError',
  ETIMEDOUT: 'timeoutError', ESOCKET: 'socketError', ESOCKETTLS: 'tlsError',
  ERR_TLS_CERT_ALTNAME_INVALID: 'tlsError', CERT_HAS_EXPIRED: 'tlsError',
  EMESSAGE: 'messageError', EENVELOPE: 'messageError',
};

export default function SmtpSection() {
  const t = useTranslations('admin.smtpSettings');
  const ts = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [baseline, setBaseline] = useState<SmtpForm>(EMPTY);
  const [form, setForm] = useState<SmtpForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [testTo, setTestTo] = useState('');

  const patch = (p: Partial<SmtpForm>) => setForm((f) => ({ ...f, ...p }));

  const refresh = useCallback(async () => {
    try {
      const s = await loadSmtp();
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doSave = useCallback(async (): Promise<SmtpStatus | null> => {
    if (!form.host.trim()) {
      showToast(t('needHost'), 'error');
      return null;
    }
    setSaving(true);
    try {
      const s = await saveSmtp({ ...form, host: form.host.trim() });
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      setResult(null);
      showToast(t('saved'), 'success');
      return s;
    } catch (err) {
      showToast(err instanceof Error ? err.message : tc('saveError'), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, showToast, t, tc]);

  /** Enregistre si besoin, puis teste — évite de tester une configuration périmée. */
  const runTest = useCallback(
    async (to?: string) => {
      const dirty = differs(form, baseline);
      if (dirty) {
        const saved = await doSave();
        if (!saved) return;
      }
      const busy = to ? setSendingTest : setTesting;
      busy(true);
      setResult(null);
      try {
        const r = await testSmtp(to);
        const message = r.ok
          ? r.stage === 'send' ? t('deliveredTo', { to: to || '' }) : t('connectionOk', { host: r.host, port: r.port })
          : t(!r.host ? 'needHost' : SMTP_ERRORS[r.code || ''] || 'testError');
        setResult({ ...r, message, diagnostic: r.ok ? undefined : r.message });
        showToast(message, r.ok ? 'success' : 'error');
        await refresh();
      } catch (err) {
        const message = t('testError');
        setResult({
          ok: false,
          stage: to ? 'send' : 'connect',
          message,
          diagnostic: err instanceof Error ? err.message : undefined,
          tookMs: 0,
          host: form.host,
          port: form.port,
        });
        showToast(message, 'error');
      } finally {
        busy(false);
      }
    },
    [baseline, doSave, form, refresh, showToast, t],
  );

  const doClear = useCallback(async () => {
    try {
      const s = await clearSmtp();
      setStatus(s);
      const next = formFromStatus(s);
      setBaseline(next);
      setForm(next);
      setResult(null);
      showToast(
        s.configured
          ? t('resetEnv')
          : t('resetOff'),
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('resetError'), 'error');
    }
  }, [showToast, t]);

  const dirty = differs(form, baseline);

  return (
    <section className="ad-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="ad-section-title">{ts('smtp')}</h2>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            {t('storageHint', { path: 'storage/mail/smtp.json' })}
          </p>
        </div>
        <StatusChip status={status} loading={loading} />
      </div>

      {loadError && (
        <p className="text-xs ad-chip ad-chip-warn">
          {t('serverError', { error: loadError })}
        </p>
      )}

      {dirty && (
        <p className="text-xs ad-chip ad-chip-warn">
          {t('dirty')}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Label text={t('host')}>
          <input
            className="ad-input"
            value={form.host}
            placeholder="smtp.exemple.dz"
            onChange={(e) => patch({ host: e.target.value })}
          />
        </Label>
        <Label text={t('port')}>
          <input
            className="ad-input"
            inputMode="numeric"
            value={String(form.port)}
            onChange={(e) => patch({ port: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </Label>
        <Label text={t('user')}>
          <input
            className="ad-input"
            value={form.user}
            placeholder="noreply@exemple.dz"
            onChange={(e) => patch({ user: e.target.value })}
          />
        </Label>
        <Label text={t('password')}>
          <input
            className="ad-input"
            type="password"
            value={form.pass}
            autoComplete="new-password"
            placeholder={status?.hasPassword ? t('keepPassword') : ''}
            onChange={(e) => patch({ pass: e.target.value })}
          />
        </Label>
        <Label text={t('from')}>
          <input
            className="ad-input"
            value={form.from}
            placeholder="SARI Système <noreply@exemple.dz>"
            onChange={(e) => patch({ from: e.target.value })}
          />
        </Label>
        <Label text={t('replyTo')}>
          <input
            className="ad-input"
            value={form.replyTo}
            placeholder="contact@exemple.dz"
            onChange={(e) => patch({ replyTo: e.target.value })}
          />
        </Label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className={`ad-btn ${form.secure ? 'ad-btn-lime' : 'ad-btn-ghost'}`}
          onClick={() => patch({ secure: !form.secure })}
        >
          TLS/SSL : {form.secure ? t('secure') : t('starttls')}
        </button>
        {status?.stored && (
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => void doClear()}>
            <Trash2 className="w-4 h-4" /> {t('clear')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-1" style={{ borderTop: '1px solid var(--ad-line)' }}>
        <button type="button" className="ad-btn ad-btn-primary" disabled={saving} onClick={() => void doSave()}>
          <Save className="w-4 h-4" /> {saving ? tc('saving') : tc('save')}
        </button>
        <button type="button" className="ad-btn" disabled={testing || sendingTest} onClick={() => void runTest()}>
          <PlugZap className="w-4 h-4" /> {testing ? t('testing') : t('test')}
        </button>
        <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          {t('testHint')}
        </span>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[240px] flex-1">
          <Label text={t('testRecipient')}>
            <input
              className="ad-input"
              type="email"
              value={testTo}
              placeholder="vous@exemple.dz"
              onChange={(e) => setTestTo(e.target.value)}
            />
          </Label>
        </div>
        <button
          type="button"
          className="ad-btn"
          disabled={sendingTest || testing || !testTo.trim()}
          onClick={() => void runTest(testTo.trim())}
        >
          {sendingTest ? <Send className="w-4 h-4" /> : <Mail className="w-4 h-4" />}{' '}
          {sendingTest ? t('sending') : t('sendTest')}
        </button>
      </div>

      {result && <TestResult result={result} />}
    </section>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
        {text}
      </span>
      {children}
    </label>
  );
}

function StatusChip({ status, loading }: { status: SmtpStatus | null; loading: boolean }) {
  const t = useTranslations('admin.smtpSettings');
  if (loading) return <span className="ad-chip ad-chip-mute">{t('reading')}</span>;
  if (!status) return <span className="ad-chip ad-chip-warn">{t('unknown')}</span>;
  if (!status.configured) {
    return <span className="ad-chip ad-chip-warn">{t('notConfigured')}</span>;
  }
  return (
    <span className="ad-chip ad-chip-ok">
      {t('on')} {status.host}:{status.port}
      {status.source === 'env' ? t('env') : ''}
    </span>
  );
}

function TestResult({ result }: { result: DisplayResult }) {
  const t = useTranslations('admin.smtpSettings');
  return (
    <div
      className="p-3 rounded-xl border text-sm space-y-1.5"
      style={{
        borderColor: result.ok ? 'var(--ad-line)' : 'color-mix(in srgb, var(--ad-accent) 45%, var(--ad-line))',
      }}
    >
      <div className="flex items-center gap-2 font-black">
        {result.ok ? (
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--ad-lime, #65a30d)' }} />
        ) : (
          <XCircle className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
        )}
        {result.ok
          ? result.stage === 'send'
            ? t('testDelivered')
            : t('connected')
          : result.stage === 'send'
            ? t('sendFailed')
            : t('connectFailed')}
        {result.code && (
          <span className="ad-chip ad-chip-mute font-mono">{result.code}</span>
        )}
      </div>
      <p style={{ color: 'var(--ad-muted)' }}>{result.message}</p>
      {result.diagnostic && (
        <details className="text-xs"><summary>{t('diagnostic')}</summary><p dir="auto">{result.diagnostic}</p></details>
      )}
      <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
        {result.host}:{result.port} · {result.tookMs} ms
        {result.messageId ? ` · Message-ID ${result.messageId}` : ''}
      </p>
    </div>
  );
}
