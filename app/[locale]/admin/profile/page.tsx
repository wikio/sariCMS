'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, QrCode, Save, ShieldCheck, ShieldOff } from 'lucide-react';
import { readAdminUser, type AdminUser } from '@/lib/admin-session';
import { cmsAdminFetch, cmsAdminUpdate } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { useAdminAuth, setAuthCache } from '@/components/admin/useAdminAuth';
import { useToast } from '@/components/admin/Toast';
import { useTranslations } from 'next-intl';

export default function ProfilePage() {
  const params = useSearchParams();
  const edit = params.get('edit') === '1';
  const { user: authUser } = useAdminAuth();
  const { showToast } = useToast();
  const t = useTranslations('admin.profile');
  const tc = useTranslations('admin.common');
  const tf = useTranslations('admin.userForm');
  const tp = useTranslations('admin.permissions');
  const tm = useTranslations('admin.menu');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // État 2FA
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    const u = authUser || readAdminUser();
    if (u) {
      setUser(u);
      setDraft((prev) => ({
        firstName: u.firstName || prev.firstName || '',
        lastName: u.lastName || prev.lastName || '',
        email: u.email || prev.email || '',
        phone: prev.phone || '',
      }));
      if (u.totpEnabled !== undefined) setTotpEnabled(u.totpEnabled);
    }
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const refreshMe = async () => {
    try {
      const me = await cmsAdminFetch<{ id?: string; totpEnabled?: boolean; email?: string; firstName?: string; lastName?: string; phone?: string; type?: string; role?: string }>('/auth/me');
      if (me?.totpEnabled !== undefined) setTotpEnabled(me.totpEnabled);
      setUser((prev) => {
        const merged: AdminUser | null = prev
          ? { ...prev, totpEnabled: Boolean(me.totpEnabled), ...(me.firstName ? { firstName: me.firstName } : {}), ...(me.lastName ? { lastName: me.lastName } : {}), ...(me.email ? { email: me.email } : {}) }
          : me?.email
            ? { id: String(me.id || ''), email: me.email, firstName: me.firstName, lastName: me.lastName, type: me.type, role: me.role, totpEnabled: Boolean(me.totpEnabled) }
            : null;
        return merged;
      });
      setDraft((prev) => ({
        firstName: me?.firstName ?? prev.firstName,
        lastName: me?.lastName ?? prev.lastName,
        email: me?.email ?? prev.email,
        phone: me?.phone ?? prev.phone,
      }));
    } catch {
      /* API hors ligne */
    }
  };

  const save = async () => {
    if (!user) return;
    const updated = { ...user, ...draft };
    try {
      await cmsAdminUpdate('users', user.id, draft);
      setAuthCache(updated);
      setUser(updated);
      showToast(t('updated'), 'success');
    } catch {
      setUser(updated);
      showToast(t('savedLocal'), 'info');
    }
  };

  const startSetup = async () => {
    setTwoFaBusy(true);
    try {
      const res = await cmsAdminFetch<{ secret: string; otpauth: string; qrDataUrl: string }>('/auth/2fa/setup', { method: 'POST' });
      setSetup(res);
      setTotpCode('');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('setupError'), 'error');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (totpCode.length !== 6) { showToast(t('needCode'), 'error'); return; }
    setTwoFaBusy(true);
    try {
      await cmsAdminFetch('/auth/2fa/enable', { method: 'POST', json: { code: totpCode } });
      setTotpEnabled(true);
      setSetup(null);
      setTotpCode('');
      showToast(t('enableSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('invalidCode'), 'error');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (disableCode.length !== 6) { showToast(t('needTotp'), 'error'); return; }
    setTwoFaBusy(true);
    try {
      await cmsAdminFetch('/auth/2fa/disable', { method: 'POST', json: { code: disableCode } });
      setTotpEnabled(false);
      setDisableCode('');
      showToast(t('disableSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('invalidCode'), 'error');
    } finally {
      setTwoFaBusy(false);
    }
  };

  if (!user) return <div className="ad-card p-8">{t("noUser")}</div>;

  const role = user.role === 'superadmin' ? 'super-admin' : user.role || user.type || 'admin';
  return (
    <div className="space-y-4 max-w-2xl">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>{t("account")}</div>
        <h1 className="text-3xl font-black">{edit ? t('updateProfile') : tm('profile')}</h1>
      </header>

      <section className="ad-card p-5 space-y-3 ad-rise">
        <h2 className="ad-section-title">{t('informations')}</h2>
        {['firstName', 'lastName', 'email', 'phone'].map((key) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{tf(key)}</span>
            <input className="ad-input" disabled={!edit && key !== 'phone'} value={draft[key as keyof typeof draft]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
          </label>
        ))}
        <div className="text-sm" style={{ color: 'var(--ad-muted)' }}>{tf('role')} : {tp.has(`role_${role}`) ? tp(`role_${role}`) : tf.has(`type.${role}`) ? tf(`type.${role}`) : role}</div>
        <button className="ad-btn ad-btn-primary" onClick={save}><Save className="w-4 h-4" /> {tc('save')}</button>
      </section>

      <section className="ad-card p-5 space-y-4 ad-rise ad-rise-2">
        <h2 className="ad-section-title flex items-center gap-2"><KeyRound className="w-4 h-4" /> {t('twoFactor')}</h2>

        <div className="flex items-center gap-3">
          {totpEnabled ? (
            <span className="ad-chip ad-chip-ok"><ShieldCheck className="w-3.5 h-3.5" /> {t('enabled')}</span>
          ) : (
            <span className="ad-chip ad-chip-mute"><ShieldOff className="w-3.5 h-3.5" /> {t('disabled')}</span>
          )}
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
            {totpEnabled
              ? t('twoFactorEnabled')
              : t('twoFactorDesc')}
          </p>
        </div>

        {totpEnabled ? (
          <div className="space-y-3">
            <p className="text-sm font-bold">{t("disable2FA")}</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("totpCode")}</span>
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
                {twoFaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />} {tc('deactivate')}
              </button>
            </div>
          </div>
        ) : setup ? (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
              {t('scan')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="ad-card p-2" style={{ background: '#fff' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrDataUrl} alt={t('qrAlt')} width={180} height={180} />
              </div>
              <div className="space-y-2 min-w-0">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("secretKey")}</div>
                  <code className="text-sm font-mono break-all" style={{ color: 'var(--ad-accent)' }}>{setup.secret}</code>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t('enterCode')}</div>
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
                      {twoFaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {tc('activate')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button className="ad-btn ad-btn-ghost" onClick={() => setSetup(null)}>{tc('cancel')}</button>
          </div>
        ) : (
          <button className="ad-btn ad-btn-lime" disabled={twoFaBusy} onClick={startSetup}>
            {twoFaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} {t('enable2FA')}
          </button>
        )}
      </section>
    </div>
  );
}
