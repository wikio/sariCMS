'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Settings, Sparkles } from 'lucide-react';
import ImageLogoStudio from '@/components/admin/ImageLogoStudio';

export default function MediaImageLogoStudioPage() {
  const locale = useLocale();
  const t = useTranslations('admin.placeholderStudio');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--ad-accent)' }}>
            <Sparkles className="w-3.5 h-3.5" /> {t('settingsEyebrow')}
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-0.5">{t('studioPageTitle')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ad-muted)' }}>
            {t('studioPageSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/admin/media`} className="ad-btn ad-btn-ghost">
            <ArrowLeft className="w-4 h-4" /> {t('backToMedia')}
          </Link>
          <Link href={`/${locale}/admin/settings?tab=placeholder`} className="ad-btn ad-btn-ghost">
            <Settings className="w-4 h-4" /> {t('openSettings')}
          </Link>
        </div>
      </div>

      <ImageLogoStudio />
    </div>
  );
}
