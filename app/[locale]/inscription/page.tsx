// app/[locale]/inscription/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  UserPlus, UserCheck, ShoppingBag, Handshake, ShieldCheck,
  QrCode, Keyboard, Camera, AlertCircle, Loader, RefreshCw,
  ArrowRight, CheckCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ImageCaptcha from '@/components/ImageCaptcha';
import { loadAdminSettings } from '@/lib/admin-settings';

export default function RegisterPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.register');
  const { register } = useAuth();

  const source = searchParams.get('source');

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    type: '', phone: '', company: '', acceptTerms: false
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaExpected, setCaptchaExpected] = useState(0);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [siteCaptcha, setSiteCaptcha] = useState(true);
  const [partnerCode, setPartnerCode] = useState('');
  const [secretKey, setSecretKey] = useState('');

  useEffect(() => {
    if (source === 'carriere') {
      setFormData((prev) => ({ ...prev, type: 'candidate' }));
      setStep(2);
    } else if (source === 'produit') {
      setFormData((prev) => ({ ...prev, type: 'client' }));
      setStep(2);
    }
    generateCaptcha();
    try { setSiteCaptcha(loadAdminSettings().security.siteCaptcha); } catch { /* */ }
  }, [source]);

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setCaptchaQuestion(`${num1} + ${num2} = ?`);
    setCaptchaExpected(num1 + num2);
    setCaptchaAnswer('');
  };

  const handleTypeSelection = (type: string) => {
    setFormData((prev) => ({ ...prev, type }));
    setStep(2);
  };

  const handleQRValidation = () => {
    if (partnerCode && secretKey) {
      setStep(3);
    } else {
      setError(t('qrRequired'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    if (siteCaptcha) {
      if (!captchaOk) { setError(t('captchaError')); return; }
    } else if (parseInt(captchaAnswer) !== captchaExpected) {
      setError(t('captchaError'));
      generateCaptcha();
      return;
    }
    if (!formData.acceptTerms) {
      setError(t('acceptTermsRequired'));
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      register(formData.email, formData.password, formData.type).then(() => {
        setIsLoading(false);
        router.push(`/${locale}/dashboard`);
      });
    }, 1000);
  };

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111] page-enter">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Sidebar Progression */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6">
                  {t('steps')}
                </h2>
                <div className="space-y-4">
                  {[
                    { num: 1, label: t('step1') },
                    { num: 2, label: t('step2') },
                    { num: 3, label: t('step3') }
                  ].map((s) => (
                    <div
                      key={s.num}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        step >= s.num ? 'bg-sari-blue text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        step >= s.num ? 'bg-white text-sari-blue' : 'bg-gray-300 dark:bg-gray-700'
                      }`}>
                        {s.num}
                      </div>
                      <span className="font-semibold text-sm">{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('alreadyHaveAccount')}
                  </p>
                  <Link
                    href={`/${locale}/connexion${source ? `?source=${source}` : ''}`}
                    className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2"
                  >
                    {t('login')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Contenu principal */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                {/* STEP 1 */}
                {step === 1 && (
                  <>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-8 h-8 text-sari-blue" />
                      </div>
                      <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-2">
                        {t('chooseType')}
                      </h1>
                      <p className="text-gray-600 dark:text-gray-400">{t('chooseTypeDesc')}</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <button onClick={() => handleTypeSelection('candidate')}
                        className="p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-xl text-left group">
                        <div className="w-12 h-12 bg-sari-blue/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-sari-blue transition-colors">
                          <UserCheck className="w-6 h-6 text-sari-blue group-hover:text-white" />
                        </div>
                        <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('candidate')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('candidateDesc')}</p>
                      </button>
                      <button onClick={() => handleTypeSelection('client')}
                        className="p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-xl text-left group">
                        <div className="w-12 h-12 bg-sari-lime/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-sari-lime transition-colors">
                          <ShoppingBag className="w-6 h-6 text-sari-lime group-hover:text-white" />
                        </div>
                        <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('client')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('clientDesc')}</p>
                      </button>
                      <button onClick={() => handleTypeSelection('partner')}
                        className="p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-xl text-left group">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                          <Handshake className="w-6 h-6 text-purple-500 group-hover:text-white" />
                        </div>
                        <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('partner')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('partnerDesc')}</p>
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-8 h-8 text-sari-blue" />
                      </div>
                      <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-2">{t('verification')}</h1>
                      <p className="text-gray-600 dark:text-gray-400">{t('verificationDesc')}</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                      <div className="p-6 border-2 border-sari-blue bg-sari-blue/5 rounded-xl">
                        <div className="flex items-center gap-3 mb-4">
                          <QrCode className="w-8 h-8 text-sari-blue" />
                          <h3 className="font-bold text-sari-dark dark:text-white">{t('scanQR')}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('scanQRDesc')}</p>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 text-center hover:border-sari-blue transition-colors rounded-lg mb-4">
                          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">{t('clickToScan')}</p>
                        </div>
                        <button onClick={() => setStep(3)} className="w-full btn-primary text-white py-2 font-semibold rounded-lg">
                          {t('validateQR')}
                        </button>
                      </div>
                      <div className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl">
                        <div className="flex items-center gap-3 mb-4">
                          <Keyboard className="w-8 h-8 text-sari-blue" />
                          <h3 className="font-bold text-sari-dark dark:text-white">{t('manualEntry')}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('manualEntryDesc')}</p>
                        <div className="space-y-3 mb-4">
                          <input type="text" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)}
                            placeholder={t('partnerCode')}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                          <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
                            placeholder={t('secretKey')}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                        </div>
                        <button onClick={handleQRValidation} className="w-full btn-primary text-white py-2 font-semibold rounded-lg">
                          {t('validate')}
                        </button>
                      </div>
                    </div>
                    <div className="text-center">
                      <button onClick={() => setStep(3)} className="text-sari-blue font-semibold hover:underline">
                        {t('skipVerification')}
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                  <>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-8 h-8 text-sari-blue" />
                      </div>
                      <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-2">{t('createAccount')}</h1>
                      <p className="text-gray-600 dark:text-gray-400">{t('createAccountDesc')}</p>
                    </div>
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-4 mb-6 flex items-start gap-3 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                      </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="bg-sari-blue/5 border border-sari-blue/20 p-4 rounded-lg flex items-center gap-3">
                        {formData.type === 'candidate' ? <UserCheck className="w-6 h-6 text-sari-blue" /> :
                         formData.type === 'partner' ? <Handshake className="w-6 h-6 text-sari-blue" /> :
                         <ShoppingBag className="w-6 h-6 text-sari-blue" />}
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{t('accountType')}</div>
                          <div className="font-bold text-sari-dark dark:text-white capitalize">{formData.type}</div>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                            {t('fullName')} <span className="text-red-500">*</span>
                          </label>
                          <input type="text" required value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                            placeholder="Jean Dupont" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                            {t('email')} <span className="text-red-500">*</span>
                          </label>
                          <input type="email" required value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                            placeholder="votre@email.com" />
                        </div>
                      </div>
                      {formData.type === 'client' && (
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('company')}</label>
                          <input type="text" value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                            placeholder="Nom de l'entreprise" />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('phone')}</label>
                        <input type="tel" value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                          placeholder="+213 21 23 45 67" />
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                            {t('password')} <span className="text-red-500">*</span>
                          </label>
                          <input type="password" required value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                            placeholder="••••••••" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                            {t('confirmPassword')} <span className="text-red-500">*</span>
                          </label>
                          <input type="password" required value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
                            placeholder="••••••••" />
                        </div>
                      </div>
                      <div className="bg-gray-100 dark:bg-[#111111] border-2 border-sari-blue p-6 rounded-lg">
                        <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-sari-blue" />
                          {t('captchaLabel')} <span className="text-red-500">*</span>
                        </label>
                        {siteCaptcha ? (
                          <ImageCaptcha onChange={setCaptchaOk} />
                        ) : (
                          <div className="flex items-center gap-4">
                            <div className="flex-1 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 px-4 py-3 text-center rounded-lg">
                              <span className="text-xl font-bold text-sari-dark dark:text-white font-mono">{captchaQuestion}</span>
                            </div>
                            <input type="number" value={captchaAnswer}
                              onChange={(e) => setCaptchaAnswer(e.target.value)}
                              placeholder="?"
                              className="w-24 px-4 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none text-center font-bold text-lg rounded-lg"
                              required />
                            <button type="button" onClick={generateCaptcha}
                              className="p-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors rounded-lg">
                              <RefreshCw className="w-5 h-5 text-sari-dark dark:text-white" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" id="acceptTerms" required
                          checked={formData.acceptTerms}
                          onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                          className="w-4 h-4 mt-1" />
                        <label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-gray-400">
                          {t('acceptTerms')} <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <button type="submit" disabled={isLoading}
                        className="w-full btn-primary text-white py-3 font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg">
                        {isLoading ? (
                          <><Loader className="w-5 h-5 animate-spin" /> {t('creating')}</>
                        ) : (
                          <><UserPlus className="w-5 h-5" /> {t('createAccountButton')}</>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}