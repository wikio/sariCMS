'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Lock, LogIn, Shield } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import ServerCaptcha from '@/components/ServerCaptcha';
import { cmsFetch, CmsError } from '@/lib/cms';
import { clearAuthCache } from '@/components/admin/useAdminAuth';
import { loadAdminSettings } from '@/lib/admin-settings';

export default function AdminLoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.login');
  const [email, setEmail] = useState('admin@sarisysteme.com');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [security, setSecurity] = useState({ admin2fa: false, adminCaptcha: true, siteCaptcha: true });
  const [captchaOk, setCaptchaOk] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data?.user?.type === 'admin') {
          router.replace(`/${locale}/admin/dashboard`);
        }
      })
      .catch(() => {});
  }, [router, locale]);

  useEffect(() => {
    const s = loadAdminSettings();
    setSecurity(s.security);
  }, []);

  const accept = (result: unknown) => {
    const data = result as { user?: { type?: string }; requires2fa?: boolean; challengeToken?: string } | null;
    if (data?.requires2fa && data?.challengeToken) {
      setChallengeToken(data.challengeToken);
      return;
    }
    if (!data?.user) {
      setError(t('wrongPassword'));
      return;
    }
    if (data.user.type !== 'admin') {
      clearAuthCache();
      setError(t('notAdmin'));
      return;
    }
    clearAuthCache();
    router.push(`/${locale}/admin/dashboard`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Passer par la route Next : c'est elle qui pose les cookies httpOnly
      // (un appel direct au backend ne pose aucun cookie => /me répond 401 => retour login).
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(challengeToken
          ? { challengeToken, code: totpCode }
          : { email, password, ...(totpCode ? { totpCode } : {}) }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        setError((result as { error?: string } | null)?.error || t('wrongPassword'));
        return;
      }
      accept(result);
    } catch (err) {
      setError(err instanceof CmsError ? (err.status === 401 ? t('wrongPassword') : err.message) : t('apiUnreachable'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 ad-grid-bg opacity-80" />
      <div className="ad-card relative z-10 w-full max-w-md p-8 ad-rise overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ad-accent), var(--ad-accent-2), var(--ad-warn))' }} />
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)' }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>{t('subtitle')}</p>
          {security.admin2fa && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs ad-chip ad-chip-ok"><Lock className="w-3 h-3" /> Double authentification (2FA) requise</div>
          )}
        </div>
        {error && <div className="mb-4 text-sm ad-chip ad-chip-warn w-full justify-start py-2 px-3">{error}</div>}
        {blocked ? (
          <div className="text-center py-8"><Lock className="w-10 h-10 mx-auto mb-2" /><p>{t('accessBlocked')}</p></div>
        ) : loading ? (
          <PixelGridLoader compact label="Auth" />
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input className="ad-input" type="email" value={email || 'admin@sarisysteme.com'} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
            <input className="ad-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} disabled={!!challengeToken} />
            {(challengeToken || totpCode) && (
              <input className="ad-input text-center tracking-[0.4em]" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            )}
            {security.adminCaptcha && (
              <ServerCaptcha onChange={setCaptchaOk} locale={locale} endpoint="/api/admin/auth/captcha" />
            )}
            <button className="ad-btn ad-btn-primary w-full py-3" disabled={loading}>
              <LogIn className="w-4 h-4" /> {challengeToken ? t('verifyTotp') : t('submit')}
            </button>
          </form>
        )}
        <button onClick={() => router.push(`/${locale}`)} className="mt-6 text-sm flex items-center gap-1 mx-auto" style={{ color: 'var(--ad-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> {t('backToSite')}
        </button>
      </div>
    </div>
  );
}
