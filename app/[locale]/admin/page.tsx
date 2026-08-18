// app/[locale]/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Shield, LogIn, ArrowLeft, AlertCircle, Lock } from 'lucide-react';
import AdminLanguageSwitcher from '@/components/admin/AdminLanguageSwitcher';

export default function AdminLoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.login');

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const ADMIN_PASSWORD = 'SARI@admin2024!';
  const MAX_ATTEMPTS = 3;
  const BLOCK_DURATION = 15 * 60 * 1000;

  useEffect(() => {
    const auth = localStorage.getItem('sari_admin_auth');
    const authTime = localStorage.getItem('sari_admin_time');

    if (auth === 'true' && authTime) {
      const elapsed = Date.now() - parseInt(authTime);
      if (elapsed < 2 * 60 * 60 * 1000) {
        router.replace(`/${locale}/admin/dashboard`);
        return;
      }
    }

    const blockTime = localStorage.getItem('sari_admin_blocked');
    if (blockTime) {
      const elapsed = Date.now() - parseInt(blockTime);
      if (elapsed < BLOCK_DURATION) {
        setBlocked(true);
        setTimeout(() => {
          localStorage.removeItem('sari_admin_blocked');
          setBlocked(false);
          setAttempts(0);
        }, BLOCK_DURATION - elapsed);
      }
    }
  }, [router, locale]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (blocked) {
      setError(t('tooManyAttempts'));
      return;
    }

    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('sari_admin_auth', 'true');
      localStorage.setItem('sari_admin_time', Date.now().toString());
      localStorage.removeItem('sari_admin_blocked');
      localStorage.removeItem('sari_admin_attempts');
      router.push(`/${locale}/admin/dashboard`);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('sari_admin_attempts', newAttempts.toString());

      if (newAttempts >= MAX_ATTEMPTS) {
        localStorage.setItem('sari_admin_blocked', Date.now().toString());
        setBlocked(true);
        setError(t('tooManyAttempts'));
      } else {
        setError(`${t('wrongPassword')} ${MAX_ATTEMPTS - newAttempts} ${t('attemptsLeft')}`);
      }
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 grid-pattern-bg opacity-5"></div>

      {/* Sélecteur de langue en haut à droite */}
      <div className="absolute top-6 right-6 z-10">
        <AdminLanguageSwitcher />
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-gray-200 dark:border-gray-800">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-sari-blue to-sari-dark rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-sari-dark dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-3 rounded-lg mb-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {blocked ? (
          <div className="text-center py-8">
            <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('accessBlocked')}
            </p>
            <p className="text-sm text-gray-500">
              {t('tryLater')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                {t('passwordLabel')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg focus:border-sari-blue outline-none"
                autoFocus
                disabled={blocked}
              />
            </div>
            <button
              type="submit"
              disabled={blocked || !password}
              className="w-full btn-primary text-white py-3 font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn className="w-5 h-5" />
              {t('submit')}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <button
            onClick={() => router.push(`/${locale}`)}
            className="text-sm text-gray-500 hover:text-sari-blue inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToSite')}
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            🔒 {t('phase1')}
          </p>
        </div>
      </div>
    </div>
  );
}