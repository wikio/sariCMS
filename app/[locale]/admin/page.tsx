'use client';

import { useEffect, useState } from 'react';
import { useAdminBrand } from '@/components/admin/BrandContext';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Lock, LogIn, Shield } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import ServerCaptcha from '@/components/ServerCaptcha';
import { adminCaptchaRequired } from '@/lib/admin-login-policy';
import { clearAuthCache, setAuthCache, type AdminUser } from '@/components/admin/useAdminAuth';

let loginMeCheckInFlight: Promise<{ authenticated?: boolean; user?: (AdminUser & { type?: string }) | null } | null> | null = null;

function checkExistingAdminSession(): Promise<{ authenticated?: boolean; user?: (AdminUser & { type?: string }) | null } | null> {
  if (!loginMeCheckInFlight) {
    // `?optional=1` interroge la session silencieusement (200 `{ authenticated: false }`
    // hors connexion) afin d'éviter une erreur 401 superflue dans la console navigateur
    // à chaque ouverture de la page de connexion admin.
    loginMeCheckInFlight = fetch('/api/admin/auth/me?optional=1', { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (session) => {
        if (!session?.canRefresh) return session;
        // Une arrivée directe après expiration de l'access cookie peut encore
        // reprendre la session : seul Nest peut échanger le refresh httpOnly.
        const res = await fetch('/api/admin/auth/refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
        return res.ok ? res.json() : null;
      })
      .catch(() => null)
      .finally(() => {
        // Laisse un court répit pour dédupliquer le double-montage React StrictMode
        setTimeout(() => {
          loginMeCheckInFlight = null;
        }, 500);
      });
  }
  return loginMeCheckInFlight;
}

export default function AdminLoginPage() {
  const { brand } = useAdminBrand();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = useState(true);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaData, setCaptchaData] = useState<{ id: string; value: string } | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    checkExistingAdminSession().then((data) => {
      if (cancelled) return;
      if (data?.authenticated !== false && data?.user?.type === 'admin') {
        setAuthCache(data.user);
        router.replace(`/${locale}/admin/dashboard`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, locale]);

  useEffect(() => {
    let active = true;
    void adminCaptchaRequired().then(required => { if (active) setRequiresCaptcha(required); });
    return () => { active = false; };
  }, []);

  /**
   * Traite la réponse de connexion.
   *
   * @returns true seulement si la connexion aboutit et que la navigation vers le
   * tableau de bord est lancée — l'appelant garde alors l'indicateur de
   * chargement allumé jusqu'à ce que l'écran d'accueil prenne la place.
   */
  const accept = (result: unknown): boolean => {
    const data = result as { user?: AdminUser & { type?: string }; requires2fa?: boolean; challengeToken?: string } | null;
    if (data?.requires2fa && data?.challengeToken) {
      setChallengeToken(data.challengeToken);
      return false;
    }
    if (!data?.user) {
      setError(t('wrongPassword'));
      return false;
    }
    if (data.user.type !== 'admin') {
      clearAuthCache();
      setError(t('notAdmin'));
      return false;
    }
    // On connaît déjà l'administrateur : inutile de laisser le tableau de bord
    // refaire un aller-retour /me (puis un refresh) avant d'afficher l'écran.
    setAuthCache(data.user);
    router.push(`/${locale}/admin/dashboard`);
    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (requiresCaptcha && !challengeToken && !captchaOk) {
      setError(t('captchaError'));
      return;
    }
    setLoading(true);
    try {
      // Inclure le captcha dans le payload pour vérification atomique côté serveur
      const captchaPayload = requiresCaptcha && captchaData?.id && captchaData?.value
        ? { captchaId: captchaData.id, captchaAnswer: captchaData.value }
        : {};
      // Passer par la route Next : c'est elle qui pose les cookies httpOnly
      // (un appel direct au backend ne pose aucun cookie => /me répond 401 => retour login).
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(challengeToken
          ? { challengeToken, code: totpCode }
          : { email, password, ...(totpCode ? { totpCode } : {}), ...captchaPayload }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        const errCode = (result as { code?: string } | null)?.code;
        const errMsg = (result as { error?: string } | null)?.error || t('wrongPassword');
        if (errCode === 'CAPTCHA_REQUIRED') setRequiresCaptcha(true);
        if (errCode === 'CAPTCHA_INVALID' || errCode === 'CAPTCHA_REQUIRED' || (requiresCaptcha && captchaData?.id)) {
          // Le captcha a pu être consommé (ou expiré) : on en émet un nouveau
          setCaptchaOk(false);
          setCaptchaData(null);
          setCaptchaKey((k) => k + 1);
        }
        setError(errMsg);
        setLoading(false);
        return;
      }
      /*
       * Succès : on NE remet pas `loading` à false. Sans ça, le formulaire de
       * connexion réapparaissait une fraction de seconde pendant que le tableau
       * de bord se chargeait. Le chargeur reste affiché, et comme aucune page
       * `loading.tsx` n'existe sous /admin, Next laisse cet écran en place
       * jusqu'à ce que la route d'accueil soit prête à s'afficher.
       */
      if (!accept(result)) setLoading(false);
    } catch {
      setError(t('apiUnreachable'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 ad-grid-bg opacity-80" />
      <div className="ad-card relative z-10 w-full max-w-md p-8 ad-rise overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ad-accent), var(--ad-accent-2), var(--ad-warn))' }} />
        <div className="text-center mb-8">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt={brand.title} className="mx-auto mb-4 w-16 h-16 object-contain" />
          ) : (
            <div className="mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)' }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
          )}
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold mb-1" style={{ color: 'var(--ad-muted)' }}>
            {brand.title}
          </div>
          <h1 className="text-2xl font-black">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>{t('subtitle')}</p>
          {challengeToken && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs ad-chip ad-chip-ok"><Lock className="w-3 h-3" /> {t('verifyTotp')}</div>
          )}
        </div>
        {error && <div className="mb-4 text-sm ad-chip ad-chip-warn w-full justify-start py-2 px-3">{error}</div>}
        {loading ? (
          <PixelGridLoader compact label="Auth" />
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input className="ad-input" type="email" autoComplete="username" required disabled={!!challengeToken} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
            <input className="ad-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} disabled={!!challengeToken} />
            {challengeToken && (
              <input className="ad-input text-center tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            )}
            {requiresCaptcha && !challengeToken && (
              <ServerCaptcha
                key={captchaKey}
                onChange={setCaptchaOk}
                onCaptchaData={setCaptchaData}
                autoVerify={false}
                locale={locale}
                endpoint="/api/admin/auth/captcha"
              />
            )}
            <button
              className="ad-btn ad-btn-primary w-full py-3"
              disabled={loading || (requiresCaptcha && !captchaOk && !challengeToken)}
            >
              <LogIn className="w-4 h-4" /> {challengeToken ? t('verifyTotp') : t('submit')}
            </button>
            {requiresCaptcha && !captchaOk && !challengeToken && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">{t('captchaError')}</p>
            )}
          </form>
        )}
        <button onClick={() => router.push(`/${locale}`)} className="mt-6 text-sm flex items-center gap-1 mx-auto" style={{ color: 'var(--ad-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> {t('backToSite')}
        </button>
      </div>
    </div>
  );
}
