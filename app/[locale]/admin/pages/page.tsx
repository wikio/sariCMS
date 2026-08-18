// app/admin/pages/page.tsx
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { 
  FileText, Home, Info, Layers, Wrench, Package, Briefcase, 
  Newspaper, Calendar, Mail, ExternalLink, X, Info as InfoIcon
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

interface PageItem {
  id: string;
  name: string;
  href: string;
  Icon: React.ElementType;
}

export default function AdminPagesPage() {
  const locale = useLocale();
  const t = useTranslations('admin.pageEditor');
  const { showToast } = useToast();

  const [selectedPage, setSelectedPage] = useState<PageItem | null>(null);

  const pages: PageItem[] = [
    { id: 'home', name: t('home', 'Accueil'), href: '/', Icon: Home },
    { id: 'about', name: t('about', 'À propos'), href: '/about', Icon: Info },
    { id: 'solutions', name: t('solutions', 'Solutions'), href: '/solutions', Icon: Layers },
    { id: 'services', name: t('services', 'Services'), href: '/services', Icon: Wrench },
    { id: 'products', name: t('products', 'Produits'), href: '/products', Icon: Package },
    { id: 'careers', name: t('careers', 'Carrières'), href: '/careers', Icon: Briefcase },
    { id: 'news', name: t('news', 'Actualités'), href: '/news', Icon: Newspaper },
    { id: 'events', name: t('events', 'Événements'), href: '/events', Icon: Calendar },
    { id: 'contact', name: t('contact', 'Contact'), href: '/contact', Icon: Mail }
  ];

  const handleSave = () => {
    showToast(t('saveSuccess', 'Modifications sauvegardées !'), 'success');
    setSelectedPage(null);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          {t('description', 'Sélectionnez une page à éditer. Les modifications seront appliquées en temps réel sur le site.')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map(page => {
          const Icon = page.Icon;
          return (
            <button
              key={page.id}
              onClick={() => setSelectedPage(page)}
              className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg hover:border-sari-blue transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-sari-blue/10 rounded-lg flex items-center justify-center group-hover:bg-sari-blue transition-colors">
                  <Icon className="w-6 h-6 text-sari-blue group-hover:text-white transition-colors" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-sari-blue transition-colors" />
              </div>
              <h3 className="font-bold text-sari-dark dark:text-white mb-1">{page.name}</h3>
              <p className="text-xs text-gray-500">{page.href}</p>
            </button>
          );
        })}
      </div>

      {/* Modal d'édition */}
      {selectedPage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white">
                  {t('editPage', 'Éditer :')} {selectedPage.name}
                </h2>
                <p className="text-sm text-gray-500">{selectedPage.href}</p>
              </div>
              <button onClick={() => setSelectedPage(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-4 rounded-lg mb-6 flex items-start gap-2">
              <InfoIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-300">
                {t('phase1Info', 'Phase 1 : L\'édition inline des pages sera disponible dans la Phase 2 avec le backend. Pour le moment, utilisez les éditeurs de données (Produits, Services, etc.) pour modifier le contenu.')}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                  {t('pageTitle', 'Titre de la page')}
                </label>
                <input
                  type="text"
                  defaultValue={selectedPage.name}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                  {t('metaDescription', 'Meta description (SEO)')}
                </label>
                <textarea
                  rows={3}
                  placeholder={t('metaPlaceholder', 'Description pour les moteurs de recherche...')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                  {t('mainContent', 'Contenu principal (HTML)')}
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center rounded-lg">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">{t('wysiwygPhase2', 'Éditeur WYSIWYG disponible en Phase 2')}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setSelectedPage(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                {t('cancel', 'Annuler')}
              </button>
              <button
                onClick={handleSave}
                className="btn-primary text-white px-4 py-2 font-semibold rounded-lg"
              >
                {t('save', 'Sauvegarder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}