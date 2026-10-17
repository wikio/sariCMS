'use client';

import { useLocale } from 'next-intl';
import AdminCrud from '@/components/admin/AdminCrud';

export default function AdminUsersPage() {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <p className="text-sm ad-rise" style={{ color: 'var(--ad-muted)' }}>
        Comptes CMS (admin, clients, partenaires, candidats). Édition inline du statut, filtres par type, recherche email.
      </p>
      <AdminCrud dataType="users" locale={locale} />
    </div>
  );
}
