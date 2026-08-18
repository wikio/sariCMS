// app/[locale]/admin/news/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit2, Trash2, CheckSquare, Square,
  Calendar, User, Tag, Settings2, FileText, Clock, Download, Code, Table
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

interface NewsItem {
  id: string;
  title: string;
  category: string;
  authorName?: string;
  date: string;
  status: 'published' | 'draft';
  tags?: string[];
  readTime?: number;
  translations?: {
    fr?: { title: string; shortDesc: string; fullContent: string };
    en?: { title: string; shortDesc: string; fullContent: string };
    ar?: { title: string; shortDesc: string; fullContent: string };
  };
}

export default function AdminNewsListPage() {
  const locale = useLocale();
  const t = useTranslations('admin.news');
  const { showToast } = useToast();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [langFilter, setLangFilter] = useState<'all' | 'fr' | 'en' | 'ar'>('all'); // ✅ Nouveau filtre
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');
  const [visibleColumns, setVisibleColumns] = useState({
    category: true, author: true, date: true, tags: true, readTime: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const stored = localStorage.getItem('sari_admin_news');
      if (stored) {
        setNews(JSON.parse(stored));
      } else {
        const demoData: NewsItem[] = [
          { 
            id: '1', title: 'L\'IA dans le diagnostic médical en 2024', category: 'Innovation', authorName: 'Dr. Marie Laurent', date: '2024-10-15', status: 'published', tags: ['IA', 'Diagnostic'], readTime: 5,
            translations: { fr: { title: 'L\'IA dans le diagnostic...', shortDesc: '', fullContent: '' }, en: { title: 'AI in diagnostics...', shortDesc: '', fullContent: '' } }
          },
          { 
            id: '2', title: 'Nouveaux équipements d\'imagerie SARI', category: 'Produits', authorName: 'Karim Benali', date: '2024-10-12', status: 'draft', tags: ['Imagerie'], readTime: 3,
            translations: { fr: { title: 'Nouveaux équipements...', shortDesc: '', fullContent: '' } }
          },
        ];
        setNews(demoData);
        localStorage.setItem('sari_admin_news', JSON.stringify(demoData));
      }
    } catch (e) {
      showToast('Erreur de chargement', 'error');
    }
  };

  const filteredNews = news.filter(item => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || (item.authorName && item.authorName.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    // ✅ Filtrage par langue : vérifie si la traduction existe pour la langue sélectionnée
    const matchLang = langFilter === 'all' || (item.translations && item.translations[langFilter] && item.translations[langFilter].title);
    return matchSearch && matchStatus && matchLang;
  });

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredNews.length && filteredNews.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNews.map(n => n.id)));
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
      const newData = news.filter(n => n.id !== id);
      setNews(newData);
      localStorage.setItem('sari_admin_news', JSON.stringify(newData));
      showToast('Article supprimé avec succès', 'success');
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(news, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `news_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Fichier JSON exporté !', 'success');
  };

  return (
    <div className="py-0 ">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">Actualités & Blog</h1>
            <p className="text-sm text-gray-500">{news.length} article(s)</p>
          </div>
          <Link href={`/${locale}/admin/news/new`} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvel article
          </Link>
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Rechercher par titre ou auteur..." 
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
            <div className="relative">
              <button 
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Settings2 className="w-4 h-4" /> Colonnes
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-20 p-2">
                  {Object.entries(visibleColumns).map(([key, isVisible]) => (
                    <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer text-sm capitalize">
                      <input 
                        type="checkbox" 
                        checked={isVisible} 
                        onChange={() => setVisibleColumns(prev => ({...prev, [key]: !prev[key as keyof typeof prev]}))}
                        className="rounded text-sari-blue focus:ring-sari-blue"
                      />
                      {key === 'readTime' ? 'Temps de lecture' : key === 'date' ? 'Date' : key}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleExport} className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Download className="w-4 h-4" /> Exporter
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
              {viewMode === 'json' ? 'Vue Liste' : 'Vue JSON'}
            </button>
          </div>
        </div>

        {viewMode === 'json' ? (
          <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
            <textarea
              value={JSON.stringify(news, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setNews(parsed);
                  localStorage.setItem('sari_admin_news', JSON.stringify(parsed));
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
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleAll}>
                        {selectedIds.size === filteredNews.length && filteredNews.length > 0 ? <CheckSquare className="w-4 h-4 text-sari-blue" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="px-4 py-3">Titre de l'article</th>
                    {visibleColumns.category && <th className="px-4 py-3">Catégorie</th>}
                    {visibleColumns.author && <th className="px-4 py-3">Auteur</th>}
                    {visibleColumns.date && <th className="px-4 py-3">Date</th>}
                    {visibleColumns.readTime && <th className="px-4 py-3 text-center">Lecture</th>}
                    <th className="px-4 py-3 text-center">Statut</th>
                    {/* ✅ Nouvelle colonne pour les langues */}
                    <th className="px-4 py-3 text-center">Langues</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredNews.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelection(item.id)}>
                          {selectedIds.has(item.id) ? <CheckSquare className="w-4 h-4 text-sari-blue" /> : <Square className="w-4 h-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sari-dark dark:text-white">{item.title}</div>
                      </td>
                      {visibleColumns.category && (
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-sari-blue/10 text-sari-blue rounded-md text-xs font-medium">{item.category}</span>
                        </td>
                      )}
                      {visibleColumns.author && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">
                              {item.authorName ? item.authorName.charAt(0) : '?'}
                            </div>
                            <span className="text-gray-600 dark:text-gray-400">{item.authorName || 'Inconnu'}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="px-4 py-3 text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {item.date}
                        </td>
                      )}
                      {visibleColumns.readTime && (
                        <td className="px-4 py-3 text-center text-gray-500 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> {item.readTime || 0} min
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'published' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {item.status === 'published' ? 'Publié' : 'Brouillon'}
                        </span>
                      </td>
                      {/* ✅ Cellule des icônes de langue cliquables */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {['fr', 'en', 'ar'].map(lang => {
                            const hasTranslation = item.translations && item.translations[lang as keyof typeof item.translations] && (item.translations[lang as keyof typeof item.translations] as any)?.title;
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
                          <Link href={`/${locale}/admin/news/${item.id}`} className="p-1.5 text-gray-500 hover:text-sari-blue hover:bg-sari-blue/10 rounded-lg transition-colors" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredNews.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Aucun article ne correspond à vos critères.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}