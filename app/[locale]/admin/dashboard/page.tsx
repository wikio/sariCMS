// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Package, Wrench, Layers, Briefcase, Newspaper, Calendar,
  ShoppingCart, FileCheck, Zap, Plus, FileEdit, Globe, Database, DownloadCloud,
} from 'lucide-react';
import { cmsHealth, cmsImportCatalog, cmsStatus } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { useToast } from '@/components/admin/Toast';

const iconMap: Record<string, React.ElementType> = {
  package: Package, wrench: Wrench, layers: Layers, briefcase: Briefcase,
  newspaper: Newspaper, calendar: Calendar, 'shopping-cart': ShoppingCart,
  'file-check': FileCheck, zap: Zap, plus: Plus, 'file-edit': FileEdit, globe: Globe,
};

export default function AdminDashboardPage() {
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const [counts, setCounts] = useState<Record<string, number>>({
    products: 0, services: 0, solutions: 0, careers: 0, news: 0, events: 0, pages: 0, users: 0,
  });
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<string>('');

  const refresh = async () => {
    const [health, status] = await Promise.all([cmsHealth(), cmsStatus()]);
    setConnected(Boolean(health || status?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || '');
    if (status?.counts) {
      setCounts((prev) => ({ ...prev, ...status.counts }));
    }
  };

  useEffect(() => {
    refresh();
  }, [locale]);

  const handleImport = async (replace = false) => {
    setImporting(true);
    try {
      const result = await cmsImportCatalog(replace);
      const total = Object.values(result.imported || {}).reduce((a, b) => a + Number(b), 0);
      setLastImport(`${total} fiche(s) importée(s)`);
      showToast(total ? `${total} fiches importées dans le CMS` : 'Rien à importer (déjà présent)', 'success');
      await refresh();
    } catch (err) {
      const msg = err instanceof CmsError ? err.message : 'Import impossible';
      showToast(msg, 'error');
    } finally {
      setImporting(false);
    }
  };

  const stats = [
    { label: t('dashboard.stats.products'), value: counts.products, icon: 'package', href: `/${locale}/admin/data/products` },
    { label: t('dashboard.stats.services'), value: counts.services, icon: 'wrench', href: `/${locale}/admin/data/services` },
    { label: t('dashboard.stats.solutions'), value: counts.solutions, icon: 'layers', href: `/${locale}/admin/data/solution-categories` },
    { label: t('dashboard.stats.careers'), value: counts.careers, icon: 'briefcase', href: `/${locale}/admin/data/careers` },
    { label: t('dashboard.stats.news'), value: counts.news, icon: 'newspaper', href: `/${locale}/admin/data/news` },
    { label: t('dashboard.stats.events'), value: counts.events, icon: 'calendar', href: `/${locale}/admin/data/events` },
    { label: 'Pages', value: counts.pages ?? 0, icon: 'file-edit', href: `/${locale}/admin/data/legal` },
    { label: 'Utilisateurs', value: counts.users ?? 0, icon: 'file-check', href: `/${locale}/admin/users` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = iconMap[stat.icon] || Package;
          return (
            <Link key={i} href={stat.href} className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-sari-blue/10 rounded-lg flex items-center justify-center group-hover:bg-sari-blue transition-colors">
                  <Icon className="w-5 h-5 text-sari-blue group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="text-2xl font-bold text-sari-dark dark:text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-sari-lime" />
            {t('dashboard.quickActions')}
          </h3>
          <div className="space-y-1">
            {[
              { href: `/${locale}/admin/data/products`, icon: 'plus', label: t('dashboard.addProduct') },
              { href: `/${locale}/admin/data/careers`, icon: 'plus', label: t('dashboard.publishOffer') },
              { href: `/${locale}/admin/data/news`, icon: 'plus', label: t('dashboard.createArticle') },
              { href: `/${locale}/admin/translations`, icon: 'globe', label: t('dashboard.editTranslations') },
              { href: `/${locale}/admin/pages`, icon: 'file-edit', label: t('dashboard.editPage') },
            ].map((action, i) => {
              const Icon = iconMap[action.icon] || Plus;
              return (
                <Link key={i} href={action.href} className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm transition-colors">
                  <Icon className="w-4 h-4 text-sari-blue" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
            <Database className={`w-5 h-5 ${connected ? 'text-green-500' : 'text-red-500'}`} />
            {t('dashboard.siteStatus')}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('dashboard.activeLanguages')}</span>
              <div className="flex gap-1">
                {['FR', 'EN', 'AR'].map((lang) => (
                  <span key={lang} className="px-2 py-0.5 bg-sari-blue/10 text-sari-blue text-xs font-bold rounded">{lang}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('dashboard.dataMode')}</span>
              <span className="font-bold text-emerald-600">CMS API</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('dashboard.backendApi')}</span>
              <span className={`font-bold flex items-center gap-1 ${connected ? 'text-green-600' : 'text-red-500'}`}>
                <Database className="w-3 h-3" />
                {connected ? `Connecté${driver ? ` · ${driver}` : ''}` : t('dashboard.notConnected')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-sari-blue/10 to-emerald-500/10 border border-sari-blue/20 p-6 rounded-xl md:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-sari-blue rounded-xl flex items-center justify-center flex-shrink-0">
              <DownloadCloud className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sari-dark dark:text-white mb-2">
                Catalogue CMS
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Le seed est vide par défaut. Importez les JSON de la vitrine (`data/fr|en|ar`) pour remplir produits, actualités, offres, menus…
              </p>
              {lastImport && <p className="text-xs text-emerald-600 mb-3">{lastImport}</p>}
              <div className="flex gap-2 flex-wrap">
                <button
                  disabled={importing || !connected}
                  onClick={() => handleImport(false)}
                  className="px-4 py-2 bg-sari-blue text-white text-sm font-semibold rounded-lg hover:bg-sari-blue/90 flex items-center gap-2 disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4" />
                  {importing ? 'Import…' : 'Importer le catalogue'}
                </button>
                <button
                  disabled={importing || !connected}
                  onClick={() => handleImport(true)}
                  className="px-4 py-2 bg-white dark:bg-[#111] border border-gray-300 dark:border-gray-700 text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  Réimporter (écraser)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
