// app/admin/permissions/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { 
  Shield, Eye, Edit, Trash2, ShieldCheck, LayoutDashboard, Package, Wrench, 
  Briefcase, Newspaper, Calendar, Layers, MessageCircle, Handshake, 
  ShoppingCart, Users, Globe, Settings, Check, X
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  permissions: Record<string, string[]>;
  status: string;
}

type PermissionType = 'view' | 'edit' | 'delete' | 'admin';

export default function AdminPermissionsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.permissions');
  const { showToast } = useToast();

  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const permissionTypes: Array<{ id: PermissionType; label: string; Icon: React.ElementType; color: string }> = [
    { id: 'view', label: t('view', 'Consulter'), Icon: Eye, color: 'blue' },
    { id: 'edit', label: t('edit', 'Modifier'), Icon: Edit, color: 'green' },
    { id: 'delete', label: t('delete', 'Supprimer'), Icon: Trash2, color: 'red' },
    { id: 'admin', label: t('admin', 'Administrer'), Icon: ShieldCheck, color: 'purple' }
  ];

  const sections = [
    { id: 'dashboard', label: t('dashboard', 'Tableau de bord'), Icon: LayoutDashboard },
    { id: 'products', label: t('products', 'Produits'), Icon: Package },
    { id: 'services', label: t('services', 'Services'), Icon: Wrench },
    { id: 'careers', label: t('careers', 'Carrières'), Icon: Briefcase },
    { id: 'news', label: t('news', 'Actualités'), Icon: Newspaper },
    { id: 'events', label: t('events', 'Événements'), Icon: Calendar },
    { id: 'solutions', label: t('solutions', 'Solutions'), Icon: Layers },
    { id: 'testimonials', label: t('testimonials', 'Témoignages'), Icon: MessageCircle },
    { id: 'partners', label: t('partners', 'Partenaires'), Icon: Handshake },
    { id: 'orders', label: t('orders', 'Commandes'), Icon: ShoppingCart },
    { id: 'users', label: t('users', 'Utilisateurs'), Icon: Users },
    { id: 'translations', label: t('translations', 'Traductions'), Icon: Globe },
    { id: 'settings', label: t('settings', 'Paramètres'), Icon: Settings }
  ];

  useEffect(() => {
    loadAdmins();
  }, [locale]);

  const loadAdmins = () => {
    const stored = localStorage.getItem('sari_admins');
    if (stored) {
      try {
        setAdmins(JSON.parse(stored));
      } catch (e) {
        setAdmins([]);
      }
    } else {
      const defaultAdmins: AdminUser[] = [
        {
          id: 1,
          name: 'Admin Principal',
          email: 'admin@sarisysteme.com',
          permissions: { all: ['view', 'edit', 'delete', 'admin'] },
          status: 'active'
        },
        {
          id: 2,
          name: 'Éditeur Contenu',
          email: 'editor@sarisysteme.com',
          permissions: {
            products: ['view', 'edit'],
            services: ['view', 'edit'],
            news: ['view', 'edit']
          },
          status: 'active'
        },
        {
          id: 3,
          name: 'Gestionnaire Commandes',
          email: 'orders@sarisysteme.com',
          permissions: {
            orders: ['view', 'edit'],
            users: ['view']
          },
          status: 'active'
        }
      ];
      setAdmins(defaultAdmins);
      localStorage.setItem('sari_admins', JSON.stringify(defaultAdmins));
    }
  };

  const saveAdmins = (newAdmins: AdminUser[]) => {
    setAdmins(newAdmins);
    localStorage.setItem('sari_admins', JSON.stringify(newAdmins));
    showToast(t('saveSuccess', 'Permissions sauvegardées !'), 'success');
  };

  const hasPermission = (admin: AdminUser, section: string, permType: PermissionType): boolean => {
    if (!admin.permissions) return false;
    if (admin.permissions.all && admin.permissions.all.includes(permType)) return true;
    if (admin.permissions[section] && admin.permissions[section].includes(permType)) return true;
    return false;
  };

  const togglePermission = (adminId: number, section: string, permType: PermissionType) => {
    const updatedAdmins = admins.map(admin => {
      if (admin.id !== adminId) return admin;

      const newPermissions = { ...admin.permissions };

      if (section === 'all') {
        if (!newPermissions.all) newPermissions.all = [];
        const hasPerm = newPermissions.all.includes(permType);
        if (hasPerm) {
          newPermissions.all = newPermissions.all.filter(p => p !== permType);
        } else {
          newPermissions.all.push(permType);
        }
      } else {
        if (!newPermissions[section]) newPermissions[section] = [];
        const hasPerm = newPermissions[section].includes(permType);
        if (hasPerm) {
          newPermissions[section] = newPermissions[section].filter(p => p !== permType);
        } else {
          newPermissions[section].push(permType);
        }
      }

      return { ...admin, permissions: newPermissions };
    });
    saveAdmins(updatedAdmins);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          {t('description', 'Gérez les permissions d\'accès aux différentes rubriques du site pour chaque administrateur.')}
        </p>
      </div>

      <div className="space-y-6">
        {admins.map(admin => (
          <div key={admin.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-xl">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-sari-dark dark:text-white">{admin.name}</h3>
                  <p className="text-sm text-gray-500">{admin.email}</p>
                </div>
              </div>
            </div>

            {/* Matrice des permissions */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Section</th>
                    {permissionTypes.map(pt => {
                      const Icon = pt.Icon;
                      return (
                        <th key={pt.id} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                          <div className="flex items-center justify-center gap-1">
                            <Icon className={`w-4 h-4 text-${pt.color}-500`} />
                            {pt.label}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Ligne "Toutes les sections" */}
                  <tr className="bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800">
                    <td className="px-4 py-3 font-bold text-sari-dark dark:text-white">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Toutes les sections
                      </div>
                    </td>
                    {permissionTypes.map(pt => {
                      const has = hasPermission(admin, 'all', pt.id);
                      return (
                        <td key={pt.id} className="px-4 py-3 text-center">
                          <button
                            onClick={() => togglePermission(admin.id, 'all', pt.id)}
                            className={`w-8 h-8 rounded-lg transition-all ${
                              has
                                ? `bg-${pt.color}-500 text-white`
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                            }`}
                          >
                            {has ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Lignes par section */}
                  {sections.map(section => {
                    const SectionIcon = section.Icon;
                    return (
                      <tr key={section.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm text-sari-dark dark:text-white">
                          <div className="flex items-center gap-2">
                            <SectionIcon className="w-4 h-4 text-sari-blue" />
                            {section.label}
                          </div>
                        </td>
                        {permissionTypes.map(pt => {
                          const has = hasPermission(admin, section.id, pt.id);
                          return (
                            <td key={pt.id} className="px-4 py-3 text-center">
                              <button
                                onClick={() => togglePermission(admin.id, section.id, pt.id)}
                                className={`w-8 h-8 rounded-lg transition-all ${
                                  has
                                    ? `bg-${pt.color}-500 text-white`
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                }`}
                              >
                                {has ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}