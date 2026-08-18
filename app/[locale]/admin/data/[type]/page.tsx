// app/admin/data/[type]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { 
  Package, Wrench, Briefcase, Newspaper, Calendar, MessageCircle, 
  Handshake, Layers, ImageIcon, FileStack, MenuIcon, Compass, Scale, 
  Settings, RefreshCw, Download, Code, Table, Plus, Search, Edit2, 
  Trash2, Inbox, ArrowLeft, Image as ImageIconLucide
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

// Configuration des types de données
const configMap: Record<string, { label: string; icon: React.ElementType; isArray: boolean }> = {
  products: { label: 'Produits', icon: Package, isArray: true },
  services: { label: 'Services', icon: Wrench, isArray: true },
  careers: { label: 'Carrières', icon: Briefcase, isArray: true },
  news: { label: 'Actualités', icon: Newspaper, isArray: true },
  events: { label: 'Événements', icon: Calendar, isArray: true },
  testimonials: { label: 'Témoignages', icon: MessageCircle, isArray: true },
  partners: { label: 'Partenaires', icon: Handshake, isArray: true },
  'solution-categories': { label: 'Solutions', icon: Layers, isArray: true },
  hero: { label: 'Hero / Bannière', icon: ImageIcon, isArray: true },
  genericContent: { label: 'Contenu Générique', icon: FileStack, isArray: true },
  navigation: { label: 'Navigation', icon: Compass, isArray: true },
  legal: { label: 'Pages Légales', icon: Scale, isArray: false },
  menu: { label: 'Menu Principal', icon: MenuIcon, isArray: false },
};

