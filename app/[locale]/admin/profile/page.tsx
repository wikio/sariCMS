'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, QrCode, Save, ShieldCheck, ShieldOff } from 'lucide-react';
import { persistAdminSession, readAdminAccess, readAdminUser, type AdminUser } from '@/lib/admin-session';
import { cmsAdminFetch, cmsAdminUpdate } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { useToast } from '@/components/admin/Toast';

export default function ProfilePage() {
  const params = useSearchParams();
  const edit = params.get('edit') === '1';
  const { showToast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // État 2FA
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    const u = readAdminUser();
    setUser(u);
    setDraft({
      firstName: u?.firstName || '',
      lastName: u?.lastName || '',
      email: u?.email || '',
      phone: '',
    });
    if (u?.totpEnabled !== undefined) setTotpEnabled(u.totpEnabled);
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMe = async () => {
    try {
      const me = await cmsAdminFetch<{ totpEnabled?: boolean; email?: string; firstName?: string; lastName?: string }>('/auth/me');
      if (me?.totpEnabled !== undefined) setTotpEnabled(me.totpEnabled);
      setUser((prev) => prev ? { ...prev, totpEnabled: Boolean(me.totpEnabled), ...(me.firstName ? { firstName: me.firstName } : {}) } : prev);
    } catch {
      /* API hors ligne */
    }
  };

  const save = async () => {
    if (!user) return;
    try {
      await cmsAdminUpdate('users', user.id, draft);
      persistAdminSession({ accessToken: readAdminAccess() || '', user: { ...user, ...draft } });
      setUser({ ...user, ...draft });
      showToast('Profil mis à jour', 'success');
    } catch {
      persistAdminSession({ accessToken: readAdminAccess() || '', user: { ...user, ...draft } });
      setUser({ ...user, ...draft });
      showToast('Profil enregistré localement', 'info');
    }
  };

  const startSetup = async () => {
    setTwoFaBusy(true);
    try {
      const res = await cmsAdminFetch<{ secret: string; otpauth: string; qrDataUrl: string }>('/auth/2fa/setup', { method: 'POST' });
      setSetup(res);
      setTotpCode('');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Génération du secret impossible', 'error');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (totpCode.length !== 6) { showToast('Saisissez le code à 6 chiffres', 'error'); return; }
    setTwoFaBusy(true);
    try {
      await cmsAdminFetch('/auth/2fa/enable', { method: 'POST', json: { code: totpCode } });
      setTotpEnabled(true);
      setSetup(null);
      setTotpCode('');
      showToast('Double authentification activée ✅', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Code invalide', 'error');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (disableCode.length !== 6) { showToast('Saisissez votre code TOTP', 'error'); return; }
    setTwoFaBusy(true);
    try {
      await cmsAdminFetch('/auth/2fa/disable', { method: 'POST', json: { code: disableCode } });
      setTotpEnabled(false);
      setDisableCode('');
      showToast('Double authentification désactivée', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Code invalide', 'error');
    } finally {
      setTwoFaBusy(false);
    }
  };

  if (!user) return <div className="ad-card p-8">Aucun utilisateur connecté.</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Compte</div>
        <h1 className="text-3xl font-black">{edit ? 'Mettre à jour le profil' : 'Profil'}</h1>
      </header>

      <section className="ad-card p-5 space-y-3 ad-rise">
        <h2 className="ad-section-title">Informations</h2>
        {['firstName', 'lastName', 'email', 'phone'].map((key) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{key}</span>
            <input className="ad-input" disabled={!edit && key !== 'phone'} value={draft[key as keyof typeof draft]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
          </label>
        ))}
        <div className="text-sm" style={{ color: 'var(--ad-muted)' }}>Rôle : {user.role || user.type || 'admin'}</div>
        <button className="ad-btn ad-btn-primary" onClick={save}><Save className="w-4 h-4" /> Enregistrer</button>
      </section>

      <section className="ad-card p-5 space-y-4 ad-rise ad-rise-2">
        <h2 className="ad-section-title flex items-center gap-2"><KeyRound className="w-4 h-4" /> Double authentification (2FA)</h2>

        <div className="flex items-center gap-3">
          {totpEnabled ? (
            <span className="ad-chip ad-chip-ok"><ShieldCheck className="w-3.5 h-3.5" /> Activée</span>
          ) : (
            <span className="ad-chip ad-chip-mute"><ShieldOff className="w-3.5 h-3.5" /> Désactivée</span>
          )}
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            {totpEnabled
              ? 'La connexion exige désormais un code TOTP à 6 chiffres.'
              : 'Activez la 2FA pour sécuriser votre compte avec une appli d’authentification.'}
          </p>
        </div>

        {totpEnabled ? (
          <div className="space-y-3">
            <p className="text-sm font-bold">Désactiver la 2FA</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Code TOTP actuel</span>
                <input
                  className="ad-input w-40 text-center tracking-[0.4em] font-bold"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                />
              </label>
              <button className="ad-btn ad-btn-danger" disabled={twoFaBusy || disableCode.length !== 6} onClick={confirmDisable}>
                {twoFaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />} Désactiver
              </button>
            </div>
          </div>
        ) : setup ? (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
              1. Scannez ce QR code avec Google Authenticator, Authy ou FreeOTP — ou saisissez la clé manuellement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="ad-card p-2" style={{ background: '#fff' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrDataUrl} alt="QR code 2FA" width={180} height={180} />
              </div>
              <div className="space-y-2 min-w-0">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>Clé secrète</div>
                  <code className="text-sm font-mono break-all" style={{ color: 'var(--ad-accent)' }}>{setup.secret}</code>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>2. Code à 6 chiffres</div>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input
                      className="ad-input w-40 text-center tracking-[0.4em] font-bold"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                    />
                    <button className="ad-btn ad-btn-primary" disabled={twoFaBusy || totpCode.length !== 6} onClick={confirmEnable}>
                      {twoFaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Activer
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button className="ad-btn ad-btn-ghost" onClick={() => setSetup(null)}>Annuler</button>
          </div>
        ) : (
          <button className="ad-btn ad-btn-lime" disabled={twoFaBusy} onClick={startSetup}>
            {twoFaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Activer la 2FA
          </button>
        )}
      </section>
    </div>
  );
}
