// app/admin/data/[type]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Package, Wrench, Briefcase, Newspaper, Calendar, MessageCircle,
  Handshake, Layers, ImageIcon, FileStack, MenuIcon, Compass, Scale,
  RefreshCw, Download, Code, Table, Plus, Search, Edit2,
  Trash2, Inbox, ArrowLeft, Image as ImageIconLucide, Save,
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import {
  RESOURCE_BY_TYPE,
  cmsAdminCreate,
  cmsAdminDelete,
  cmsAdminList,
  cmsAdminUpdate,
  extraFiltersForType,
  newItemDraft,
} from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';

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
  legal: { label: 'Pages Légales', icon: Scale, isArray: true },
  menu: { label: 'Menus', icon: MenuIcon, isArray: true },
};

export default function AdminDataManagerPage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const dataType = params.type as string;
  const currentConfig = configMap[dataType] || { label: dataType, icon: Package, isArray: true };
  const Icon = currentConfig.icon;
  const resource = RESOURCE_BY_TYPE[dataType];

  const [data, setData] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'json' | 'edit'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataType, locale]);

  const loadData = async () => {
    setLoading(true);
    setApiError('');
    try {
      if (!resource) {
        setData([]);
        setApiError('Type non branché sur le CMS');
        return;
      }
      const rows = await cmsAdminList(resource, extraFiltersForType(dataType, locale));
      const filtered =
        dataType === 'legal'
          ? rows.filter((r) => String((r as { kind?: string }).kind) === 'legal' || String((r as { kind?: string }).kind) === 'about')
          : dataType === 'genericContent'
            ? rows.filter((r) => String((r as { kind?: string }).kind) === 'generic')
            : rows;
      setData(filtered);
      setIsDirty(false);
      setViewMode('list');
      setEditingItem(null);
      setSearchQuery('');
    } catch (error) {
      console.error('Erreur chargement:', error);
      const msg = error instanceof CmsError ? error.message : t('dataManager.loadError');
      setApiError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const persistItem = async (item: Record<string, unknown>) => {
    if (!resource) return;
    setSaving(true);
    try {
      const payload = { ...item, locale: item.locale || locale };
      if (item.id) {
        const updated = await cmsAdminUpdate(resource, String(item.id), payload);
        setData((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)));
        setEditingItem({ ...item, ...updated });
      } else {
        const created = await cmsAdminCreate(resource, payload);
        setData((prev) => [created, ...prev]);
        setEditingItem(created);
      }
      setIsDirty(false);
      showToast(`${currentConfig.label} ${t('dataManager.saveSuccess')}`, 'success');
    } catch (error) {
      const msg = error instanceof CmsError ? error.message : t('dataManager.saveError');
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!resource || !confirm('Supprimer ?')) return;
    try {
      await cmsAdminDelete(resource, id);
      setData((prev) => prev.filter((i) => i.id !== id));
      if (editingItem?.id === id) {
        setEditingItem(null);
        setViewMode('list');
      }
      showToast('Élément envoyé en corbeille', 'success');
    } catch (error) {
      const msg = error instanceof CmsError ? error.message : t('dataManager.saveError');
      showToast(msg, 'error');
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataType}_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('dataManager.exportSuccess'), 'success');
  };

  const handleAdd = async () => {
    if (!resource) return;
    const draft = newItemDraft(resource, locale);
    if (dataType === 'legal') Object.assign(draft, { kind: 'legal', subtype: 'simple', slug: `legal-${Date.now()}` });
    if (dataType === 'genericContent') Object.assign(draft, { kind: 'generic', subtype: 'simple' });
    try {
      const created = await cmsAdminCreate(resource, draft);
      setData((prev) => [created, ...prev]);
      setEditingItem(created);
      setViewMode('edit');
      setIsDirty(false);
    } catch (error) {
      const msg = error instanceof CmsError ? error.message : t('dataManager.saveError');
      showToast(msg, 'error');
    }
  };

  const renderListView = () => {
    const filteredItems = data.filter((item: any) =>
      !searchQuery ||
      (item.title && String(item.title).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.name && String(item.name).toLowerCase().includes(searchQuery.toLowerCase())),
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
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-xs text-gray-500 font-mono max-w-[8rem] truncate">{item.slug || item.id}</td>
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
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'published'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {item.status || item.type || item.category || item.location || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => { setEditingItem(item); setViewMode('edit'); setIsDirty(false); }} className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1">
                      <Edit2 className="w-3 h-3" /> Éditer
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:underline text-sm inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun élément dans le CMS</p>
                    <p className="text-xs mt-2">Importez le catalogue depuis le tableau de bord, ou cliquez sur Ajouter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderEditView = () => {
    if (!editingItem) return null;

    const handleFieldChange = (field: string, value: any) => {
      setEditingItem({ ...editingItem, [field]: value });
      setIsDirty(true);
    };

    const hidden = new Set(['createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy']);

    return (
      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => { setViewMode('list'); setEditingItem(null); setIsDirty(false); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour à la liste
          </button>
          <button
            disabled={saving || !isDirty}
            onClick={() => persistItem(editingItem)}
            className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer dans le CMS'}
          </button>
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6">
          Éditer : {editingItem.title || editingItem.name || `#${editingItem.id}`}
        </h2>
        <div className="space-y-6">
          {Object.entries(editingItem).filter(([field]) => !hidden.has(field)).map(([field, value]: [string, any]) => {
            if (field === 'id') {
              return (
                <div key={field}>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">id</label>
                  <input readOnly value={String(value)} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 dark:bg-[#111111] text-gray-500 rounded-lg font-mono text-sm" />
                </div>
              );
            }
            if (field === 'fullDesc' || field === 'fullContent' || field === 'content' || field === 'description' || field === 'text') {
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
                    <input type="checkbox" checked={value} onChange={(e) => handleFieldChange(field, e.target.checked)} className="w-5 h-5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{field}</span>
                  </label>
                </div>
              );
            }
            if (Array.isArray(value) || (value && typeof value === 'object')) {
              return (
                <div key={field}>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 capitalize">{field}</label>
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    onChange={(e) => {
                      try { handleFieldChange(field, JSON.parse(e.target.value)); } catch { /* keep typing */ }
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
                  value={value == null ? '' : String(value)}
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
              {loading ? 'Chargement CMS…' : `${data.length} élément(s) · API /${resource || '?'}`}
              {isDirty && <span className="text-orange-500 ml-2">• Non enregistré</span>}
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
          {viewMode === 'list' && (
            <button onClick={handleAdd} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          )}
        </div>
      </div>

      {apiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {apiError} — vérifiez que le backend tourne sur le port 3001 et que vous êtes connecté.
        </div>
      )}

      {viewMode === 'list' && (
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
            readOnly
            value={JSON.stringify(data, null, 2)}
            className="w-full h-[600px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none font-mono text-sm"
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
