'use client';

import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import AdminCrud from '@/components/admin/AdminCrud';

export default function AdminDataManagerPage() {
  const params = useParams();
  const locale = useLocale();
  const dataType = String(params.type || 'products');
  return <AdminCrud dataType={dataType} locale={locale} />;
}
