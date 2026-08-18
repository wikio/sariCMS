// app/[locale]/admin/news/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft, Save, Eye, Clock, User, Tag, X, Plus,
  Calendar, Globe, Type, Image as ImageIcon, Search, ChevronDown, FileText
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import AdminHtmlEditor from '@/components/admin/AdminHtmlEditor';
import AdminImageUploader from '@/components/admin/AdminImageUploader';

const EXISTING_TAGS = ['Innovation', 'Santé', 'Technologie', 'IA', 'Diagnostic', 'Équipement', 'Formation', 'Événement', 'Chirurgie', 'Pédiatrie'];

export default function AdminNewsEditPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.news');
  const { showToast } = useToast();

  const isNew = params.id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Innovation',
    shortDesc: '',
    fullContent: '<p>Commencez à rédiger votre article ici...</p>',
    authorName: '',
    authorRole: '',
    authorBio: '',
    date: new Date().toISOString().split('T')[0],
    readTime: 3,
    tags: [] as string[],
    slug: '',
    seoTitle: '',
    seoDescription: '',
    image: '',
    status: 'draft' as 'published' | 'draft'
  });

  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  useEffect(() => {
    if (!isNew) {
      const stored = localStorage.getItem('sari_admin_news');
      if (stored) {
        try {
          const news = JSON.parse(stored);
          const found = news.find((n: any) => n.id === params.id);
          if (found) setFormData(found);
        } catch (e) {}
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isNew, params.id]);

  // Calcul automatique du temps de lecture
  useEffect(() => {
    const textOnly = formData.fullContent.replace(/<[^>]*>/g, '').trim();
    const wordCount = textOnly.split(/\s+/).filter(w => w.length > 0).length;
    const calculatedTime = Math.max(1, Math.ceil(wordCount / 200));
    if (Math.abs(calculatedTime - formData.readTime) > 1 || (formData.readTime === 3 && wordCount > 0)) {
      setFormData(prev => ({ ...prev, readTime: calculatedTime }));
    }
  }, [formData.fullContent]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = (tag: string) => {
    const cleanTag = tag.trim();
    if (cleanTag && !formData.tags.includes(cleanTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, cleanTag] }));
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const filteredSuggestions = EXISTING_TAGS.filter(
    tag => tag.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags.includes(tag)
  );

  const handleSave = async (status: 'published' | 'draft') => {
    setSaving(true);
    try {
      const stored = localStorage.getItem('sari_admin_news');
      let news = stored ? JSON.parse(stored) : [];
      const dataToSave = { ...formData, status, id: isNew ? Date.now().toString() : params.id };

      if (isNew) {
        news = [dataToSave, ...news];
      } else {
        news = news.map((n: any) => n.id === params.id ? dataToSave : n);
      }

      localStorage.setItem('sari_admin_news', JSON.stringify(news));
      showToast(status === 'published' ? t('saveSuccess') : t('draftSaved'), 'success');
      setTimeout(() => router.push(`/${locale}/admin/news`), 1000);
    } catch (error) {
      showToast(t('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-sari-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* En-tête avec actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 bg-gray-50 dark:bg-[#0a0a0a] py-4 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/admin/news`} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">
              {isNew ? t('newTitle') : t('editTitle')}
            </h1>
            <p className="text-sm text-gray-500">{formData.title || t('untitled')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-sari-dark dark:text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" /> {t('draftBtn')}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="btn-primary text-white px-4 py-2 font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : <Eye className="w-4 h-4" />} {t('publishBtn')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE : Contenu Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte : Informations de base */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1.5 flex items-center gap-2">
                <Type className="w-4 h-4 text-sari-blue" /> {t('titleField')} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="w-full px-4 py-3 text-lg font-medium border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue focus:ring-1 focus:ring-sari-blue transition-all"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1.5">{t('category')}</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                >
                  <option>Innovation</option>
                  <option>Diagnostic</option>
                  <option>Chirurgie</option>
                  <option>Événement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sari-blue" /> {t('date')}
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1.5">{t('shortDesc')}</label>
              <textarea
                value={formData.shortDesc}
                onChange={(e) => handleChange('shortDesc', e.target.value)}
                placeholder={t('shortDescPlaceholder')}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none transition-all"
              />
            </div>
          </div>

          {/* ✅ Carte : Image avec uploader drag & drop */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <AdminImageUploader
              value={formData.image}
              onChange={(val) => handleChange('image', val)}
              label={t('featuredImage')}
            />
          </div>

          {/* ✅ Carte : Éditeur WYSIWYG avancé */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sari-blue" /> {t('fullContent')}
            </label>
            <AdminHtmlEditor
              value={formData.fullContent}
              onChange={(val) => handleChange('fullContent', val)}
              placeholder={t('fullContentPlaceholder')}
              height="450px"
            />
          </div>

          {/* Carte : Tags */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-sari-blue" /> {t('tags')}
            </label>
            <div className="relative">
              <div className="flex flex-wrap gap-2 p-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] rounded-lg focus-within:border-sari-blue focus-within:ring-1 focus-within:ring-sari-blue transition-all">
                {formData.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sari-blue/10 text-sari-blue text-sm font-medium rounded-md">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                    if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
                      removeTag(formData.tags[formData.tags.length - 1]);
                    }
                  }}
                  onFocus={() => setShowTagSuggestions(true)}
                  placeholder={formData.tags.length === 0 ? t('addTag') : ""}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-1 dark:text-white"
                />
              </div>
              {showTagSuggestions && tagInput && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredSuggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => addTag(suggestion)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-sari-blue/10 dark:hover:bg-sari-blue/20 text-sari-dark dark:text-gray-200 flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-sari-blue" /> {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : Sidebar (Métadonnées) */}
        <div className="space-y-6">
          {/* Carte : Auteur */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm space-y-4">
            <h3 className="font-semibold text-sari-dark dark:text-white flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <User className="w-4 h-4 text-sari-blue" /> {t('authorInfo')}
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('authorName')}</label>
              <input
                type="text"
                value={formData.authorName}
                onChange={(e) => handleChange('authorName', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('authorRole')}</label>
              <input
                type="text"
                value={formData.authorRole}
                onChange={(e) => handleChange('authorRole', e.target.value)}
                placeholder={t('authorRolePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('authorBio')}</label>
              <textarea
                value={formData.authorBio}
                onChange={(e) => handleChange('authorBio', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none"
              />
            </div>
          </div>

          {/* Carte : Durée de lecture */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {t('readTimeLabel')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={formData.readTime}
                onChange={(e) => handleChange('readTime', parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
              <span className="text-xs text-gray-500">{t('autoCalculated')}</span>
            </div>
          </div>

          {/* Carte : SEO & Méta-données */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm space-y-4">
            <h3 className="font-semibold text-sari-dark dark:text-white flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <Globe className="w-4 h-4 text-sari-blue" /> {t('seoMeta')}
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('slug')}</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 whitespace-nowrap">{locale}/news/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('metaTitle')}</label>
              <input
                type="text"
                value={formData.seoTitle}
                onChange={(e) => handleChange('seoTitle', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
              <div className="text-right text-xs text-gray-400 mt-1">{formData.seoTitle.length}/60</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('metaDescription')}</label>
              <textarea
                value={formData.seoDescription}
                onChange={(e) => handleChange('seoDescription', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none"
              />
              <div className="text-right text-xs text-gray-400 mt-1">{formData.seoDescription.length}/160</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}