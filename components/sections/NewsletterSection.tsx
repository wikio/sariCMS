// components/sections/NewsletterSection.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Send, CheckCircle, Newspaper, Gift, Shield } from 'lucide-react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const t = useTranslations('components.sections.NewsletterSection');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  const features = [
    { 
      icon: Newspaper, 
      title: t('feature1Title'), 
      desc: t('feature1Desc') 
    },
    { 
      icon: Gift, 
      title: t('feature2Title'), 
      desc: t('feature2Desc') 
    },
    { 
      icon: Shield, 
      title: t('feature3Title'), 
      desc: t('feature3Desc') 
    }
  ];

  return (
    <section className="py-24 bg-sari-blue relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icône */}
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-white" />
          </div>
          
          {/* Titre */}
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {t('title')}
          </h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto">
            {t('description')}
          </p>

          {/* Formulaire ou message de succès */}
          {subscribed ? (
            <div className="bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg p-8 max-w-xl mx-auto animate-fade-in-up">
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">
                {t('successTitle')}
              </h3>
              <p className="text-blue-100">
                {t('successDesc')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="max-w-xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  required
                  placeholder={t('placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-6 py-4 rounded-lg text-sari-dark focus:outline-none focus:ring-4 focus:ring-sari-lime/50"
                />
                <button 
                  type="submit" 
                  className="bg-sari-lime text-sari-dark px-8 py-4 font-bold rounded-lg hover:bg-white transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {t('subscribe')}
                </button>
              </div>
              <p className="text-sm text-blue-100 mt-4">
                {t('legalText')}
              </p>
            </form>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {features.map((feature, i) => {
              const IconComponent = feature.icon;
              return (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-blue-100 text-sm">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}