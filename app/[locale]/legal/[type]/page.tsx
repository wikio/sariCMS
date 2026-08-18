// app/[locale]/legal/[type]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getLegal } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Divider from '@/components/shared/Divider';
import { FileText, Shield, FileCheck } from 'lucide-react';

interface LegalPageProps {
  params: Promise<{ locale: Locale; type: string }>;
}

export async function generateMetadata({ params }: LegalPageProps) {
  const { locale, type } = await params;
  const legal = await getLegal(locale);
  const page = legal[type];
  
  return {
    title: page?.title || 'Page non trouvée',
    description: page?.title || 'Document légal',
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale, type } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.legal' });
  const legal = await getLegal(locale);
  const page = legal[type];

  if (!page || !page.title) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center min-h-screen">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('pageNotFound')}
        </h2>
        <Link href={`/${locale}`} className="btn-primary text-white px-6 py-3 inline-block rounded-lg mt-6">
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 min-h-screen page-enter">
      <div className="bg-sari-blue py-24 text-center text-white">
        <div className="container mx-auto px-6">
          <h1 className="text-5xl font-bold mb-4">{page.title}</h1>
          {page.lastUpdate && <p className="text-xl text-blue-100">{t('lastUpdate')} : {page.lastUpdate}</p>}
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <Breadcrumb items={[
          { label: t('backHome'), href: '/' },
          { label: page.title }
        ]} />

        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
            <div 
              className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed" 
              dangerouslySetInnerHTML={{ __html: page.content }} 
            />
          </div>

          <Divider text={t('otherLegalDocs')} />

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <Link 
              href={`/${locale}/legal/mentions`} 
              className={`p-6 border-2 rounded-xl transition-all ${type === 'mentions' ? 'border-sari-blue bg-sari-blue/5' : 'border-gray-200 dark:border-gray-800 hover:border-sari-blue'}`}
            >
              <FileText className="w-8 h-8 text-sari-blue mb-3" />
              <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('mentions')}</h3>
            </Link>

            <Link 
              href={`/${locale}/legal/privacy`} 
              className={`p-6 border-2 rounded-xl transition-all ${type === 'privacy' ? 'border-sari-blue bg-sari-blue/5' : 'border-gray-200 dark:border-gray-800 hover:border-sari-blue'}`}
            >
              <Shield className="w-8 h-8 text-sari-blue mb-3" />
              <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('privacy')}</h3>
            </Link>

            <Link 
              href={`/${locale}/legal/conditions`} 
              className={`p-6 border-2 rounded-xl transition-all ${type === 'conditions' ? 'border-sari-blue bg-sari-blue/5' : 'border-gray-200 dark:border-gray-800 hover:border-sari-blue'}`}
            >
              <FileCheck className="w-8 h-8 text-sari-blue mb-3" />
              <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('conditions')}</h3>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}