'use client';

import { useLocale, useTranslations } from 'next-intl';
import AdminCrud from '@/components/admin/AdminCrud';

export default function AdminUsersPage() {
  const t = useTranslations('admin.users');
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <p className="text-sm ad-rise" style={{ color: 'var(--ad-muted)' }}>
        {t('intro')}
      </p>
      <AdminCrud dataType="users" locale={locale} />
    </div>
  );
}
