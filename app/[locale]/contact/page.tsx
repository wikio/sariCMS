// app/[locale]/contact/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { 
  Phone, Mail, MapPin, Clock, CheckCircle, Lock, 
  RefreshCw, Send, Loader, Shield, Users
} from 'lucide-react';
import { getConfig, getMenu } from '@/lib/data';
import type { Config, Menu } from '@/types';
import SocialLinks from '@/components/shared/SocialLinks';

export default function ContactPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState({
    subject: 'devis',
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
    newsletter: false,
    acceptTerms: false
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // États CAPTCHA
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaExpected, setCaptchaExpected] = useState(0);
  const [captchaAttempts, setCaptchaAttempts] = useState(0);
  const [captchaBlocked, setCaptchaBlocked] = useState(false);

  const locale = useLocale();
  const t = useTranslations('pages.contact');

  useEffect(() => {
    const loadData = async () => {
      const [configData, menuData] = await Promise.all([
        getConfig(locale),
        getMenu(locale)
      ]);
      setConfig(configData);
      setMenu(menuData);
    };
    loadData();
  }, [locale]);

  // Génération du CAPTCHA mathématique
  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    let question, expected;
    
    if (operator === '+') {
      question = `${num1} + ${num2} = ?`;
      expected = num1 + num2;
    } else {
      const max = Math.max(num1, num2);
      const min = Math.min(num1, num2);
      question = `${max} - ${min} = ?`;
      expected = max - min;
    }
    
    setCaptchaQuestion(question);
    setCaptchaExpected(expected);
    setCaptchaAnswer('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (captchaBlocked) return;
    
    if (parseInt(captchaAnswer) !== captchaExpected) {
      setCaptchaAttempts(prev => prev + 1);
      if (captchaAttempts >= 4) {
        setCaptchaBlocked(true);
        setTimeout(() => {
          setCaptchaBlocked(false);
          setCaptchaAttempts(0);
          generateCaptcha();
        }, 300000); // 5 minutes
      } else {
        generateCaptcha();
      }
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      console.log('Message envoyé:', formData);
      setIsSubmitting(false);
      setSubmitted(true);
      setFormData({
        subject: 'devis',
        name: '',
        email: '',
        phone: '',
        company: '',
        message: '',
        newsletter: false,
        acceptTerms: false
      });
      setCaptchaAnswer('');
      setCaptchaAttempts(0);
      generateCaptcha();
      setTimeout(() => setSubmitted(false), 5000);
    }, 1500);
  };

  if (!config || !menu) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="pt-32 pb-24 min-h-screen page-enter">
      {/* Header parallaxe */}
      <div
        className="parallax-bg py-24 flex items-center justify-center text-center text-white relative"
        style={{backgroundImage: 'url(https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=1920)'}}
      >
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="relative z-10 container mx-auto px-6">
          <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-6">
            {t('heroTag')}
          </span>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            {t('heroTitle')}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        {/* Bandeau d'urgence */}
        <div className="bg-sari-blue/10 dark:bg-sari-blue/20 border-l-4 border-sari-blue p-6 mb-12 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <Phone className="w-8 h-8 text-sari-blue flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sari-dark dark:text-white text-lg mb-1">
                {t('emergencyTitle')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('emergencyDesc')} <strong>{config.meta?.phone || '+33 1 23 45 67 89'}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12 max-w-7xl mx-auto">
          {/* Colonne gauche : Coordonnées */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6">
                {t('contactInfo')}
              </h2>
              <div className="space-y-6">
                {/* Adresse */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-sari-blue/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-sari-blue" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sari-dark dark:text-white mb-1">
                      {t('address')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {config.meta?.address || '123 Avenue de la Santé'}<br/>
                      69000 Lyon, France
                    </p>
                  </div>
                </div>

                {/* Téléphone */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-sari-blue/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-sari-blue" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sari-dark dark:text-white mb-1">
                      {t('phone')}
                    </h3>
                    <a href={`tel:${config.meta?.phone || '+33123456789'}`} className="text-sari-blue hover:underline text-sm block">
                      {config.meta?.phone || '+33 1 23 45 67 89'}
                    </a>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      Lun-Ven: 8h00 - 18h00
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-sari-blue/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-sari-blue" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sari-dark dark:text-white mb-1">
                      {t('email')}
                    </h3>
                    <a href={`mailto:${config.meta?.email || 'contact@sarisysteme.com'}`} className="text-sari-blue hover:underline text-sm block">
                      {config.meta?.email || 'contact@sarisysteme.com'}
                    </a>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      {t('responseTime')}
                    </p>
                  </div>
                </div>

                {/* Horaires */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-sari-blue/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-sari-blue" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sari-dark dark:text-white mb-1">
                      {t('hours')}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>{t('weekdays')}</span>
                        <span className="font-semibold">8h00 - 18h00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('saturday')}</span>
                        <span className="font-semibold">9h00 - 12h00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('sunday')}</span>
                        <span className="font-semibold text-red-500">{t('closed')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Réseaux sociaux */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                <h3 className="font-bold text-sari-dark dark:text-white mb-4">
                  {t('followUs')}
                </h3>
                <SocialLinks 
                  links={menu.socialLinks || {
                    linkedin: 'https://linkedin.com/company/sari-systeme',
                    facebook: 'https://facebook.com/sarisysteme',
                    twitter: 'https://twitter.com/sarisysteme',
                    youtube: 'https://youtube.com/sarisysteme'
                  }}
                  variant="light"
                  size="medium"
                  align="left"
                />
              </div>
            </div>

            {/* Carte Google Maps */}
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2783.1234567890123!2d4.835659315678901!3d45.764042978901234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDXCsDQ1JzUwLjYiTiA0wrA1MCcwOC40IkU!5e0!3m2!1sfr!2sfr!4v1234567890123!5m2!1sfr!2sfr"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={t('mapTitle')}
                className="w-full"
              ></iframe>
            </div>
          </div>

          {/* Colonne droite : Formulaire */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl">
              <div className="mb-8">
                <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">
                  {t('formTag')}
                </span>
                <h2 className="text-3xl font-bold text-sari-dark dark:text-white mt-2">
                  {t('formTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-4">
                  {t('formDesc')}
                </p>
              </div>

              {/* Message de succès */}
              {submitted && (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 p-6 mb-8 flex items-start gap-4 animate-fade-in-up">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">
                      {t('successTitle')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {t('successDesc')}
                    </p>
                  </div>
                </div>
              )}

              {/* Message de blocage CAPTCHA */}
              {captchaBlocked && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 p-6 mb-8 flex items-start gap-4 animate-fade-in-up">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-700 dark:text-red-400 text-lg">
                      {t('captchaBlocked')}
                    </h3>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sélection du sujet */}
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3">
                    {t('subjectLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { value: 'devis', label: t('subjectQuote'), icon: 'file-text' },
                      { value: 'technique', label: t('subjectTechnical'), icon: 'wrench' },
                      { value: 'commercial', label: t('subjectCommercial'), icon: 'shopping-cart' },
                      { value: 'rh', label: t('subjectHR'), icon: 'users' },
                      { value: 'partenaire', label: t('subjectPartner'), icon: 'handshake' },
                      { value: 'client', label: t('subjectClient'), icon: 'user' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({...formData, subject: option.value})}
                        className={`p-4 border-2 text-left transition-all ${
                          formData.subject === option.value
                            ? 'border-sari-blue bg-sari-blue/5 text-sari-blue'
                            : 'border-gray-200 dark:border-gray-700 hover:border-sari-blue/50'
                        }`}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nom et Email */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('fullName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none"
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none"
                      placeholder="jean@entreprise.com"
                    />
                  </div>
                </div>

                {/* Téléphone et Entreprise */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('phone')}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none"
                      placeholder="+33 1 23 45 67 89"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('company')}
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none"
                      placeholder={t('companyPlaceholder')}
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                    {t('message')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none resize-none"
                    placeholder={t('messagePlaceholder')}
                  ></textarea>
                </div>

                {/* Newsletter */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="newsletter"
                    checked={formData.newsletter}
                    onChange={(e) => setFormData({...formData, newsletter: e.target.checked})}
                    className="w-5 h-5 mt-1 text-sari-blue border-gray-300"
                  />
                  <label htmlFor="newsletter" className="text-sm text-gray-600 dark:text-gray-400">
                    {t('newsletter')}
                  </label>
                </div>

                {/* Acceptation des conditions */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="acceptTerms"
                    required
                    checked={formData.acceptTerms}
                    onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})}
                    className="w-5 h-5 mt-1 text-sari-blue border-gray-300"
                  />
                  <label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-gray-400">
                    {t('acceptTerms')}{' '}
                    <Link href={`/${locale}/confidentialite`} className="text-sari-blue hover:underline">
                      {t('privacyPolicy')}
                    </Link>{' '}
                    <span className="text-red-500">*</span>
                  </label>
                </div>

                {/* CAPTCHA ANTI-ROBOT */}
                <div className="bg-gray-100 dark:bg-[#111111] border-2 border-sari-blue p-6">
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sari-blue" />
                    {t('captchaLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 px-4 py-3 text-center">
                      <span className="text-xl font-bold text-sari-dark dark:text-white font-mono">
                        {captchaQuestion}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="?"
                      disabled={captchaBlocked}
                      className="w-24 px-4 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none transition-colors text-center font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateCaptcha}
                      disabled={captchaBlocked}
                      className="p-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('newCaptcha')}
                    >
                      <RefreshCw className="w-5 h-5 text-sari-dark dark:text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('captchaHelp')}
                  </p>
                </div>

                {/* Bouton submit */}
                <button
                  type="submit"
                  disabled={isSubmitting || captchaBlocked}
                  className="w-full btn-primary text-white py-4 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      {t('sending')}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {t('sendMessage')}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Informations supplémentaires */}
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 text-center">
                <div className="w-16 h-16 bg-sari-blue/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-sari-blue" />
                </div>
                <h3 className="font-bold text-sari-dark dark:text-white mb-2">
                  {t('fastResponse')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('fastResponseDesc')}
                </p>
              </div>
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 text-center">
                <div className="w-16 h-16 bg-sari-blue/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-sari-blue" />
                </div>
                <h3 className="font-bold text-sari-dark dark:text-white mb-2">
                  {t('dataProtected')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dataProtectedDesc')}
                </p>
              </div>
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 text-center">
                <div className="w-16 h-16 bg-sari-blue/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-sari-blue" />
                </div>
                <h3 className="font-bold text-sari-dark dark:text-white mb-2">
                  {t('expertTeam')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('expertTeamDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}