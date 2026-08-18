// components/layout/LoadingSpinner.tsx
'use client';

import { useTranslations } from 'next-intl';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  size = 'md', 
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  const t = useTranslations('components.layout.LoadingSpinner');

  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.md;

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div 
        className={`${spinnerSize} border-sari-blue border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label={t('loading')}
      >
        <span className="sr-only">{t('loading')}</span>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-[#111111] flex items-center justify-center z-[9999]">
        {content}
      </div>
    );
  }

  return content;
}