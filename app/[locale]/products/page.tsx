// app/[locale]/produits/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Search, X, Filter, Package, CheckCircle, Clock, RotateCcw, Grid3X3, List, Euro, Folder } from 'lucide-react';
import { getProducts } from '@/lib/data';
import type { Product } from '@/types';
import ProductCard from '@/components/cards/ProductCard';
import Pagination from '@/components/ui/Pagination';
import Tag from '@/components/shared/Tag';
import Breadcrumb from '@/components/ui/Breadcrumb';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';

export default function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  // ✅ Récupérer la locale depuis les params
  const [localeState, setLocaleState] = useState('');
  useEffect(() => {
    params.then(p => setLocaleState(p.locale));
  }, [params]);

  const locale = localeState || 'fr';

  
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [availability, setAvailability] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  const itemsPerPage = 9;

  const t = useTranslations('pages.products');
  const tNav = useTranslations('common.nav'); // ✅ Pour les éléments de navigation

  useEffect(() => {
    const loadProducts = async () => {
      const data = await getProducts(locale);
      setProducts(data);
    };
    loadProducts();
  }, [locale]);

  const parsePrice = (priceStr: string): number => {
    if (!priceStr || priceStr.toLowerCase().includes('devis')) return 0;
    const cleanStr = priceStr.replace(/[^0-9.,]/g, '').replace(',', '.');
    return parseFloat(cleanStr) || 0;
  };

  const categories = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category || 'Autre';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    return [
      { name: 'Tous', count: products.length },
      ...Object.entries(categoryMap).map(([name, count]) => ({ name, count }))
    ];
  }, [products]);

  const priceStats = useMemo(() => {
    const prices = products.map(p => parsePrice(p.price)).filter(p => p > 0);
    return {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 10000
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.shortDesc?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory !== 'Tous') {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    result = result.filter(p => {
      const price = parsePrice(p.price);
      if (price === 0) return true;
      return price >= priceRange.min && price <= priceRange.max;
    });
    
    if (availability === 'inStock') {
      result = result.filter(p => p.inStock !== false);
    } else if (availability === 'outOfStock') {
      result = result.filter(p => p.inStock === false);
    }
    
    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name-desc':
        result.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'price-asc':
        result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
        break;
      case 'price-desc':
        result.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
        break;
      default:
        break;
    }
    
    return result;
  }, [products, searchQuery, selectedCategory, priceRange, availability, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentItems = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, priceRange, availability, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Tous');
    setPriceRange({ min: priceStats.min, max: priceStats.max });
    setAvailability('all');
    setSortBy('default');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCategory !== 'Tous') count++;
    if (priceRange.min > priceStats.min || priceRange.max < priceStats.max) count++;
    if (availability !== 'all') count++;
    if (sortBy !== 'default') count++;
    return count;
  }, [searchQuery, selectedCategory, priceRange, availability, sortBy, priceStats]);

  if (products.length === 0) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6 rounded-full">
          <Package className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('updating')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          {t('updatingDesc')}
        </p>
        <Link href={`/${locale}`} className="btn-primary text-white px-6 py-3 inline-block rounded-lg">
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return (
    <PageVisibilityGuard visibilityKey="module.products">
    <div className="pt-32 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
      <div className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-6 py-8">
            <Breadcrumb items={[
            { label: tNav('home', { defaultMessage: 'Accueil' }), href: '/' },
            { label: tNav('products', { defaultMessage: 'Produits' }), href: '/produits' }
            ]} />
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-4">
            <div>
              <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">
                {t('catalog')}
              </span>
              <h1 className="text-4xl font-bold text-sari-dark dark:text-white mt-2">
                {t('title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {filteredProducts.length} {t('product', { defaultMessage: 'produit' })}
                {filteredProducts.length > 1 ? 's' : ''}{' '}
                {t('found', { defaultMessage: 'trouvé' })}
                {filteredProducts.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          <aside className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl sticky top-32 rounded-xl">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2">
                  <Filter className="w-5 h-5 text-sari-blue" />
                  {t('filters')}
                  {activeFiltersCount > 0 && (
                    <span className="px-2 py-0.5 bg-sari-blue text-white text-xs font-bold rounded-full">{activeFiltersCount}</span>
                  )}
                </h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-sm text-sari-blue hover:underline font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('reset')}
                  </button>
                )}
              </div>
              <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">
                    {t('search')}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none transition-colors rounded-lg"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-sari-blue"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">
                    {t('categories')}
                  </label>
                  <div className="space-y-2">
                    {categories.map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 border transition-all text-left rounded-lg ${
                          selectedCategory === cat.name
                            ? 'border-sari-blue bg-sari-blue/10 text-sari-blue'
                            : 'border-gray-200 dark:border-gray-700 hover:border-sari-blue/50 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <span className="font-medium text-sm">{cat.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          selectedCategory === cat.name
                            ? 'bg-sari-blue text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {cat.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">
                    {t('availability')}
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: t('allProducts'), icon: Package },
                      { value: 'inStock', label: t('inStock'), icon: CheckCircle },
                      { value: 'outOfStock', label: t('onQuote'), icon: Clock }
                    ].map(option => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setAvailability(option.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 border transition-all text-left rounded-lg ${
                            availability === option.value
                              ? 'border-sari-blue bg-sari-blue/10 text-sari-blue'
                              : 'border-gray-200 dark:border-gray-700 hover:border-sari-blue/50 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-3 uppercase tracking-wider">
                    {t('priceRange')}
                  </label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('min')}</label>
                        <input
                          type="number"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange({...priceRange, min: Number(e.target.value)})}
                          min={priceStats.min}
                          max={priceRange.max}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none text-sm rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('max')}</label>
                        <input
                          type="number"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange({...priceRange, max: Number(e.target.value)})}
                          min={priceRange.min}
                          max={priceStats.max}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none text-sm rounded"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={priceStats.min}
                      max={priceStats.max}
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({...priceRange, max: Number(e.target.value)})}
                      className="w-full accent-sari-blue"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{priceStats.min.toLocaleString('fr-FR')} €</span>
                      <span>{priceStats.max.toLocaleString('fr-FR')} €</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden btn-primary text-white px-4 py-2 font-semibold inline-flex items-center gap-2 rounded-lg"
              >
                <Filter className="w-4 h-4" />
                {t('filters')}
                {activeFiltersCount > 0 && (
                  <span className="bg-white text-sari-blue w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {t('sortBy')}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none text-sm rounded-lg"
                >
                  <option value="default">{t('default')}</option>
                  <option value="name-asc">{t('nameAsc')}</option>
                  <option value="name-desc">{t('nameDesc')}</option>
                  <option value="price-asc">{t('priceAsc')}</option>
                  <option value="price-desc">{t('priceDesc')}</option>
                </select>
              </div>
              <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-sari-blue text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  aria-label={t('gridView')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-sari-blue text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  aria-label={t('listView')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {selectedCategory !== 'Tous' && (
                  <Tag active onRemove={() => setSelectedCategory('Tous')} removable icon={<Folder className="w-3 h-3" />}>
                    {selectedCategory}
                  </Tag>
                )}
                {searchQuery && (
                  <Tag active onRemove={() => setSearchQuery('')} removable icon={<Search className="w-3 h-3" />}>
                    "{searchQuery}"
                  </Tag>
                )}
                {availability !== 'all' && (
                  <Tag active onRemove={() => setAvailability('all')} removable icon={<Package className="w-3 h-3" />}>
                    {availability === 'inStock' ? t('inStock') : t('onQuote')}
                  </Tag>
                )}
                {(priceRange.min > priceStats.min || priceRange.max < priceStats.max) && (
                  <Tag active onRemove={() => setPriceRange({ min: priceStats.min, max: priceStats.max })} removable icon={<Euro className="w-3 h-3" />}>
                    {priceRange.min}€ - {priceRange.max}€
                  </Tag>
                )}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-12 text-center rounded-xl">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 rounded-full">
                  <Search className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                  {t('noResults')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('noResultsDesc')}
                </p>
                <button
                  onClick={resetFilters}
                  className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 rounded-lg"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('resetFilters')}
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {currentItems.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {currentItems.map(product => (
                  <ProductCard key={product.id} product={product} variant="compact" />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
        </div>
      </div>
    </div>
    </PageVisibilityGuard>
  );
}