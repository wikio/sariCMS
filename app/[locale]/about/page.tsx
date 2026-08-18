// app/[locale]/a-propos/page.tsx
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/i18n';
import Link from 'next/link';
import { Heart, Shield, Users } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import SectionTitle from '@/components/ui/SectionTitle';
import Divider from '@/components/shared/Divider';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.about' });
  return {
    title: `${t('title')} | SARI Système`,
    description: t('subtitle'),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.about' });

  const breadcrumbItems = [
    { label: t('home', { defaultMessage: 'Accueil' }), href: '/' },
    { label: t('about', { defaultMessage: 'À Propos' }) }
  ];

  const values = [
    { icon: Heart, title: t('passion'), desc: t('passionDesc') },
    { icon: Shield, title: t('quality'), desc: t('qualityDesc') },
    { icon: Users, title: t('commitment'), desc: t('commitmentDesc') }
  ];

  return (
    <div className="pt-32 pb-24 min-h-screen">
      {/* Header parallaxe */}
      <div 
        className="parallax-bg py-24 flex items-center justify-center text-center text-white relative" 
        style={{backgroundImage: 'url(https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920)'}}
      >
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="relative z-10 container mx-auto px-6">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />
        
        <SectionTitle 
          subtitle={t('historySubtitle')}
          title={t('historyTitle')}
          description={t('historyDescription')}
        />

        <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-12">
          <p>{t('historyP1')}</p>
          <p>{t('historyP2')}</p>
          <Link href={`/${locale}/contenu/1`} className="text-sari-blue hover:underline">
            {t('qualityLink')}
          </Link>
        </div>

        <Divider text={t('valuesTitle')} />

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {values.map((value, i) => {
            const IconComponent = value.icon;
            return (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 rounded-xl text-center hover:shadow-lg transition-all">
                <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <IconComponent className="w-8 h-8 text-sari-blue" />
                </div>
                <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {value.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}