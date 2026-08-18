// app/[locale]/admin/events/[id]/page.tsx
'use client';

import { useState, useEffect, DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft, Save, Eye, Calendar, MapPin, Users, Tag,
  Type, Clock, GripVertical, Trash2, Plus, FileText
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import AdminHtmlEditor from '@/components/admin/AdminHtmlEditor';
import AdminImageUploader from '@/components/admin/AdminImageUploader';
import type { EventItem, EventProgramItem } from '@/types';

export default function AdminEventEditPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale() as string;
  const t = useTranslations('admin.events');
  const { showToast } = useToast();

  const eventId = params.id as string;
  const isNew = eventId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<EventItem>({
    id: isNew ? Date.now().toString() : '',
    title: '',
    shortDesc: '',
    fullContent: '<p>Détails de l\'événement...</p>',
    seoTitle: '',
    seoDescription: '',
    program: [],
    date: new Date().toISOString().split('T')[0],
    type: 'Salon',
    location: '',
    targetAudience: '',
    category: '',
    image: '',
    status: 'draft'
  });

  useEffect(() => {
    if (!isNew) {
      const stored = localStorage.getItem(`sari_admin_events_${locale}`);
      if (stored) {
        const events: EventItem[] = JSON.parse(stored);
        const found = events.find(e => e.id === eventId);
        if (found) {
          setFormData(found);
        } else {
          showToast(t('notFound'), 'error');
          router.push(`/${locale}/admin/events`);
        }
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isNew, eventId, locale, router, showToast]);

  const handleChange = (field: keyof EventItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- Gestion du Programme (Drag & Drop) ---
  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const newProgram = [...formData.program];
    const [draggedItem] = newProgram.splice(draggedIndex, 1);
    newProgram.splice(dropIndex, 0, draggedItem);
    setFormData(prev => ({ ...prev, program: newProgram }));
    setDraggedIndex(null);
  };

  const addProgramItem = () => {
    const newItem: EventProgramItem = {
      id: `p-${Date.now()}`,
      time: '09:00',
      title: t('newSession')
    };
    setFormData(prev => ({ ...prev, program: [...prev.program, newItem] }));
  };

  const updateProgramItem = (id: string, field: keyof EventProgramItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      program: prev.program.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const removeProgramItem = (id: string) => {
    setFormData(prev => ({ ...prev, program: prev.program.filter(item => item.id !== id) }));
  };

  const handleSave = (status: 'published' | 'draft') => {
    setSaving(true);
    try {
      const stored = localStorage.getItem(`sari_admin_events_${locale}`);
      let events: EventItem[] = stored ? JSON.parse(stored) : [];
      const updatedEvent = { ...formData, status };

      if (isNew) {
        events = [updatedEvent, ...events];
      } else {
        events = events.map(e => e.id === eventId ? updatedEvent : e);
      }

      localStorage.setItem(`sari_admin_events_${locale}`, JSON.stringify(events));
      showToast(status === 'published' ? t('saveSuccess') : t('draftSaved'), 'success');
      setTimeout(() => router.push(`/${locale}/admin/events`), 1000);
    } catch (err) {
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
    <div className="py-0">
      {/* Barre d'actions supérieure */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 bg-gray-50 dark:bg-[#0a0a0a] py-4 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/admin/events`} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">
              {formData.title || (isNew ? t('newEvent') : t('editEvent'))}
            </h1>
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
          {/* Informations de base */}
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
                className="w-full px-4 py-2.5 text-lg font-medium border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue focus:ring-1 focus:ring-sari-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1.5">{t('shortDesc')}</label>
              <textarea
                value={formData.shortDesc}
                onChange={(e) => handleChange('shortDesc', e.target.value)}
                placeholder={t('shortDescPlaceholder')}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue resize-none"
              />
            </div>
          </div>

          {/* ✅ Image avec uploader drag & drop */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <AdminImageUploader
              value={formData.image}
              onChange={(val) => handleChange('image', val)}
              label={t('coverImage')}
            />
          </div>

          {/* ✅ Éditeur WYSIWYG avancé */}
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

          {/* Programme (Drag & Drop) */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-sari-dark dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-sari-blue" /> {t('program')}
              </h3>
              <button
                onClick={addProgramItem}
                className="px-3 py-1.5 bg-sari-blue/10 text-sari-blue hover:bg-sari-blue/20 rounded-lg text-sm font-semibold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> {t('addSession')}
              </button>
            </div>
            <div className="space-y-2">
              {formData.program.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`flex items-center gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-[#111111] transition-all ${
                    draggedIndex === index ? 'opacity-50 border-sari-blue border-dashed' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-sari-blue p-1">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={item.time}
                        onChange={(e) => updateProgramItem(item.id, 'time', e.target.value)}
                        placeholder="09:00"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue"
                      />
                    </div>
                    <div className="col-span-8">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateProgramItem(item.id, 'title', e.target.value)}
                        placeholder={t('sessionTitle')}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded outline-none focus:border-sari-blue"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeProgramItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {formData.program.length === 0 && (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('noSessions')}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
              <GripVertical className="w-3 h-3" /> {t('dragDropHint')}
            </p>
          </div>
        </div>

        {/* COLONNE DROITE : Métadonnées et Infos Pratiques */}
        <div className="space-y-6">
          {/* Informations Pratiques */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-sari-dark dark:text-white flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <MapPin className="w-4 h-4 text-sari-blue" /> {t('practicalInfo')}
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('eventDate')}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('eventType')}</label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              >
                <option>Salon</option>
                <option>Formation</option>
                <option>Conférence</option>
                <option>Portes Ouvertes</option>
                <option>Webinaire</option>
                <option>Atelier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('location')}</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={t('locationPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> {t('targetAudience')}
              </label>
              <input
                type="text"
                value={formData.targetAudience}
                onChange={(e) => handleChange('targetAudience', e.target.value)}
                placeholder={t('targetAudiencePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {t('category')}
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder={t('categoryPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
            </div>
          </div>

          {/* SEO Meta */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-sari-dark dark:text-white flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <Eye className="w-4 h-4 text-sari-blue" /> {t('seoMeta')}
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('seoTitle')}</label>
              <input
                type="text"
                value={formData.seoTitle}
                onChange={(e) => handleChange('seoTitle', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              />
              <div className="text-right text-xs text-gray-400 mt-1">{formData.seoTitle.length}/60</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('seoDescription')}</label>
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