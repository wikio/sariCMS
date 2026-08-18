// app/[locale]/recherche/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, RotateCcw, Package, Calendar, Newspaper, Layers, SearchX } from 'lucide-react';
import { getProducts, getEvents, getNews } from '@/lib/data';
import type { Product, Event, News } from '@/types';
import ProductCard from '@/components/cards/ProductCard';
import EventCard from '@/components/cards/EventCard';
import NewsCard from '@/components/cards/NewsCard';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function SearchPage() {
  const locale = useLocale();
  const t = useTranslations('pages.search');
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeQuery, setActiveQuery] = useState(searchParams.get('q') || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [contentType, setContentType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [p, e, n] = await Promise.all([
        getProducts(locale),
        getEvents(locale),
        getNews(locale),
      ]);
      setProducts(p);
      setEvents(e);
      setNews(n);
      setIsLoading(false);
    };
    loadData();
  }, [locale]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchQuery(q);
    setActiveQuery(q);
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [contentType, selectedCategory, sortBy]);

  const filteredResults = useMemo(() => {
    const lowerQuery = activeQuery.toLowerCase().trim();
    let filteredProducts = products;
    let filteredEvents = events;
    let filteredNews = news;

    if (lowerQuery) {
      filteredProducts = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(lowerQuery)) ||
        (p.category && p.category.toLowerCase().includes(lowerQuery)) ||
        (p.shortDesc && p.shortDesc.toLowerCase().includes(lowerQuery))
      );
      filteredEvents = events.filter(e =>
        (e.title && e.title.toLowerCase().includes(lowerQuery)) ||
        (e.type && e.type.toLowerCase().includes(lowerQuery)) ||
        (e.shortDesc && e.shortDesc.toLowerCase().includes(lowerQuery))
      );
      filteredNews = news.filter(n =>
        (n.title && n.title.toLowerCase().includes(lowerQuery)) ||
        (n.category && n.category.toLowerCase().includes(lowerQuery)) ||
        (n.shortDesc && n.shortDesc.toLowerCase().includes(lowerQuery))
      );
    }

    if (contentType !== 'all') {
      if (contentType !== 'products') filteredProducts = [];
      if (contentType !== 'events') filteredEvents = [];
      if (contentType !== 'news') filteredNews = [];
    }

    if (selectedCategory !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
      filteredEvents = filteredEvents.filter(e => e.type === selectedCategory || (e as any).category === selectedCategory);
      filteredNews = filteredNews.filter(n => n.category === selectedCategory);
    }

    if (sortBy === 'name') {
      filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      filteredEvents.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      filteredNews.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return { products: filteredProducts, events: filteredEvents, news: filteredNews };
  }, [products, events, news, activeQuery, contentType, selectedCategory, sortBy]);

  const totalResults = filteredResults.products.length + filteredResults.events.length + filteredResults.news.length;
  const totalPages = Math.ceil(totalResults / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    filteredResults.products.forEach(p => { if (p.category) cats.add(p.category); });
    filteredResults.events.forEach(e => { if (e.type) cats.add(e.type); });
    filteredResults.news.forEach(n => { if (n.category) cats.add(n.category); });
    return Array.from(cats).sort();
  }, [filteredResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveQuery(searchQuery.trim());
      setCurrentPage(1);
      router.push(`/${locale}/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const resetFilters = () => {
    setContentType('all');
    setSelectedCategory('all');
    setSortBy('relevance');
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sari-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('loading', { defaultMessage: 'Chargement...' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-44 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        <Breadcrumb items={[
          { label: t('home', { defaultMessage: 'Accueil' }), href: '/' },
          { label: t('title') }
        ]} />

        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-6 md:p-8 mb-8 rounded-xl">
          <h1 className="text-3xl md:text-4xl font-bold text-sari-dark dark:text-white mb-6">{t('title')}</h1>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('placeholder')}
                className="w-full py-4 pl-12 pr-4 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-lime outline-none transition-colors text-lg rounded-lg"
              />
            </div>
            <button type="submit" className="bg-sari-lime text-sari-dark px-8 py-4 font-bold hover:bg-sari-lime/90 transition-colors flex items-center justify-center gap-2 rounded-lg">
              <Search className="w-5 h-5" />
              {t('searchButton')}
            </button>
          </form>
          {activeQuery && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{t('resultsFor')} :</span>
              <span className="bg-sari-lime/20 text-sari-dark dark:text-sari-lime px-3 py-1 font-semibold rounded">
                &quot;{activeQuery}&quot;
              </span>
              <span className="ml-auto">
                {totalResults} {t('result')}{totalResults > 1 ? 's' : ''} {t('found')}
              </span>
            </div>
          )}
        </div>

        {!activeQuery && (
          <div className="text-center py-16 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
            <Search className="w-24 h-24 text-sari-blue/30 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('startSearching')}</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">{t('startSearchingDesc')}</p>
          </div>
        )}

        {activeQuery && (
          <>
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-6 mb-8 rounded-xl">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">{t('contentType')}</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'all', label: t('all'), icon: Layers },
                      { value: 'products', label: t('products'), icon: Package },
                      { value: 'events', label: t('events'), icon: Calendar },
                      { value: 'news', label: t('news'), icon: Newspaper }
                    ].map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setContentType(type.value)}
                          className={`px-4 py-2 border-2 font-medium transition-all flex items-center gap-2 rounded-lg ${
                            contentType === type.value
                              ? 'border-sari-lime bg-sari-lime/10 text-sari-dark dark:text-sari-lime'
                              : 'border-gray-300 dark:border-gray-700 hover:border-sari-lime/50 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {allCategories.length > 0 && (
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">{t('category')}</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-lime outline-none transition-colors rounded-lg"
                    >
                      <option value="all">{t('allCategories')}</option>
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="w-full lg:w-48">
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">{t('sortBy')}</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-lime outline-none transition-colors rounded-lg"
                  >
                    <option value="relevance">{t('relevance')}</option>
                    <option value="name">{t('nameAsc')}</option>
                  </select>
                </div>
                {(contentType !== 'all' || selectedCategory !== 'all' || sortBy !== 'relevance') && (
                  <button onClick={resetFilters} className="text-sari-blue hover:underline font-semibold flex items-center gap-2 self-end">
                    <RotateCcw className="w-4 h-4" />
                    {t('reset')}
                  </button>
                )}
              </div>
            </div>

            {totalResults === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <SearchX className="w-24 h-24 text-gray-300 dark:text-gray-700 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('noResults')}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{t('noResultsDesc')}</p>
                <button onClick={resetFilters} className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 rounded-lg">
                  <RotateCcw className="w-4 h-4" />
                  {t('resetFilters')}
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {filteredResults.products.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-2 mb-6">
                      <Package className="w-6 h-6 text-sari-lime" />
                      {t('products')} ({filteredResults.products.length})
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredResults.products.slice(startIndex, endIndex).map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </section>
                )}
                {filteredResults.events.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-2 mb-6">
                      <Calendar className="w-6 h-6 text-sari-lime" />
                      {t('events')} ({filteredResults.events.length})
                    </h2>
                    <div className="space-y-4">
                      {filteredResults.events.slice(startIndex, endIndex).map((event) => (
                        <EventCard key={event.id} event={event} variant="horizontal" />
                      ))}
                    </div>
                  </section>
                )}
                {filteredResults.news.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-2 mb-6">
                      <Newspaper className="w-6 h-6 text-sari-lime" />
                      {t('news')} ({filteredResults.news.length})
                    </h2>
                    <div className="space-y-4">
                      {filteredResults.news.slice(startIndex, endIndex).map((item) => (
                        <NewsCard key={item.id} news={item} variant="horizontal" />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </>
        )}
      </div>
    </div>
  );
}