// app/[locale]/admin/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Settings as SettingsIcon, Palette, Bell, Shield, Database, Save, Download } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

export default function AdminSettingsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.settings');
  const { showToast } = useToast();

  const [settings, setSettings] = useState({
    theme: 'system',
    language: locale,
    notifications: {
      email: true,
      browser: true,
      orders: true,
      applications: true
    },
    security: {
      twoFactor: false,
      sessionTimeout: 120
    }
  });

  useEffect(() => {
    const stored = localStorage.getItem(`sari_settings_${locale}`);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {}
    }
  }, [locale]);

  const handleSave = () => {
    try {
      localStorage.setItem(`sari_settings_${locale}`, JSON.stringify(settings));
      showToast(t('saveSuccess', 'Configuration sauvegardée !'), 'success');
    } catch (err) {
      showToast(t('saveError', 'Erreur lors de la sauvegarde'), 'error');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settings_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections = [
    {
      id: 'general',
      icon: SettingsIcon,
      color: 'sari-blue',
      title: t('general', 'Général'),
      desc: t('generalDesc', 'Configurez les paramètres généraux de l\'application')
    },
    {
      id: 'contact',
      icon: Bell,
      color: 'orange-500',
      title: t('contact', 'Contact'),
      desc: t('contactDesc', 'Gérez les informations de contact et les notifications')
    },
    {
      id: 'social',
      icon: Palette,
      color: 'purple-500',
      title: t('social', 'Réseaux sociaux'),
      desc: t('socialDesc', 'Personnalisez l\'apparence et les liens sociaux')
    },
    {
      id: 'stats',
      icon: Database,
      color: 'green-500',
      title: t('stats', 'Statistiques'),
      desc: t('statsDesc', 'Consultez et exportez les statistiques du site')
    }
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* En-tête */}
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sari-blue/10 rounded-xl flex items-center justify-center">
                <SettingsIcon className="w-6 h-6 text-sari-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-sari-dark dark:text-white">{t('title', 'Paramètres')}</h1>
                {/* ✅ CORRECTION : Utilisation d'un <div> au lieu d'un <p> pour éviter l'imbrication interdite */}
                <div className="text-sm text-gray-500">
                  {t('generalDesc', 'Configurez les paramètres généraux de l\'application')}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleExport}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('export', 'Exporter')}
              </button>
              <button 
                onClick={handleSave}
                className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {t('save', 'Sauvegarder')}
              </button>
            </div>
          </div>
        </div>

        {/* Grille des sections */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <div 
                key={section.id}
                className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg hover:border-sari-blue transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-${section.color}/10 rounded-lg flex items-center justify-center group-hover:bg-${section.color} transition-colors`}>
                    <Icon className={`w-6 h-6 text-${section.color} group-hover:text-white transition-colors`} />
                  </div>
                </div>
                <h3 className="font-bold text-sari-dark dark:text-white mb-1">{section.title}</h3>
                <p className="text-xs text-gray-500">{section.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}