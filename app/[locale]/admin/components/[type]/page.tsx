// app/admin/components/[type]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Edit, Eye, Code, Download, Save, Image as ImageIconLucide } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

const componentConfig: Record<string, { name: string; icon: string; fields: { key: string; label: string; type: string }[] }> = {
  header: {
    name: 'Header',
    icon: 'layout',
    fields: [
      { key: 'phone', label: 'Téléphone', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'companyName', label: 'Nom de l\'entreprise', type: 'text' },
      { key: 'tagline', label: 'Slogan', type: 'text' },
      { key: 'logo', label: 'URL du logo', type: 'image' }
    ]
  },
  footer: {
    name: 'Footer',
    icon: 'layout',
    fields: [
      { key: 'companyName', label: 'Nom de l\'entreprise', type: 'text' },
      { key: 'address', label: 'Adresse', type: 'textarea' },
      { key: 'phone', label: 'Téléphone', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'logo', label: 'URL du logo', type: 'image' }
    ]
  },
  hero: {
    name: 'Hero Section',
    icon: 'image',
    fields: [
      { key: 'title', label: 'Titre principal', type: 'text' },
      { key: 'subtitle', label: 'Sous-titre', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'image', label: 'Image de fond', type: 'image' },
      { key: 'ctaText', label: 'Texte CTA', type: 'text' },
      { key: 'ctaLink', label: 'Lien CTA', type: 'text' }
    ]
  }
};

export default function AdminComponentEditorPage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const componentType = params.type as string;
  const config = componentConfig[componentType];

  const [componentData, setComponentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    loadComponentData();
  }, [componentType, locale]);

  const loadComponentData = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(`sari_component_${locale}_${componentType}`);
      if (stored) {
        setComponentData(JSON.parse(stored));
      } else {
        // Fallback vide
        const initialData: any = {};
        config?.fields.forEach(field => { initialData[field.key] = field.type === 'image' ? '' : ''; });
        setComponentData(initialData);
      }
    } catch (err) {
      showToast('Fichier non trouvé', 'warning');
      setComponentData({});
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, value: any) => {
    setComponentData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`sari_component_${locale}_${componentType}`, JSON.stringify(componentData));
      showToast(t('componentEditor.saveSuccess') || 'Composant sauvegardé !', 'success');
    } catch (err) {
      showToast(t('componentEditor.saveError') || 'Erreur', 'error');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(componentData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${componentType}_${locale}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast(t('componentEditor.exportSuccess') || 'Fichier JSON exporté !', 'success');
  };

  if (loading || !componentData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-sari-blue border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          {[
            { id: 'content', label: 'Contenu', icon: Edit },
            { id: 'preview', label: 'Aperçu', icon: Eye },
            { id: 'json', label: 'JSON', icon: Code }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-semibold text-sm transition-all flex items-center gap-2 ${
                  activeTab === tab.id ? 'text-sari-blue border-b-2 border-sari-blue' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" /> {t(`componentEditor.${tab.id}`) || tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'content' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2">
              Modifier {config?.name || componentType}
            </h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1">
                <Download className="w-4 h-4" /> Exporter
              </button>
              <button onClick={handleSave} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1">
                <Save className="w-4 h-4" /> Sauvegarder
              </button>
            </div>
          </div>
          <div className="space-y-6">
            {config?.fields.map(field => (
              <div key={field.key} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    rows={4}
                    value={componentData[field.key] || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none"
                  />
                ) : field.type === 'image' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={componentData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                    />
                    {componentData[field.key] && (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center">
                        <img src={componentData[field.key]} alt="Preview" className="max-h-48 mx-auto rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type={field.type === 'email' ? 'email' : 'text'}
                    value={componentData[field.key] || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-sari-dark dark:text-white mb-6">Aperçu en temps réel</h2>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">L'aperçu en temps réel sera disponible en Phase 2</p>
            <p className="text-sm text-gray-400 mt-2">Pour le moment, utilisez l'onglet JSON pour voir les données</p>
          </div>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-sari-dark dark:text-white mb-6">Données JSON</h2>
          <textarea
            value={JSON.stringify(componentData, null, 2)}
            onChange={(e) => {
              try { setComponentData(JSON.parse(e.target.value)); } catch (err) {}
            }}
            className="w-full h-[500px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}