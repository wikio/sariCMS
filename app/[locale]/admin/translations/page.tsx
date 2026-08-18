// app/[locale]/admin/translations/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Globe, Search, Download, Save, FolderTree, FileJson,
  ChevronRight, ChevronDown, Folder, File, RefreshCw, AlertCircle
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';
import JsonEditor from '@/components/admin/JsonEditor';

interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  path?: string;
  children?: TreeNode[];
}

export default function AdminTranslationEditorPage() {
  const locale = useLocale();
  const t = useTranslations('admin.translationEditor');
  const { showToast } = useToast();

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editLang, setEditLang] = useState<string>(locale);

  // ✅ Charger l'arborescence dynamiquement
  useEffect(() => {
    loadTree();
  }, [editLang]);

  // ✅ Charger le fichier sélectionné
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'file') {
      loadTranslations(selectedNode);
    }
  }, [selectedNode, editLang]);

  const loadTree = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/translations/tree?locale=${editLang}`);
      if (response.ok) {
        const data = await response.json();
        setTree(data.tree || []);
        // Déplier automatiquement les premiers niveaux
        const firstLevelIds = (data.tree || []).map((node: TreeNode) => node.id);
        setExpandedFolders(new Set(firstLevelIds));
      } else {
        showToast(t('loadError', 'Erreur de chargement'), 'error');
      }
    } catch (error) {
      console.error('Erreur chargement arborescence:', error);
      showToast(t('loadError', 'Erreur de chargement'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTranslations = async (node: TreeNode) => {
    if (!node.path) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/translations/file?locale=${editLang}&path=${encodeURIComponent(node.path)}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data);
      } else {
        setTranslations({});
        showToast(`${t('fileNotFound')} : ${node.label}`, 'warning');
      }
    } catch (error) {
      console.error('Erreur chargement traductions:', error);
      setTranslations({});
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // ✅ Aplatir l'objet pour l'édition clé par clé
  const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flattenObject(obj[key], fullKey));
      } else {
        result[fullKey] = obj[key];
      }
    }
    return result;
  };

  const flatTranslations = flattenObject(translations);

  const filteredTranslations = Object.entries(flatTranslations).filter(([key, value]) =>
    !searchQuery ||
    key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (typeof value === 'string' && value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleEdit = (key: string, newValue: string) => {
    const keys = key.split('.');
    const newTranslations = JSON.parse(JSON.stringify(translations));
    let current = newTranslations;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = newValue;
    setTranslations(newTranslations);
  };

  const handleSave = () => {
    try {
      const cacheKey = `${editLang}_${selectedNode?.id}`;
      localStorage.setItem(`sari_translations_${cacheKey}`, JSON.stringify(translations));
      showToast(t('saveSuccess', 'Traductions sauvegardées !'), 'success');
    } catch (err) {
      showToast(t('saveError', 'Erreur lors de la sauvegarde'), 'error');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(translations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNode?.label || 'translations'}_${editLang}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('exportSuccess', 'Fichier JSON exporté !'), 'success');
  };

  // ✅ Rendu récursif de l'arborescence
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedNode?.id === node.id;

    if (node.type === 'folder') {
      return (
        <div key={node.id}>
          <button
            onClick={() => toggleFolder(node.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              isSelected ? 'bg-sari-blue/10 text-sari-blue' : ''
            }`}
            style={{ paddingLeft: `${level * 12 + 12}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" />
            )}
            <Folder className="w-4 h-4 flex-shrink-0 text-sari-blue" />
            <span className="truncate">{node.label}</span>
            {node.children && (
              <span className="text-xs text-gray-500 ml-auto">{node.children.length}</span>
            )}
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // Fichier
    return (
      <button
        key={node.id}
        onClick={() => setSelectedNode(node)}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-all flex items-center gap-2 ${
          isSelected
            ? 'bg-sari-blue text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${level * 12 + 32}px` }}
      >
        <File className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{node.label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sélecteur de langue */}
      <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-sari-dark dark:text-white mb-1">{t('editLanguage', 'Langue en édition')}</h3>
            <p className="text-sm text-gray-500">{t('selectLanguage', 'Sélectionnez la langue à modifier')}</p>
          </div>
          <div className="flex gap-2">
            {[
              { code: 'fr', flag: '🇫🇷', label: 'FR' },
              { code: 'en', flag: '🇬🇧', label: 'EN' },
              { code: 'ar', flag: '🇸🇦', label: 'AR' }
            ].map(l => (
              <button
                key={l.code}
                onClick={() => {
                  setEditLang(l.code);
                  setSelectedNode(null);
                }}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                  editLang === l.code
                    ? 'bg-sari-blue text-white shadow-sm'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar avec arborescence dynamique */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden sticky top-24">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-sari-dark dark:text-white text-sm flex items-center gap-2">
                <FolderTree className="w-4 h-4" />
                {t('treeStructure', 'Arborescence')}
              </h3>
              <button
                onClick={loadTree}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <nav className="p-2 max-h-[700px] overflow-y-auto">
              {loading && tree.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sari-blue" />
                  <p className="text-sm text-gray-500">{t('loading', 'Chargement...')}</p>
                </div>
              ) : tree.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t('noFiles', 'Aucun fichier trouvé')}</p>
                </div>
              ) : (
                tree.map(node => renderTreeNode(node, 0))
              )}
            </nav>
          </div>
        </div>

        {/* Contenu */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            {!selectedNode ? (
              <div className="text-center py-16 text-gray-500">
                <FileJson className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Sélectionnez un fichier dans l'arborescence</p>
                <p className="text-sm mt-2">Les traductions s'afficheront ici pour édition</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2">
                      <FileJson className="w-5 h-5 text-sari-blue" />
                      {selectedNode.label}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {Object.keys(flatTranslations).length} {t('keys', 'clé(s)')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExport} 
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" /> {t('export', 'Exporter')}
                    </button>
                    <button 
                      onClick={handleSave} 
                      className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-1"
                    >
                      <Save className="w-4 h-4" /> {t('save', 'Sauvegarder')}
                    </button>
                  </div>
                </div>

                {/* Recherche */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchKey', 'Rechercher une clé...')}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm"
                    />
                  </div>
                </div>

                {/* Liste des clés */}
                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-sari-blue border-t-transparent animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">{t('loading', 'Chargement...')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredTranslations.map(([key, value]) => (
                      <div key={key} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-sari-blue/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <code className="text-xs text-sari-blue font-mono bg-sari-blue/5 px-2 py-0.5 rounded">
                            {key}
                          </code>
                        </div>
                        {typeof value === 'string' ? (
                          <input
                            type="text"
                            defaultValue={value}
                            onBlur={(e) => handleEdit(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded outline-none focus:border-sari-blue text-sm"
                          />
                        ) : (
                          <div className="text-sm text-gray-500 italic">
                            [{Array.isArray(value) ? `Array(${value.length})` : 'Object'}]
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredTranslations.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>{t('noKeys', 'Aucune clé trouvée')}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}