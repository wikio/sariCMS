// app/[locale]/mot-de-passe-oublie/page.tsx
'use client';

/**
 * Mot de passe oublié — les deux moitiés du flux sur une seule page.
 *
 * Sans `?token=` : le visiteur donne son adresse et reçoit un lien.
 * Avec `?token=` : il choisit un nouveau mot de passe.
 *
 * Le jeton arrive par l'URL parce que c'est ce que contient l'email. Il n'est
 * jamais affiché ni renvoyé ailleurs qu'à `/api/reset-password`, et il ne sert
 * qu'une fois côté backend.
 *
 * `useSearchParams` exige une balise Suspense au prerender : le contenu est donc
 * dans `ForgotPasswordForm`, et le composant exporté n'est que la frontière.
 */
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader, Lock, ShieldCheck } from 'lucide-react';
import ServerCaptcha from '@/components/ServerCaptcha';
import { loadAdminSettings } from '@/lib/admin-settings';

function ForgotPasswordForm() {
  const locale = useLocale();
  const t = useTranslations('pages.forgotPassword');
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [captcha, setCaptcha] = useState<{ id: string; value: string }>({ id: '', value: '' });

  useEffect(() => {
    try {
      setCaptchaEnabled(loadAdminSettings().security.siteCaptcha);
    } catch {
      /* réglage illisible : le captcha reste actif, c'est le côté prudent */
    }
  }, []);

  const askForLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (captchaEnabled && captcha.value.trim().length < 5) {
      setError(t('captchaError', { defaultMessage: 'Veuillez saisir le code de vérification.' }));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          locale,
          captchaId: captcha.id,
          captchaAnswer: captcha.value,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) {
        setError(json?.error || t('sendError', { defaultMessage: 'Envoi impossible. Réessayez.' }));
        setCaptcha({ id: '', value: '' });
        setCaptchaOk(false);
        return;
      }
      // Message volontairement vague : il ne doit pas révéler si l'adresse
      // correspond à un compte. C'est le serveur qui décide du contenu.
      setNotice(
        json?.message ||
          t('sent', {
            defaultMessage: 'Si un compte existe pour cette adresse, un lien vient de lui être envoyé.',
          }),
      );
      setEmail('');
    } catch {
      setError(t('sendError', { defaultMessage: 'Envoi impossible. Réessayez.' }));
    } finally {
      setBusy(false);
    }
  };

  const choosePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError(
        t('weakPassword', {
          defaultMessage:
            'Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.',
        }),
      );
      return;
    }
    if (password !== confirm) {
      setError(t('mismatch', { defaultMessage: 'Les deux mots de passe ne correspondent pas.' }));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error || t('resetError', { defaultMessage: 'Réinitialisation impossible.' }));
        return;
      }
      setNotice(
        t('resetDone', {
          defaultMessage: 'Mot de passe modifié. Vous pouvez vous connecter.',
        }),
      );
      setPassword('');
      setConfirm('');
    } catch {
      setError(t('resetError', { defaultMessage: 'Réinitialisation impossible.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111] page-enter">
      <div className="container mx-auto px-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                {token ? (
                  <Lock className="w-8 h-8 text-sari-blue" />
                ) : (
                  <KeyRound className="w-8 h-8 text-sari-blue" />
                )}
              </div>
              <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-2">
                {token
                  ? t('resetTitle', { defaultMessage: 'Nouveau mot de passe' })
                  : t('title', { defaultMessage: 'Mot de passe oublié' })}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {token
                  ? t('resetIntro', { defaultMessage: 'Choisissez un mot de passe pour votre compte.' })
                  : t('intro', {
                      defaultMessage: 'Indiquez votre adresse : nous vous enverrons un lien de réinitialisation.',
                    })}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-4 mb-6 flex items-start gap-3 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
            {notice && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 p-4 mb-6 flex items-start gap-3 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>
              </div>
            )}

            {token ? (
              <form onSubmit={choosePassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                    {t('newPassword', { defaultMessage: 'Nouveau mot de passe' })}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                    placeholder="••••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                    {t('confirmPassword', { defaultMessage: 'Confirmer le mot de passe' })}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                    placeholder="••••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('passwordRule', {
                    defaultMessage: 'Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.',
                  })}
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full btn-primary text-white py-3 font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg"
                >
                  {busy ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />{' '}
                      {t('saving', { defaultMessage: 'Enregistrement…' })}
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />{' '}
                      {t('saveButton', { defaultMessage: 'Enregistrer le mot de passe' })}
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={askForLink} className="space-y-6">
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
                    autoComplete="email"
                  />
                </div>

                {captchaEnabled && (
                  <div className="bg-gray-100 dark:bg-[#111111] border-2 border-sari-blue p-4 rounded-lg">
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-sari-blue" /> CAPTCHA{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <ServerCaptcha
                      onChange={setCaptchaOk}
                      onCaptchaData={setCaptcha}
                      autoVerify={false}
                      locale={locale}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || (captchaEnabled && !captchaOk)}
                  className="w-full btn-primary text-white py-3 font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg"
                >
                  {busy ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />{' '}
                      {t('sending', { defaultMessage: 'Envoi en cours…' })}
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-5 h-5" /> {t('sendButton', { defaultMessage: 'Envoyer le lien' })}
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
              <Link
                href={`/${locale}/connexion`}
                className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2"
              >
                {t('backToLogin', { defaultMessage: 'Retour à la connexion' })}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
