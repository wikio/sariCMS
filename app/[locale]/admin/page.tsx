'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Lock, LogIn, Shield } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { cmsFetch, CmsError } from '@/lib/cms';
import { hasAdminSession, persistAdminSession } from '@/lib/admin-session';

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

  useEffect(() => {
    if (hasAdminSession()) router.replace(`/${locale}/admin/dashboard`);
  }, [router, locale]);

  const accept = (result: { accessToken?: string; refreshToken?: string; user?: never; requires2fa?: boolean; challengeToken?: string }) => {
    if (result.requires2fa && result.challengeToken) {
      setChallengeToken(result.challengeToken);
      return;
    }
    if (!result.accessToken || !result.user) {
      setError(t('wrongPassword'));
      return;
    }
    persistAdminSession(result as never);
    router.push(`/${locale}/admin/dashboard`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = challengeToken ? '/auth/2fa/challenge' : '/auth/login';
      const json = challengeToken
        ? { challengeToken, code: totpCode }
        : { email, password, ...(totpCode ? { totpCode } : {}) };
      accept(await cmsFetch(path, { method: 'POST', json, timeoutMs: 8000 }));
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
        </div>
        {error && <div className="mb-4 text-sm ad-chip ad-chip-warn w-full justify-start py-2 px-3">{error}</div>}
        {blocked ? (
          <div className="text-center py-8"><Lock className="w-10 h-10 mx-auto mb-2" /><p>{t('accessBlocked')}</p></div>
        ) : loading ? (
          <PixelGridLoader compact label="Auth" />
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input className="ad-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
            <input className="ad-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} disabled={!!challengeToken} />
            {(challengeToken || totpCode) && (
              <input className="ad-input text-center tracking-[0.4em]" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            )}
            <button className="ad-btn ad-btn-primary w-full py-3" disabled={!email || (!challengeToken && !password)}>
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
