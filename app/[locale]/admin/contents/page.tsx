// app/admin/contents/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  FileStack, FileText, Info, Image as ImageIcon, FileSpreadsheet,
  Presentation, MousePointerClick, FileCode, Plus, Trash2, Search,
  Download, Code, Table, RefreshCw, ArrowLeft, Edit2, Inbox
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';
import { resolveColor, withAlpha } from '@/lib/colors';

interface ContentItem {
  id: number;
  type: string;
  title: string;
  subtitle?: string;
  category?: string;
  media?: any;
  content?: string;
  features?: string[];
  pdf?: string;
  slides?: any[];
  sections?: any[];
}

const contentTypes = [
  { value: 'simple', label: 'Simple', icon: FileText, color: 'sari-blue' },
  { value: 'about', label: 'À Propos', icon: Info, color: 'sari-blue' },
  { value: 'gallery', label: 'Galerie', icon: ImageIcon, color: 'purple-500' },
  { value: 'flyer', label: 'Flyer', icon: FileSpreadsheet, color: 'orange-500' },
  { value: 'slide', label: 'Carrousel', icon: Presentation, color: 'pink-500' },
  { value: 'scroll', label: 'Scroll', icon: MousePointerClick, color: 'teal-500' },
  { value: 'full', label: 'Complet', icon: FileCode, color: 'indigo-500' }
];

const getTypeInfo = (type: string) => contentTypes.find(ct => ct.value === type) || contentTypes[0];

