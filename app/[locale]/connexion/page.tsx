// app/[locale]/connexion/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { LogIn, Loader, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ImageCaptcha from '@/components/ImageCaptcha';
import { loadAdminSettings } from '@/lib/admin-settings';

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.login');
  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);

  const source = searchParams.get('source');

  useEffect(() => {
    try { setCaptchaEnabled(loadAdminSettings().security.siteCaptcha); } catch { /* */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (captchaEnabled && !captchaOk) {
      setError(t('captchaError', { defaultMessage: 'Veuillez saisir le code CAPTCHA correctement.' }));
      return;
    }

    setIsLoading(true);
    const success = await login(email, password, source === 'carriere' ? 'candidate' : 'client');
    setIsLoading(false);

    if (success) {
      const pendingAction = localStorage.getItem('sari_pending_action');
      if (pendingAction) {
        let action: { type: string; jobId?: string } | null = null;
        try { action = JSON.parse(pendingAction); } catch { action = null; }
        localStorage.removeItem('sari_pending_action');
        if (action?.type === 'apply' && action.jobId) {
          router.push(`/${locale}/jobs/${action.jobId}`);
          return;
        }
        if (action?.type === 'checkout') {
          router.push(`/${locale}/cart`);
          return;
        }
      }
      // Un administrateur qui se connecte par le formulaire public est
      // envoyé directement au back-office : le dashboard le rejetterait.
      // On relit localStorage (écrit par login()) plutôt que l'état `user`
      // du contexte, qui n'est pas encore rafraîchi dans cette closure.
      let signedInType: string | undefined = user?.type;
      try {
        const raw = localStorage.getItem('sari_user');
        if (raw) signedInType = (JSON.parse(raw) as { type?: string }).type;
      } catch { /* valeur du contexte conservée */ }
      const target = signedInType === 'admin' ? 'admin/dashboard' : 'dashboard';
      router.push(`/${locale}/${target}`);
    } else {
      setError(t('loginError', { defaultMessage: 'Email ou mot de passe incorrect' }));
    }
  };

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111] page-enter">
      <div className="container mx-auto px-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-sari-blue" />
              </div>
              <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-2">
                {t('title', { defaultMessage: 'Connexion' })}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {source === 'carriere'
                  ? 'Connectez-vous pour postuler'
                  : source === 'produit'
                  ? 'Connectez-vous pour commander'
                  : 'Accédez à votre espace personnel'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-4 mb-6 flex items-start gap-3 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                  {t('email', { defaultMessage: 'Email' })} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                  placeholder="votre@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                  {t('password', { defaultMessage: 'Mot de passe' })} <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                  placeholder="••••••••"
                />
              </div>

              {captchaEnabled && (
                <div className="bg-gray-100 dark:bg-[#111111] border-2 border-sari-blue p-4 rounded-lg">
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sari-blue" /> CAPTCHA <span className="text-red-500">*</span>
                  </label>
                  <ImageCaptcha onChange={setCaptchaOk} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="remember" className="w-4 h-4" />
                  <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400">
                    {t('remember', { defaultMessage: 'Se souvenir de moi' })}
                  </label>
                </div>
                <Link href={`/${locale}/mot-de-passe-oublie`} className="text-sm text-sari-blue hover:underline">
                  {t('forgotPassword', { defaultMessage: 'Mot de passe oublié ?' })}
                </Link>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary text-white py-3 font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg"
              >
                {isLoading ? (
                  <><Loader className="w-5 h-5 animate-spin" /> {t('loggingIn', { defaultMessage: 'Connexion en cours...' })}</>
                ) : (
                  <><LogIn className="w-5 h-5" /> {t('loginButton', { defaultMessage: 'Se connecter' })}</>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('noAccount', { defaultMessage: 'Pas encore de compte ?' })}
              </p>
              <Link
                href={`/${locale}/inscription${source ? `?source=${source}` : ''}`}
                className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2"
              >
                {source === 'carriere'
                  ? t('createCandidateAccount', { defaultMessage: 'Créer un compte candidat' })
                  : source === 'produit'
                  ? t('createClientAccount', { defaultMessage: 'Créer un compte client' })
                  : t('createAccount', { defaultMessage: 'Créer un compte' })}
              </Link>
            </div>

            <div className="mt-4 text-center text-xs text-gray-400">
              {t('demoHint', { defaultMessage: 'Démo : client@sari.dz / partner@sari.dz / candidate@sari.dz · mot de passe demo123' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
