'use client';

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

export default function SmtpSection() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [baseline, setBaseline] = useState<SmtpForm>(EMPTY);
  const [form, setForm] = useState<SmtpForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [result, setResult] = useState<SmtpTestResult | null>(null);
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
      setLoadError(err instanceof Error ? err.message : 'État SMTP illisible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doSave = useCallback(async (): Promise<SmtpStatus | null> => {
    if (!form.host.trim()) {
      showToast('L’hôte SMTP est obligatoire.', 'error');
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
      showToast('Réglages SMTP enregistrés et appliqués.', 'success');
      return s;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Enregistrement impossible', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, showToast]);

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
        setResult(r);
        showToast(r.message, r.ok ? 'success' : 'error');
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Test impossible';
        setResult({
          ok: false,
          stage: to ? 'send' : 'connect',
          message,
          tookMs: 0,
          host: form.host,
          port: form.port,
        });
        showToast(message, 'error');
      } finally {
        busy(false);
      }
    },
    [baseline, doSave, form, refresh, showToast],
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
          ? 'Réglages oubliés — les variables d’environnement sont de nouveau appliquées.'
          : 'Réglages oubliés — SMTP non configuré.',
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Opération impossible', 'error');
    }
  }, [showToast]);

  const dirty = differs(form, baseline);

  return (
    <section className="ad-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="ad-section-title">SMTP / Email</h2>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            Enregistré sur le serveur (<code>storage/mail/smtp.json</code>) et appliqué aussitôt,
            sans redémarrage. Laissez « Hôte » vide pour le mode fichier (outbox).
          </p>
        </div>
        <StatusChip status={status} loading={loading} />
      </div>

      {loadError && (
        <p className="text-xs ad-chip ad-chip-warn">
          État du serveur illisible : {loadError} — le serveur d’API est-il lancé ?
        </p>
      )}

      {dirty && (
        <p className="text-xs ad-chip ad-chip-warn">
          Modifications non enregistrées. Le test porte sur les réglages enregistrés — utilisez
          « Enregistrer puis tester » pour valider ce que vous venez de saisir.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Label text="Hôte">
          <input
            className="ad-input"
            value={form.host}
            placeholder="smtp.exemple.dz"
            onChange={(e) => patch({ host: e.target.value })}
          />
        </Label>
        <Label text="Port">
          <input
            className="ad-input"
            inputMode="numeric"
            value={String(form.port)}
            onChange={(e) => patch({ port: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </Label>
        <Label text="Utilisateur">
          <input
            className="ad-input"
            value={form.user}
            placeholder="noreply@exemple.dz"
            onChange={(e) => patch({ user: e.target.value })}
          />
        </Label>
        <Label text="Mot de passe">
          <input
            className="ad-input"
            type="password"
            value={form.pass}
            autoComplete="new-password"
            placeholder={status?.hasPassword ? '••••••••  (enregistré — laissez vide pour conserver)' : ''}
            onChange={(e) => patch({ pass: e.target.value })}
          />
        </Label>
        <Label text="Expéditeur">
          <input
            className="ad-input"
            value={form.from}
            placeholder="SARI Système <noreply@exemple.dz>"
            onChange={(e) => patch({ from: e.target.value })}
          />
        </Label>
        <Label text="Reply-To">
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
          TLS/SSL : {form.secure ? 'activé (port 465)' : 'désactivé — STARTTLS (port 587)'}
        </button>
        {status?.stored && (
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => void doClear()}>
            <Trash2 className="w-4 h-4" /> Oublier ces réglages
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-1" style={{ borderTop: '1px solid var(--ad-line)' }}>
        <button type="button" className="ad-btn ad-btn-primary" disabled={saving} onClick={() => void doSave()}>
          <Save className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="ad-btn" disabled={testing || sendingTest} onClick={() => void runTest()}>
          <PlugZap className="w-4 h-4" /> {testing ? 'Test en cours…' : 'Tester la connexion'}
        </button>
        <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          Ouvre une session et s’authentifie, sans rien envoyer.
        </span>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[240px] flex-1">
          <Label text="Destinataire du message de test">
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
          {sendingTest ? 'Envoi…' : 'Envoyer un email de test'}
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
  if (loading) return <span className="ad-chip ad-chip-mute">Lecture…</span>;
  if (!status) return <span className="ad-chip ad-chip-warn">État inconnu</span>;
  if (!status.configured) {
    return <span className="ad-chip ad-chip-warn">Non configuré — mode « fichier », aucun email réel</span>;
  }
  return (
    <span className="ad-chip ad-chip-ok">
      SMTP actif — {status.host}:{status.port}
      {status.source === 'env' ? ' (variables d’environnement)' : ''}
    </span>
  );
}

function TestResult({ result }: { result: SmtpTestResult }) {
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
            ? 'Message de test remis'
            : 'Connexion établie'
          : result.stage === 'send'
            ? 'Envoi refusé'
            : 'Connexion impossible'}
        {result.code && (
          <span className="ad-chip ad-chip-mute font-mono">{result.code}</span>
        )}
      </div>
      <p style={{ color: 'var(--ad-muted)' }}>{result.message}</p>
      <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
        {result.host}:{result.port} · {result.tookMs} ms
        {result.messageId ? ` · Message-ID ${result.messageId}` : ''}
      </p>
    </div>
  );
}
