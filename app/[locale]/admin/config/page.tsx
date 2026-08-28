// app/admin/config/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Settings, Phone, Share2, BarChart, Code, Download, Save, Image as ImageIconLucide } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

export default function AdminConfigPage() {
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const [configData, setConfigData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadConfig();
  }, [locale]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // Phase 1 : localStorage fallback
      const stored = localStorage.getItem(`sari_config_${locale}`);
      if (stored) {
        setConfigData(JSON.parse(stored));
      } else {
        // Fallback par défaut
        setConfigData({
          meta: { companyName: 'SARI Système', tagline: 'L\'excellence médicale', logo: '', description: '', phone: '', email: '', address: '', hours: '', social: {} },
          stats: { clients: '500+', experience: '20', support: '24/7', satisfaction: '98%' }
        });
      }
    } catch (err) {
      showToast('Fichier config non trouvé', 'warning');
      setConfigData({});
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (section: string, field: string, value: any) => {
    setConfigData((prev: any) => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [field]: value }
    }));
  };

  const handleSocialChange = (platform: string, value: string) => {
    setConfigData((prev: any) => ({
      ...prev,
      meta: {
        ...(prev.meta || {}),
        social: { ...((prev.meta || {}).social || {}), [platform]: value }
      }
    }));
  };

  const handleStatsChange = (field: string, value: string) => {
    setConfigData((prev: any) => ({
      ...prev,
      stats: { ...(prev.stats || {}), [field]: value }
    }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`sari_config_${locale}`, JSON.stringify(configData));
      showToast(t('configEditor.saveSuccess') || 'Configuration sauvegardée !', 'success');
    } catch (err) {
      showToast(t('configEditor.saveError') || 'Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(configData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `config_${locale}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast(t('configEditor.exportSuccess') || 'Fichier JSON exporté !', 'success');
  };

  if (loading || !configData) {
    return (
      <AdminLayout title={t('configEditor.title') || 'Configuration du site'}>
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-sari-blue border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </AdminLayout>
    );
  }

  const tabs = [
    { id: 'general', label: 'Général', icon: Settings },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'social', label: 'Réseaux sociaux', icon: Share2 },
    { id: 'stats', label: 'Statistiques', icon: BarChart },
    { id: 'json', label: 'JSON', icon: Code },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id ? 'text-sari-blue border-b-2 border-sari-blue' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" /> {t(`configEditor.${tab.id}`) || tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2"><Settings className="w-5 h-5 text-sari-blue" /> Général</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"><Download className="w-4 h-4" /> Exporter</button>
              <button onClick={handleSave} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" /> Sauvegarder</button>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Nom de l'entreprise</label>
              <input type="text" value={configData.meta?.companyName || ''} onChange={(e) => handleFieldChange('meta', 'companyName', e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Slogan</label>
              <input type="text" value={configData.meta?.tagline || ''} onChange={(e) => handleFieldChange('meta', 'tagline', e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">URL du logo</label>
              <input type="text" value={configData.meta?.logo || ''} onChange={(e) => handleFieldChange('meta', 'logo', e.target.value)} placeholder="https://..." className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm" />
              {configData.meta?.logo && (
                <div className="mt-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
                  <img src={configData.meta.logo} alt="Logo" className="max-h-24 mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Description</label>
              <textarea rows={4} value={configData.meta?.description || ''} onChange={(e) => handleFieldChange('meta', 'description', e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contact' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2"><Phone className="w-5 h-5 text-sari-blue" /> Contact</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"><Download className="w-4 h-4" /> Exporter</button>
              <button onClick={handleSave} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" /> Sauvegarder</button>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Téléphone</label>
              <input type="text" value={configData.meta?.phone || ''} onChange={(e) => handleFieldChange('meta', 'phone', e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Email</label>
              <input type="email" value={configData.meta?.email || ''} onChange={(e) => handleFieldChange('meta', 'email', e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Adresse</label>
              <textarea rows={3} value={configData.meta?.address || ''} onChange={(e) => handleFieldChange('meta', 'address', e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2"><Share2 className="w-5 h-5 text-sari-blue" /> Réseaux sociaux</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"><Download className="w-4 h-4" /> Exporter</button>
              <button onClick={handleSave} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" /> Sauvegarder</button>
            </div>
          </div>
          <div className="space-y-4">
            {['linkedin', 'facebook', 'twitter', 'youtube'].map(platform => (
              <div key={platform}>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{platform}</label>
                <input type="url" value={configData.meta?.social?.[platform] || ''} onChange={(e) => handleSocialChange(platform, e.target.value)} placeholder={`https://${platform}.com/...`} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2"><BarChart className="w-5 h-5 text-sari-blue" /> Statistiques</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"><Download className="w-4 h-4" /> Exporter</button>
              <button onClick={handleSave} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" /> Sauvegarder</button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {['clients', 'experience', 'support', 'satisfaction'].map(field => (
              <div key={field}>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{field}</label>
                <input type="text" value={configData.stats?.[field] || ''} onChange={(e) => handleStatsChange(field, e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2"><Code className="w-5 h-5 text-sari-blue" /> Données JSON</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"><Download className="w-4 h-4" /> Exporter</button>
              <button onClick={handleSave} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" /> Sauvegarder</button>
            </div>
          </div>
          <textarea
            value={JSON.stringify(configData, null, 2)}
            onChange={(e) => {
              try { setConfigData(JSON.parse(e.target.value)); } catch (err) {}
            }}
            className="w-full h-[600px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}