'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
export default function Layout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin.menu');
  return <Suspense fallback={<div className="ad-card"><PixelGridLoader label={t('profile')} /></div>}>{children}</Suspense>;
}
