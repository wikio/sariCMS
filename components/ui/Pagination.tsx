// components/ui/Pagination.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const isRtl = useLocale() === 'ar';
  const t = useTranslations('components.ui.Pagination');

  if (totalPages <= 1) return null;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getVisiblePages = () => {
    const pages = [];
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);

    if (currentPage <= half) end = Math.min(totalPages, maxVisible);
    if (currentPage + half >= totalPages) start = Math.max(1, totalPages - maxVisible + 1);

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const visiblePages = getVisiblePages();
  const showStartEllipsis = visiblePages[0] > 1;
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages;

  // ✅ Traduction sécurisée avec fallback pour éviter les crashes
  let pageInfoText = `Page ${currentPage} sur ${totalPages}`;
  try {
    pageInfoText = t('pageInfo', { current: currentPage, total: totalPages });
  } catch (e) {
    // En cas d'erreur de traduction, on garde le fallback
  }

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col items-center gap-4 mt-12">
      <div className="text-sm text-gray-500 dark:text-gray-400">{pageInfoText}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Page précédente"
        >
          <PrevIcon className="w-5 h-5" />
        </button>

        {showStartEllipsis && (
          <>
            <button onClick={() => handlePageChange(1)} className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold">1</button>
            <span className="w-10 h-10 flex items-center justify-center text-gray-400">...</span>
          </>
        )}

        {visiblePages.map(page => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg font-semibold transition-colors ${
              currentPage === page
                ? 'bg-sari-blue text-white shadow-lg'
                : 'border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {page}
          </button>
        ))}

        {showEndEllipsis && (
          <>
            <span className="w-10 h-10 flex items-center justify-center text-gray-400">...</span>
            <button onClick={() => handlePageChange(totalPages)} className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold">{totalPages}</button>
          </>
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Page suivante"
        >
          <NextIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}