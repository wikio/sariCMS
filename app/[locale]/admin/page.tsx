'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Lock, LogIn, Shield } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import ServerCaptcha from '@/components/ServerCaptcha';
import { cmsFetch, CmsError } from '@/lib/cms';
import { clearAuthCache, setAuthCache, type AdminUser } from '@/components/admin/useAdminAuth';
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
  const [captchaData, setCaptchaData] = useState<{ id: string; value: string } | null>(null);

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
    // Audit C1 : captcha serveur obligatoire quand adminCaptcha activé.
    // On bloque côté client pour UX, la vraie vérification est côté serveur
    // dans /api/admin/auth/login (verifyAdminCaptcha). Sans captcha, un appel
    // direct à l'API resterait possible, mais le serveur refusera si captchaId présent et invalide.
    // Pour ne pas bloquer l'accès si le captcha ne charge pas (réseau), on autorise
    // le submit sans captcha en mode dégradé, mais on l'envoie quand il est disponible.
    if (security.adminCaptcha && !captchaOk && !challengeToken) {
      // Si le captcha est affiché mais pas rempli, on l'exige (5 caractères)
      const currentValue = captchaData?.value || '';
      if (currentValue.length !== 5) {
        setError(t('captchaError') || 'Veuillez saisir le code captcha (5 caractères)');
        return;
      }
    }
    setLoading(true);
    try {
      // Inclure le captcha dans le payload pour vérification atomique côté serveur
      const captchaPayload = security.adminCaptcha && captchaData?.id && captchaData?.value
        ? { captchaId: captchaData.id, captchaAnswer: captchaData.value }
        : {};
      // Passer par la route Next : c'est elle qui pose les cookies httpOnly
      // (un appel direct au backend ne pose aucun cookie => /me répond 401 => retour login).
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(challengeToken
          ? { challengeToken, code: totpCode, ...captchaPayload }
          : { email, password, ...(totpCode ? { totpCode } : {}), ...captchaPayload }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        const errCode = (result as { code?: string } | null)?.code;
        const errMsg = (result as { error?: string } | null)?.error || t('wrongPassword');
        if (errCode === 'CAPTCHA_INVALID' || errCode === 'CAPTCHA_REQUIRED') {
          // Le captcha a été consommé (même si incorrect), il faut le régénérer
          setCaptchaOk(false);
          setCaptchaData(null);
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
    } catch (err) {
      setError(err instanceof CmsError ? (err.status === 401 ? t('wrongPassword') : err.message) : t('apiUnreachable'));
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
              <ServerCaptcha
                onChange={setCaptchaOk}
                onCaptchaData={setCaptchaData}
                autoVerify={false}
                locale={locale}
                endpoint="/api/admin/auth/captcha"
              />
            )}
            <button
              className="ad-btn ad-btn-primary w-full py-3"
              disabled={loading || (security.adminCaptcha && !captchaOk && !challengeToken)}
            >
              <LogIn className="w-4 h-4" /> {challengeToken ? t('verifyTotp') : t('submit')}
            </button>
            {security.adminCaptcha && !captchaOk && !challengeToken && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">Saisissez le code à 5 caractères ci-dessus</p>
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
