// app/[locale]/carrieres/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Briefcase, MapPin, Euro, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { getCareers } from '@/lib/data';
import { slugify } from '@/lib/slugify'; // ✅ Import ajouté
import type { Career } from '@/types';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';

export default function CareersPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [careers, setCareers] = useState<Career[]>([]);
  const itemsPerPage = 5;
  const locale = useLocale();
  const t = useTranslations('pages.careers');
  const isRtl = locale === 'ar';

  useEffect(() => {
    const loadCareers = async () => {
      const data = await getCareers(locale);
      setCareers(data);
    };
    loadCareers();
  }, [locale]);

  const totalPages = Math.ceil(careers.length / itemsPerPage);
  const currentItems = careers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  if (careers.length === 0) {
    return (
      <div className="pt-32 pb-24 min-h-screen flex flex-col items-center justify-center text-center page-enter">
        <div className="w-24 h-24 bg-sari-blue/10 flex items-center justify-center mb-6">
          <Users className="w-12 h-12 text-sari-blue" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('noJobsTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          {t('noJobsDesc')}
        </p>
        <Link href={`/${locale}/contact`} className="btn-primary text-white px-6 py-3 inline-block">
          {t('spontaneous')}
        </Link>
      </div>
    );
  }

  return (
    <PageVisibilityGuard visibilityKey="module.careers">
    <div className="pt-32 pb-24 min-h-screen page-enter">
      <div
        className="parallax-bg py-24 flex items-center justify-center text-center text-white relative"
        style={{backgroundImage: 'url(https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1920)'}}
      >
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="relative z-10 container mx-auto px-6">
          <h1 className="text-5xl font-bold mb-4">
            {t('heroTitle')}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          {currentItems.map(job => (
            <div key={job.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-8 card-hover flex flex-col md:flex-row md:items-center justify-between gap-6 group">
              <div className="flex-grow">
                <h3 className="text-2xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors">
                  {job.title}
                </h3>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1">
                    <Briefcase className="w-4 h-4" /> {job.type}
                  </span>
                  <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1">
                    <MapPin className="w-4 h-4" /> {job.location}
                  </span>
                  <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1">
                    <Euro className="w-4 h-4" /> {job.salary}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {job.shortDesc}
                </p>
              </div>
              {/* ✅ Lien mis à jour avec slug SEO */}
              <Link 
                href={`/${locale}/jobs/${job.id}-${slugify(job.title)}`} 
                className="btn-primary text-white px-8 py-3 font-semibold whitespace-nowrap text-center flex-shrink-0"
              >
                {t('seeOffer')}
              </Link>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-16">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <PrevIcon className="w-5 h-5" />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 flex items-center justify-center font-semibold ${
                  currentPage === i + 1 
                    ? 'bg-sari-blue text-white' 
                    : 'border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <NextIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
    </PageVisibilityGuard>
  );
}