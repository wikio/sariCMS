// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { 
  Package, Wrench, Layers, Briefcase, Newspaper, Calendar, 
  ShoppingCart, FileCheck, Zap, Plus, Edit, FileEdit, Globe, Database
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { getProducts, getServices, getCareers, getNews, getEvents, getSolutionCategories } from '@/lib/data';

const iconMap: Record<string, React.ElementType> = {
  package: Package, wrench: Wrench, layers: Layers, briefcase: Briefcase,
  newspaper: Newspaper, calendar: Calendar, 'shopping-cart': ShoppingCart,
  'file-check': FileCheck, zap: Zap, plus: Plus, edit: Edit, 'file-edit': FileEdit, globe: Globe
};

export default function AdminDashboardPage() {
  const locale = useLocale();
  const t = useTranslations('admin');
  
  const [counts, setCounts] = useState({
    products: 0, services: 0, solutions: 0, careers: 0, news: 0, events: 0, orders: 0, applications: 0
  });

  useEffect(() => {
    const loadData = async () => {
      const [products, services, careers, news, events, solutions] = await Promise.all([
        getProducts(locale), getServices(locale), getCareers(locale), 
        getNews(locale), getEvents(locale), getSolutionCategories(locale)
      ]);
      
      // Simulation Phase 1 : on récupère aussi du localStorage pour orders/applications
      const orders = JSON.parse(localStorage.getItem('sari_orders') || '[]');
      const applications = JSON.parse(localStorage.getItem('sari_applications') || '[]');

      setCounts({
        products: products.length,
        services: services.length,
        solutions: solutions.length,
        careers: careers.length,
        news: news.length,
        events: events.length,
        orders: orders.length,
        applications: applications.length
      });
    };
    loadData();
  }, [locale]);

  const stats = [
    { label: t('dashboard.stats.products', 'Produits'), value: counts.products, icon: 'package', color: 'sari-blue', href: '/admin/data/products' },
    { label: t('dashboard.stats.services', 'Services'), value: counts.services, icon: 'wrench', color: 'green-500', href: '/admin/data/services' },
    { label: t('dashboard.stats.solutions', 'Solutions'), value: counts.solutions, icon: 'layers', color: 'purple-500', href: '/admin/data/solution-categories' },
    { label: t('dashboard.stats.careers', 'Offres emploi'), value: counts.careers, icon: 'briefcase', color: 'orange-500', href: '/admin/data/careers' },
    { label: t('dashboard.stats.news', 'Actualités'), value: counts.news, icon: 'newspaper', color: 'pink-500', href: '/admin/data/news' },
    { label: t('dashboard.stats.events', 'Événements'), value: counts.events, icon: 'calendar', color: 'teal-500', href: '/admin/data/events' },
    { label: t('dashboard.stats.orders', 'Commandes'), value: counts.orders, icon: 'shopping-cart', color: 'red-500', href: '/admin/orders' },
    { label: t('dashboard.stats.applications', 'Candidatures'), value: counts.applications, icon: 'file-check', color: 'indigo-500', href: '/admin/applications' },
  ];

  return (
  <div className="space-y-6">      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = iconMap[stat.icon] || Package;
          return (
            <Link key={i} href={stat.href} className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 bg-${stat.color}/10 rounded-lg flex items-center justify-center group-hover:bg-${stat.color} transition-colors`}>
                  <Icon className={`w-5 h-5 text-${stat.color} group-hover:text-white transition-colors`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-sari-dark dark:text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Actions rapides */}
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-sari-lime" /> 
            {t('dashboard.quickActions', 'Actions rapides')}
          </h3>
          <div className="space-y-1">
            {[
              { href: '/admin/data/products', icon: 'plus', label: t('dashboard.addProduct', 'Ajouter un produit') },
              { href: '/admin/data/careers', icon: 'plus', label: t('dashboard.publishOffer', 'Publier une offre') },
              { href: '/admin/data/news', icon: 'plus', label: t('dashboard.createArticle', 'Créer un article') },
              { href: '/admin/translations', icon: 'globe', label: t('dashboard.editTranslations', 'Modifier les traductions') },
              { href: '/admin/pages', icon: 'file-edit', label: t('dashboard.editPage', 'Éditer une page') },
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

        {/* État du site */}
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-500" /> 
            {t('dashboard.siteStatus', 'État du site')}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('dashboard.activeLanguages', 'Langues actives')}</span>
              <div className="flex gap-1">
                {['FR', 'EN', 'AR'].map(lang => (
                  <span key={lang} className="px-2 py-0.5 bg-sari-blue/10 text-sari-blue text-xs font-bold rounded">{lang}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('dashboard.dataMode', 'Mode données')}</span>
              <span className="font-bold text-orange-500 flex items-center gap-1">
                <Database className="w-3 h-3" /> JSON Local
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('dashboard.backendApi', 'Backend API')}</span>
              <span className="font-bold text-red-500 flex items-center gap-1">
                <Database className="w-3 h-3" /> {t('dashboard.notConnected', 'Non connecté')}
              </span>
            </div>
          </div>
        </div>

        {/* Info Phase */}
        <div className="bg-gradient-to-r from-sari-blue/10 to-purple-500/10 border border-sari-blue/20 p-6 rounded-xl md:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-sari-blue rounded-xl flex items-center justify-center flex-shrink-0">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sari-dark dark:text-white mb-2">
                {t('dashboard.phaseInfoTitle', 'Phase 1 - Mode JSON Local')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('dashboard.phaseInfoDesc', 'Les modifications sont sauvegardées dans localStorage pour le moment. Pour persister les changements, vous devez exporter les fichiers JSON manuellement.')}
              </p>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-sari-blue text-white text-sm font-semibold rounded-lg hover:bg-sari-blue/90 flex items-center gap-2">
                  <Database className="w-4 h-4" /> 
                  {t('dashboard.exportData', 'Exporter les données')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
  );
}