'use client';

import { useEffect, useState } from 'react';
import { Check, Shield } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { useTranslations } from 'next-intl';

const ACTIONS = ['create', 'read', 'update', 'delete', 'admin'] as const;
const RESOURCES = [
  'users', 'roles', 'pages', 'faqs', 'testimonials', 'menus', 'contact',
  'translations', 'audit', 'settings', 'news', 'events', 'products',
  'services', 'partners', 'careers', 'solutions', 'hero', 'dashboard',
];

export default function AdminPermissionsPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.permissions');
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [perms, setPerms] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([cmsAdminList('roles'), cmsAdminList('permissions')]);
      setRoles(r);
      setPerms(p);
      setActive(String(r[0]?.id || ''));
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Impossible de charger les rôles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const role = roles.find((r) => r.id === active);
  const ids = new Set((role?.permissionIds as string[] | undefined) || []);

  const idFor = (resource: string, action: string) =>
    String(perms.find((p) => p.resource === resource && p.action === action)?.id || '');

  const toggle = async (resource: string, action: string) => {
    if (!role) return;
    const pid = idFor(resource, action);
    if (!pid) return;
    const next = new Set(ids);
    next.has(pid) ? next.delete(pid) : next.add(pid);
    try {
      const updated = await cmsAdminUpdate('roles', String(role.id), { permissionIds: Array.from(next) });
      setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...updated } : r)));
      showToast('Permissions mises à jour', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  if (loading) return <div className="ad-card"><PixelGridLoader label="ACL" /></div>;

  return (
    <div className="space-y-4">
      <div className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--ad-muted)' }}>{t("rbac")}</div>
        <h1 className="text-2xl font-black">Rôles & permissions</h1>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Matrice live branchée sur `/roles` et `/permissions`.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button key={String(r.id)} onClick={() => setActive(String(r.id))} className={`ad-btn ${active === r.id ? 'ad-btn-primary' : 'ad-btn-ghost'}`}>
            <Shield className="w-4 h-4" /> {String(r.name)}
          </button>
        ))}
      </div>
      <div className="ad-card overflow-x-auto ad-rise ad-rise-2">
        <table className="ad-table">
          <thead>
            <tr>
              <th>{t("resource")}</th>
              {ACTIONS.map((a) => <th key={a} className="text-center">{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((res) => (
              <tr key={res}>
                <td className="font-semibold capitalize">{res}</td>
                {ACTIONS.map((act) => {
                  const pid = idFor(res, act);
                  const on = pid && ids.has(pid);
                  return (
                    <td key={act} className="text-center">
                      <button
                        disabled={!pid}
                        onClick={() => toggle(res, act)}
                        className={`w-8 h-8 rounded-lg inline-flex items-center justify-center ${on ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                      >
                        {on && <Check className="w-4 h-4" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
