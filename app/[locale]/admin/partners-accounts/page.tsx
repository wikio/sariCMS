'use client';

import { useTranslations } from 'next-intl';
import PeopleDesk from '@/components/admin/PeopleDesk';
export default function Page() {
  const t = useTranslations('admin.partners');
  return <PeopleDesk type="partner" title={t('title')} singular={t('singular')} />;
}