export default function AdminContentsPage() {
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const [contents, setContents] = useState<ContentItem[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'edit' | 'json'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jsonViewScope, setJsonViewScope] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [locale]);

  const loadData = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('sari_admin_genericContent');
      if (stored) {
        const parsed = JSON.parse(stored);
        setContents(Array.isArray(parsed) ? parsed : []);
      } else {
        setContents([]);
      }
      setIsDirty(false);
    } catch (err) {
      console.error('Erreur chargement contenus:', err);
      showToast(t('dataManager.loadError') || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveData = (newContents: ContentItem[]) => {
    setContents(newContents);
    setIsDirty(true);
    try {
      localStorage.setItem('sari_admin_genericContent', JSON.stringify(newContents));
      showToast(t('dataManager.saveSuccess') || 'Sauvegardé !', 'success');
    } catch (err) {
      showToast(t('dataManager.saveError') || 'Erreur', 'error');
    }
  };

  const handleAddContent = () => {
    const newContent: ContentItem = {
      id: Date.now(),
      type: 'simple',
      title: t('dataManager.newElement') || 'Nouveau contenu',
      subtitle: '',
      category: '',
      media: '',
      content: '<p>Contenu...</p>'
    };
    const newContents = [newContent, ...contents];
    saveData(newContents);
    setEditingId(newContent.id);
    setEditingContent(newContent);
    setViewMode('edit');
  };

  const handleDeleteContent = (id: number) => {
    if (confirm(t('dataManager.deleteConfirm') || 'Supprimer ?')) {
      saveData(contents.filter(c => c.id !== id));
    }
  };

  const handleTypeChange = (id: number, newType: string) => {
    const newContents = contents.map(c => {
      if (c.id !== id) return c;
      const base = { id: c.id, type: newType, title: c.title, subtitle: c.subtitle, category: c.category };
      switch (newType) {
        case 'simple': return { ...base, media: c.media || '', content: c.content || '<p>...</p>' };
        case 'about': return { ...base, media: c.media || '', content: c.content || '<p>...</p>', features: c.features || [] };
        case 'gallery': return { ...base, media: Array.isArray(c.media) ? c.media : [], content: c.content || '<p>...</p>' };
        case 'flyer': return { ...base, media: c.media || '', content: c.content || '<p>...</p>', pdf: c.pdf || '' };
        case 'slide': return { ...base, slides: Array.isArray(c.slides) ? c.slides : [] };
        case 'scroll': return { ...base, sections: Array.isArray(c.sections) ? c.sections : [] };
        case 'full': return { ...base, media: c.media || '', content: c.content || '<p>...</p>' };
        default: return base;
      }
    });
    saveData(newContents);
    const updated = newContents.find(c => c.id === id);
    if (updated) setEditingContent(updated);
  };

  const handleEditField = (id: number, field: string, value: any) => {
    const newContents = contents.map(c => c.id === id ? { ...c, [field]: value } : c);
    saveData(newContents);
    const updated = newContents.find(c => c.id === id);
    if (updated) setEditingContent(updated);
  };

  const handleOpenEdit = (content: ContentItem) => {
    setEditingId(content.id);
    setEditingContent(content);
    setViewMode('edit');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setEditingId(null);
    setEditingContent(null);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(contents, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genericContent_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('dataManager.exportSuccess') || 'Exporté !', 'success');
  };

  const filteredContents = contents.filter(c =>
    !searchQuery ||
    (c.title && c.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.type && c.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ==========================================
  // RENDU : VUE LISTE
  // ==========================================
  const renderListView = () => (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-[#111111]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Image</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Titre</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Catégorie</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredContents.map(content => {
              const typeInfo = getTypeInfo(content.type);
              const TypeIcon = typeInfo.icon;
              const media = Array.isArray(content.media) ? content.media[0] : content.media;
              return (
                <tr key={content.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{content.id}</td>
                  <td className="px-6 py-4">
                    {media ? (
                      <img src={typeof media === 'object' ? media.src : media} alt="" className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sari-dark dark:text-white">{content.title}</div>
                    {content.subtitle && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">{content.subtitle}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {/* Couleurs en style inline : une classe Tailwind construite
                        dynamiquement (`bg-${...}`) est éliminée au build. */}
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: withAlpha(typeInfo.color, 0.1), color: resolveColor(typeInfo.color) }}
                    >
                      <TypeIcon className="w-3 h-3" />
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{content.category || '-'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(content)}
                      className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Éditer
                    </button>
                    <button
                      onClick={() => handleDeleteContent(content.id)}
                      className="text-red-500 hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredContents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t('dataManager.noElements') || 'Aucun élément'}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================
  // RENDU : VUE ÉDITION
  // ==========================================
  const renderEditView = () => {
    if (!editingContent) return null;

    return (
      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
        {/* Breadcrumb + Bouton retour */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={handleBackToList} className="hover:text-sari-blue flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              {t('dataManager.contents') || 'Contenus'}
            </button>
            <span>/</span>
            <span className="text-sari-dark dark:text-white font-semibold">#{editingContent.id}</span>
          </div>
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('dataManager.backToList') || 'Retour à la liste'}
          </button>
        </div>

        {/* Méta-données communes */}
        <div className="bg-sari-blue/5 border border-sari-blue/20 p-4 rounded-lg mb-6">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-sari-blue" />
            {t('contentsEditor.metadata') || 'Métadonnées'}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">ID</label>
              <input
                type="text"
                value={editingContent.id}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg bg-gray-100 dark:bg-gray-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                {t('contentsEditor.type') || 'Type'} <span className="text-red-500">*</span>
              </label>
              <select
                value={editingContent.type}
                onChange={(e) => handleTypeChange(editingContent.id, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              >
                {contentTypes.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                {t('dataManager.title') || 'Titre'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingContent.title || ''}
                onChange={(e) => handleEditField(editingContent.id, 'title', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                {t('dataManager.category') || 'Catégorie'}
              </label>
              <input
                type="text"
                value={editingContent.category || ''}
                onChange={(e) => handleEditField(editingContent.id, 'category', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                {t('contentsEditor.subtitle') || 'Sous-titre'}
              </label>
              <input
                type="text"
                value={editingContent.subtitle || ''}
                onChange={(e) => handleEditField(editingContent.id, 'subtitle', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
          </div>
        </div>

        {/* Champs spécifiques selon le type */}
        <div className="bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
          <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
            Champs spécifiques au type : <span className="capitalize">{getTypeInfo(editingContent.type).label}</span>
          </h3>

          {/* TYPE SIMPLE */}
          {editingContent.type === 'simple' && (
            <div className="space-y-4">
              {renderImageField('media', editingContent.media, (val) => handleEditField(editingContent.id, 'media', val))}
              {renderHtmlField('content', editingContent.content, (val) => handleEditField(editingContent.id, 'content', val))}
            </div>
          )}

          {/* TYPE ABOUT */}
          {editingContent.type === 'about' && (
            <div className="space-y-4">
              {renderImageField('media', editingContent.media, (val) => handleEditField(editingContent.id, 'media', val))}
              {renderHtmlField('content', editingContent.content, (val) => handleEditField(editingContent.id, 'content', val))}
              {renderFeaturesField(editingContent.features || [], (val) => handleEditField(editingContent.id, 'features', val))}
            </div>
          )}

          {/* TYPE GALLERY */}
          {editingContent.type === 'gallery' && (
            <div className="space-y-4">
              {renderGalleryField(Array.isArray(editingContent.media) ? editingContent.media : [], (val) => handleEditField(editingContent.id, 'media', val))}
              {renderHtmlField('content', editingContent.content, (val) => handleEditField(editingContent.id, 'content', val))}
            </div>
          )}

          {/* TYPE FLYER */}
          {editingContent.type === 'flyer' && (
            <div className="space-y-4">
              {renderImageField('media', editingContent.media, (val) => handleEditField(editingContent.id, 'media', val))}
              {renderHtmlField('content', editingContent.content, (val) => handleEditField(editingContent.id, 'content', val))}
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                  {t('contentsEditor.pdf') || 'Fichier PDF'}
                </label>
                <input
                  type="text"
                  value={editingContent.pdf || ''}
                  onChange={(e) => handleEditField(editingContent.id, 'pdf', e.target.value)}
                  placeholder="data/promotions/flyer.pdf"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* TYPE SLIDE */}
          {editingContent.type === 'slide' && (
            <div className="space-y-4">
              {renderSlidesField(Array.isArray(editingContent.slides) ? editingContent.slides : [], (val) => handleEditField(editingContent.id, 'slides', val))}
            </div>
          )}

          {/* TYPE SCROLL */}
          {editingContent.type === 'scroll' && (
            <div className="space-y-4">
              {renderSectionsField(Array.isArray(editingContent.sections) ? editingContent.sections : [], (val) => handleEditField(editingContent.id, 'sections', val))}
            </div>
          )}

          {/* TYPE FULL */}
          {editingContent.type === 'full' && (
            <div className="space-y-4">
              {renderImageField('media', editingContent.media, (val) => handleEditField(editingContent.id, 'media', val))}
              {renderHtmlField('content', editingContent.content, (val) => handleEditField(editingContent.id, 'content', val))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // COMPOSANTS DE CHAMPS
  // ==========================================
  const renderImageField = (label: string, value: any, onChange: (val: string) => void) => (
    <div>
      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-sari-blue" />
        {label}
      </label>
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/image.jpg"
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
      />
      {value && typeof value === 'string' && (
        <div className="mt-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-center">
          <img src={value} alt="Preview" className="max-h-32 mx-auto rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
    </div>
  );

  const renderHtmlField = (label: string, value: any, onChange: (val: string) => void) => (
    <div>
      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2">
        <FileText className="w-4 h-4 text-sari-blue" />
        {label} (HTML)
      </label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label}...`}
        rows={8}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
      />
      <p className="text-xs text-gray-500 mt-1">💡 Phase 2 : Éditeur WYSIWYG sera disponible</p>
    </div>
  );

  const renderFeaturesField = (features: string[], onChange: (val: string[]) => void) => (
    <div>
      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2">
        {t('contentsEditor.features') || 'Caractéristiques'}
      </label>
      <div className="space-y-2">
        {features.map((feat, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={feat}
              onChange={(e) => {
                const newFeatures = [...features];
                newFeatures[idx] = e.target.value;
                onChange(newFeatures);
              }}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded outline-none focus:border-sari-blue text-sm"
            />
            <button
              onClick={() => onChange(features.filter((_, i) => i !== idx))}
              className="px-3 text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...features, ''])}
          className="w-full py-2 border-2 border-dashed border-sari-blue text-sari-blue rounded-lg hover:bg-sari-blue/5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          {t('dataManager.add') || 'Ajouter'}
        </button>
      </div>
    </div>
  );

  const renderGalleryField = (images: any[], onChange: (val: any[]) => void) => (
    <div>
      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-sari-blue" />
        {t('contentsEditor.gallery') || 'Galerie d\'images'}
      </label>
      <div className="space-y-3">
        {images.map((img, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">Image #{idx + 1}</span>
              <button
                onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            {typeof img === 'object' && img !== null ? (
              <>
                <input
                  type="text"
                  value={img.src || ''}
                  onChange={(e) => {
                    const newImages = [...images];
                    newImages[idx] = { ...newImages[idx], src: e.target.value };
                    onChange(newImages);
                  }}
                  placeholder="URL de l'image"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm mb-2 font-mono"
                />
                <input
                  type="text"
                  value={img.caption || ''}
                  onChange={(e) => {
                    const newImages = [...images];
                    newImages[idx] = { ...newImages[idx], caption: e.target.value };
                    onChange(newImages);
                  }}
                  placeholder="Légende"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm"
                />
              </>
            ) : (
              <input
                type="text"
                value={img || ''}
                onChange={(e) => {
                  const newImages = [...images];
                  newImages[idx] = e.target.value;
                  onChange(newImages);
                }}
                placeholder="URL de l'image"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm font-mono"
              />
            )}
            {typeof img === 'object' && img.src && (
              <div className="mt-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-2 text-center">
                <img src={img.src} alt="" className="max-h-24 mx-auto rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
        ))}
        <button
          onClick={() => onChange([...images, { src: '', caption: '', type: 'image' }])}
          className="w-full py-2 border-2 border-dashed border-sari-blue text-sari-blue rounded-lg hover:bg-sari-blue/5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          {t('contentsEditor.addImage') || 'Ajouter une image'}
        </button>
      </div>
    </div>
  );

  const renderSlidesField = (slides: any[], onChange: (val: any[]) => void) => (
    <div>
      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2">
        <Presentation className="w-4 h-4 text-sari-blue" />
        {t('contentsEditor.slides') || 'Slides du carrousel'}
      </label>
      <div className="space-y-4">
        {slides.map((slide, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500">Slide #{idx + 1}</span>
              <button
                onClick={() => onChange(slides.filter((_, i) => i !== idx))}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              <input type="text" value={slide.media || ''} onChange={(e) => {
                const newSlides = [...slides];
                newSlides[idx] = { ...newSlides[idx], media: e.target.value };
                onChange(newSlides);
              }} placeholder="URL image/vidéo" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm font-mono" />
              <input type="text" value={slide.title || ''} onChange={(e) => {
                const newSlides = [...slides];
                newSlides[idx] = { ...newSlides[idx], title: e.target.value };
                onChange(newSlides);
              }} placeholder="Titre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
              <input type="text" value={slide.subtitle || ''} onChange={(e) => {
                const newSlides = [...slides];
                newSlides[idx] = { ...newSlides[idx], subtitle: e.target.value };
                onChange(newSlides);
              }} placeholder="Sous-titre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
              <textarea value={slide.description || ''} onChange={(e) => {
                const newSlides = [...slides];
                newSlides[idx] = { ...newSlides[idx], description: e.target.value };
                onChange(newSlides);
              }} placeholder="Description" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={slide.cta || ''} onChange={(e) => {
                  const newSlides = [...slides];
                  newSlides[idx] = { ...newSlides[idx], cta: e.target.value };
                  onChange(newSlides);
                }} placeholder="Texte CTA" className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
                <input type="text" value={slide.ctaLink || ''} onChange={(e) => {
                  const newSlides = [...slides];
                  newSlides[idx] = { ...newSlides[idx], ctaLink: e.target.value };
                  onChange(newSlides);
                }} placeholder="Lien CTA" className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange([...slides, { media: '', mediaType: 'image', title: '', subtitle: '', description: '', cta: '', ctaLink: '' }])}
          className="w-full py-2 border-2 border-dashed border-sari-blue text-sari-blue rounded-lg hover:bg-sari-blue/5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          {t('contentsEditor.addSlide') || 'Ajouter un slide'}
        </button>
      </div>
    </div>
  );

  const renderSectionsField = (sections: any[], onChange: (val: any[]) => void) => (
    <div>
      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2">
        <MousePointerClick className="w-4 h-4 text-sari-blue" />
        {t('contentsEditor.sections') || 'Sections scrollables'}
      </label>
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500">Section #{idx + 1}</span>
              <button
                onClick={() => onChange(sections.filter((_, i) => i !== idx))}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              <input type="text" value={section.media || ''} onChange={(e) => {
                const newSections = [...sections];
                newSections[idx] = { ...newSections[idx], media: e.target.value };
                onChange(newSections);
              }} placeholder="URL image/vidéo" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm font-mono" />
              <input type="text" value={section.title || ''} onChange={(e) => {
                const newSections = [...sections];
                newSections[idx] = { ...newSections[idx], title: e.target.value };
                onChange(newSections);
              }} placeholder="Titre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
              <input type="text" value={section.subtitle || ''} onChange={(e) => {
                const newSections = [...sections];
                newSections[idx] = { ...newSections[idx], subtitle: e.target.value };
                onChange(newSections);
              }} placeholder="Sous-titre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
              <textarea value={section.description || ''} onChange={(e) => {
                const newSections = [...sections];
                newSections[idx] = { ...newSections[idx], description: e.target.value };
                onChange(newSections);
              }} placeholder="Description" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={section.cta || ''} onChange={(e) => {
                  const newSections = [...sections];
                  newSections[idx] = { ...newSections[idx], cta: e.target.value };
                  onChange(newSections);
                }} placeholder="Texte CTA" className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
                <input type="text" value={section.ctaLink || ''} onChange={(e) => {
                  const newSections = [...sections];
                  newSections[idx] = { ...newSections[idx], ctaLink: e.target.value };
                  onChange(newSections);
                }} placeholder="Lien CTA" className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue text-sm" />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange([...sections, { media: '', mediaType: 'image', title: '', subtitle: '', description: '', cta: '', ctaLink: '' }])}
          className="w-full py-2 border-2 border-dashed border-sari-blue text-sari-blue rounded-lg hover:bg-sari-blue/5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          {t('contentsEditor.addSection') || 'Ajouter une section'}
        </button>
      </div>
    </div>
  );

  // ==========================================
  // RENDU : VUE JSON CONTEXTUELLE
  // ==========================================
  const renderJsonView = () => {
    let jsonData: any;
    let title: string;

    if (jsonViewScope === 'all') {
      jsonData = contents;
      title = 'genericContent.json';
    } else {
      const content = contents.find(c => c.id === parseInt(jsonViewScope));
      jsonData = content || {};
      title = `${jsonViewScope}.json`;
    }

    return (
      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-sari-blue" />
              {title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {jsonViewScope === 'all'
                ? t('contentsEditor.fullJson') || 'Contenu complet du fichier'
                : t('contentsEditor.singleJson') || 'Contenu d\'un seul élément'}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={jsonViewScope}
              onChange={(e) => setJsonViewScope(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm"
            >
              <option value="all">📁 genericContent.json (Tous)</option>
              {contents.map(c => (
                <option key={c.id} value={c.id}>📄 {c.id}.json ({c.title})</option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={JSON.stringify(jsonData, null, 2)}
          onChange={(e) => {
            try {
              const newData = JSON.parse(e.target.value);
              if (jsonViewScope === 'all') {
                saveData(Array.isArray(newData) ? newData : []);
              } else {
                const newContents = contents.map(c => c.id === parseInt(jsonViewScope) ? newData : c);
                saveData(newContents);
              }
            } catch (err) {}
          }}
          className="w-full h-[600px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
        />
      </div>
    );
  };

  // ==========================================
  // RENDU PRINCIPAL
  // ==========================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sari-blue/10 rounded-xl flex items-center justify-center">
            <FileStack className="w-6 h-6 text-sari-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">
              {t('dataManager.contents') || 'Contenus'}
            </h1>
            <p className="text-sm text-gray-500">
              {contents.length} {t('dataManager.totalElements') || 'élément(s)'}
              {isDirty && <span className="text-orange-500 ml-2">• {t('dataManager.modified') || 'Modifié'}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadData} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('dataManager.reload') || 'Recharger'}
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('dataManager.export') || 'Exporter'}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? t('dataManager.viewList') || 'Vue Liste' : t('dataManager.viewJson') || 'Vue JSON'}
          </button>
          <button onClick={handleAddContent} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('dataManager.add') || 'Ajouter'}
          </button>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="mb-6">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${t('dataManager.search') || 'Rechercher'}...`}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue"
            />
          </div>
        </div>
      )}

      {viewMode === 'json' ? renderJsonView() : viewMode === 'edit' ? renderEditView() : renderListView()}
    </div>
  );
}