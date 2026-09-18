'use client';
import { useTranslations } from 'next-intl';
import PeopleDesk from '@/components/admin/PeopleDesk';
export default function Page() {
  const t = useTranslations('admin.clients');
  return <PeopleDesk type="client" title={t("title")} singular="client" />;
}
