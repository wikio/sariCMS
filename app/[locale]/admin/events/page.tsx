// app/[locale]/admin/events/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import {
  Search, Plus, Calendar, MapPin, Users, Eye, Edit2, Trash2,
  Code, Table, Download
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';

interface EventItem {
  id: string;
  title: string;
  shortDesc: string;
  fullContent: string;
  seoTitle: string;
  seoDescription: string;
  program: any[];
  date: string;
  type: string;
  location: string;
  targetAudience: string;
  category: string;
  image: string;
  status: 'published' | 'draft';
  translations?: {
    fr?: { title: string; shortDesc: string; fullContent: string };
    en?: { title: string; shortDesc: string; fullContent: string };
    ar?: { title: string; shortDesc: string; fullContent: string };
  };
}

export default function AdminEventsListPage() {
  const params = useParams();
  const locale = useLocale() as string;
  const { showToast } = useToast();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [langFilter, setLangFilter] = useState<'all' | 'fr' | 'en' | 'ar'>('all'); // ✅ Nouveau filtre
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const stored = localStorage.getItem(`sari_admin_events_${locale}`);
      if (stored) {
        setEvents(JSON.parse(stored));
      } else {
        const demoData: EventItem[] = [
          {
            id: '1',
            title: 'Salon Médical International 2024',
            shortDesc: 'Le plus grand rassemblement des professionnels de santé.',
            fullContent: '<p>Détails complets du salon...</p>',
            seoTitle: 'Salon Médical 2024',
            seoDescription: 'Retrouvez-nous au salon.',
            program: [],
            date: '2024-11-15',
            type: 'Salon',
            location: 'Pins Maritimes, Alger',
            targetAudience: 'Médecins, Distributeurs',
            category: 'Événement Grand Public',
            image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
            status: 'published',
            translations: { 
              fr: { title: 'Salon Médical International 2024', shortDesc: '', fullContent: '' },
              en: { title: 'International Medical Fair 2024', shortDesc: '', fullContent: '' }
            }
          }
        ];
        setEvents(demoData);
        localStorage.setItem(`sari_admin_events_${locale}`, JSON.stringify(demoData));
      }
    } catch (e) {
      showToast('Erreur de chargement', 'error');
    }
  };

  const saveEvents = (newEvents: EventItem[]) => {
    setEvents(newEvents);
    localStorage.setItem(`sari_admin_events_${locale}`, JSON.stringify(newEvents));
    showToast('Événements sauvegardés', 'success');
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cet événement ?')) {
      saveEvents(events.filter(e => e.id !== id));
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Fichier exporté', 'success');
  };

  const filteredEvents = events.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    // ✅ Filtrage par langue
    const matchLang = langFilter === 'all' || (e.translations && e.translations[langFilter] && e.translations[langFilter].title);
    return matchSearch && matchStatus && matchLang;
  });

  return (
    <div className="container py-0 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-sari-dark dark:text-white">Événements</h1>
          <p className="text-sm text-gray-500">{events.length} événement(s) au total</p>
        </div>
        <Link href={`/${locale}/admin/events/new`} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvel événement
        </Link>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Rechercher par titre ou lieu..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* ✅ Sélecteur de langue ajouté */}
          <select 
            value={langFilter} 
            onChange={(e) => setLangFilter(e.target.value as 'all' | 'fr' | 'en' | 'ar')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm outline-none focus:border-sari-blue"
          >
            <option value="all">Toutes les langues</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
            <option value="ar">🇸🇦 العربية</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm outline-none focus:border-sari-blue"
          >
            <option value="all">Tous les statuts</option>
            <option value="published">Publié</option>
            <option value="draft">Brouillon</option>
          </select>
          <button onClick={handleExport} className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')} className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800">
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? 'Liste' : 'JSON'}
          </button>
        </div>
      </div>

      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <textarea
            value={JSON.stringify(events, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) saveEvents(parsed);
              } catch (err) {}
            }}
            className="w-full h-[500px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-[#111111] text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Titre</th>
                  <th className="px-4 py-3">Date & Lieu</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  {/* ✅ Nouvelle colonne pour les langues */}
                  <th className="px-4 py-3 text-center">Langues</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredEvents.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sari-dark dark:text-white">{event.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{event.shortDesc}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" /> {event.date}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-sari-blue/10 text-sari-blue rounded-md text-xs font-medium">
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        event.status === 'published' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {event.status === 'published' ? 'Publié' : 'Brouillon'}
                      </span>
                    </td>
                    {/* ✅ Cellule des icônes de langue cliquables */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {['fr', 'en', 'ar'].map(lang => {
                          const hasTranslation = event.translations && event.translations[lang as keyof typeof event.translations] && (event.translations[lang as keyof typeof event.translations] as any)?.title;
                          return (
                            <Link
                              key={lang}
                              href={`/${locale}/admin/translations`}
                              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                                hasTranslation 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                              }`}
                              title={hasTranslation ? `Traduit en ${lang.toUpperCase()}` : `Non traduit en ${lang.toUpperCase()}`}
                            >
                              {lang.toUpperCase()}
                            </Link>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/${locale}/admin/events/${event.id}`} className="p-1.5 text-gray-500 hover:text-sari-blue hover:bg-sari-blue/10 rounded-lg transition-colors" title="Modifier">
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(event.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun événement trouvé.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}