// components/layout/SearchHeader.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';

export default function SearchHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('components.layout.SearchHeader');

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        document.body.style.overflow = '';
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      setIsOpen(false);
      setSearchQuery('');
      setTimeout(() => {
        // ✅ CORRECTION : /recherche au lieu de /search
        router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
      }, 200);
    }
  };

  // Ne pas afficher si on est déjà sur la page de recherche
  if (pathname.includes('/search')) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2.5 text-sari-lime hover:text-white transition-all group"
        aria-label={t('searchButton')}
      >
        <div className="absolute inset-0 bg-sari-lime/0 group-hover:bg-sari-lime/20 transition-all"></div>
        <Search className="w-5 h-5 relative z-10" />
      </button>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
      <div
        className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sari-lime/70 via-sari-blue/60 to-sari-dark/80 backdrop-blur-xl"
        onClick={() => setIsOpen(false)}
        style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}
      ></div>
      
      <div className="absolute top-0 left-0 w-full h-full grid-pattern-bg opacity-10 pointer-events-none"></div>
      
      <div className="relative w-full max-w-3xl z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4 border-2 border-white/30">
            <Search className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">
            {t('title')}
          </h2>
          <p className="text-white/95 text-lg font-medium">
            {t('subtitle')}
          </p>
        </div>

        <form onSubmit={handleSearch}>
          <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden border-2 border-white/50">
            <div className="flex items-center p-2">
              <div className="pl-4 pr-2">
                <Search className="w-6 h-6 text-sari-blue" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('placeholder')}
                className="flex-1 text-xl bg-transparent border-none outline-none text-sari-dark dark:text-white placeholder-gray-400 py-4 px-2"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors mr-2"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              )}
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="bg-sari-lime text-sari-dark px-6 py-3 font-bold rounded-xl hover:bg-sari-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {t('searchButton')}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 text-center text-white text-sm">
          <p className="mb-2 font-bold text-lg">{t('tipsTitle')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/50 font-semibold">
              <code className="font-mono">,</code> {t('tipOr')}
            </span>
            <span className="bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/50 font-semibold">
              <code className="font-mono">+</code> {t('tipAnd')}
            </span>
            <span className="bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/50 font-semibold">
              {t('tipExample')}
            </span>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-white/80 text-sm inline-flex items-center gap-2 transition-colors font-semibold"
          >
            <kbd className="px-2 py-1 bg-white/30 backdrop-blur-sm border border-white/50 rounded text-xs font-mono">ESC</kbd>
            {t('pressEscape')}
          </button>
        </div>
      </div>
    </div>
  );
}