export default function AdminDataManagerPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const dataType = params.type as string;
  const currentConfig = configMap[dataType] || { label: dataType, icon: Package, isArray: true };
  const Icon = currentConfig.icon;

  const [data, setData] = useState<any>(currentConfig.isArray ? [] : {});
  const [viewMode, setViewMode] = useState<'list' | 'json' | 'edit'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dataType, locale]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Phase 1 : Essayer de charger depuis localStorage, sinon fallback vide
      const stored = localStorage.getItem(`sari_admin_${dataType}`);
      if (stored) {
        setData(JSON.parse(stored));
      } else {
        // Ici, vous pourriez faire un fetch('/data/${locale}/${dataType}.json')
        // Pour l'instant, on initialise avec la structure par défaut
        setData(currentConfig.isArray ? [] : {});
      }
      setIsDirty(false);
      setViewMode('list');
      setEditingItem(null);
      setEditingKey(null);
      setSearchQuery('');
    } catch (error) {
      console.error('Erreur chargement:', error);
      showToast(t('dataManager.loadError', 'Erreur de chargement'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveData = (newData: any) => {
    setData(newData);
    setIsDirty(true);
    try {
      localStorage.setItem(`sari_admin_${dataType}`, JSON.stringify(newData));
      showToast(`${currentConfig.label} ${t('dataManager.saveSuccess', 'sauvegardé !')}`, 'success');
    } catch (err) {
      showToast(t('dataManager.saveError', 'Erreur'), 'error');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataType}_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('dataManager.exportSuccess', 'Exporté !'), 'success');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setEditingItem(null);
    setEditingKey(null);
  };

  // --- Rendu : Liste ---
  const renderListView = () => {
    if (currentConfig.isArray && Array.isArray(data)) {
      const filteredItems = data.filter((item: any) =>
        !searchQuery ||
        (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      return (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#111111]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Image</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Titre</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{item.id}</td>
                    <td className="px-6 py-4">
                      {(item.image || item.logo) ? (
                        <img src={item.image || item.logo} alt="" className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                          <ImageIconLucide className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sari-dark dark:text-white">{item.title || item.name}</div>
                      {item.shortDesc && <div className="text-xs text-gray-500 mt-1 line-clamp-1">{item.shortDesc}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.type || item.category || item.color || '-'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => { setEditingItem(item); setViewMode('edit'); }} className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1">
                        <Edit2 className="w-3 h-3" /> Éditer
                      </button>
                      <button onClick={() => {
                        if (confirm('Supprimer ?')) {
                          saveData(data.filter((i: any) => i.id !== item.id));
                        }
                      }} className="text-red-500 hover:underline text-sm inline-flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Aucun élément</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Cas : OBJET (legal, config, menu)
    if (data && typeof data === 'object') {
      return (
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(data).map(([key, value]: [string, any]) => (
            <button
              key={key}
              onClick={() => { setEditingKey(key); setEditingItem(value); setViewMode('edit'); }}
              className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg hover:border-sari-blue transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-sari-blue/10 rounded-lg flex items-center justify-center group-hover:bg-sari-blue transition-colors">
                  <Settings className="w-6 h-6 text-sari-blue group-hover:text-white transition-colors" />
                </div>
              </div>
              <h3 className="font-bold text-sari-dark dark:text-white mb-2 capitalize">{key}</h3>
              <p className="text-sm text-gray-500">
                {typeof value === 'object' && value !== null ? (
                  <span className="block text-xs mt-1">{Object.keys(value).length} champ(s)</span>
                ) : Array.isArray(value) ? (
                  <span>{value.length} élément(s)</span>
                ) : (
                  <span className="truncate block">{String(value).substring(0, 50)}</span>
                )}
              </p>
            </button>
          ))}
        </div>
      );
    }
    return <div className="text-center py-12 text-gray-500">Aucune donnée</div>;
  };

  // --- Rendu : Édition ---
  const renderEditView = () => {
    if (!editingItem) return null;

    const handleFieldChange = (field: string, value: any) => {
      if (editingKey) {
        const updated = { ...editingItem, [field]: value };
        setEditingItem(updated);
        saveData({ ...data, [editingKey]: updated });
      } else if (Array.isArray(data)) {
        const updated = { ...editingItem, [field]: value };
        setEditingItem(updated);
        saveData(data.map((item: any) => item.id === updated.id ? updated : item));
      }
    };

    return (
      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <button onClick={handleBackToList} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour à la liste
          </button>
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6">
          Éditer : {editingItem.title || editingItem.name || editingKey || `#${editingItem.id}`}
        </h2>
        <div className="space-y-6">
          {Object.entries(editingItem).map(([field, value]: [string, any]) => {
            if (field === 'fullDesc' || field === 'content' || field === 'description') {
              return (
                <div key={field}>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{field}</label>
                  <textarea
                    value={value || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
                  />
                </div>
              );
            }
            if (field === 'image' || field === 'logo') {
              return (
                <div key={field}>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{field}</label>
                  <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
                  />
                  {value && (
                    <div className="mt-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
                      <img src={value} alt="Preview" className="max-h-24 mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              );
            }
            if (typeof value === 'boolean') {
              return (
                <div key={field}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => handleFieldChange(field, e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{field}</span>
                  </label>
                </div>
              );
            }
            if (Array.isArray(value)) {
              return (
                <div key={field}>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{field}</label>
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    onChange={(e) => {
                      try { handleFieldChange(field, JSON.parse(e.target.value)); } catch (err) {}
                    }}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
                  />
                </div>
              );
            }
            return (
              <div key={field}>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{field}</label>
                <input
                  type="text"
                  value={typeof value === 'string' ? value : String(value)}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sari-blue/10 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6 text-sari-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">{currentConfig.label}</h1>
            <p className="text-sm text-gray-500">
              {loading ? 'Chargement...' : (Array.isArray(data) ? `${data.length} élément(s)` : `${Object.keys(data).length} section(s)`)}
              {isDirty && <span className="text-orange-500 ml-2">• Modifié</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadData} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Recharger
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? 'Vue Liste' : 'Vue JSON'}
          </button>
          {currentConfig.isArray && viewMode === 'list' && (
            <button onClick={() => {
              const newItem = { id: Date.now(), title: 'Nouvel élément', shortDesc: '', image: '' };
              saveData([newItem, ...(Array.isArray(data) ? data : [])]);
              setEditingItem(newItem);
              setViewMode('edit');
            }} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          )}
        </div>
      </div>

      {Array.isArray(data) && viewMode === 'list' && (
        <div className="mb-6">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Rechercher ${currentConfig.label}...`}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue"
            />
          </div>
        </div>
      )}

      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <textarea
            value={JSON.stringify(data, null, 2)}
            onChange={(e) => {
              try { saveData(JSON.parse(e.target.value)); } catch (err) {}
            }}
            className="w-full h-[600px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
          />
        </div>
      ) : viewMode === 'edit' ? (
        renderEditView()
      ) : (
        renderListView()
      )}
    </div>
  );
}