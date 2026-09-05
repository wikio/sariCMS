// app/[locale]/solutions/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, ChevronLeft, Package, Layers, Building, Headphones } from 'lucide-react';
import { getSolutionCategories } from '@/lib/data';
import { entityUrl } from '@/lib/entity-url';
import { resolveColor, withAlpha } from '@/lib/colors';
import type { SolutionCategory } from '@/types';
import FAQ from '@/components/ui/FAQ';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';
import IconMark from '@/components/admin/IconMark';

export default function SolutionsPage() {
  const locale = useLocale();
  const t = useTranslations('pages.solutions');
  const isRtl = locale === 'ar';

  const [categories, setCategories] = useState<SolutionCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getSolutionCategories(locale);
        if (!cancelled) setCategories(data);
      } catch (error) {
        console.error('[solutions] chargement impossible :', error);
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const processSteps = t.raw('process.steps') || [];
  const faqItems = t.raw('faq.items') || [];
  const stats = t.raw('intro.stats') || {};

  // Les stats reprennent la charte : couleurs figées, classes Tailwind statiques
  // (une classe construite dynamiquement serait purgée au build).
  const statsData = [
    { value: String(categories.length || stats.categories || '0'), label: stats.categoriesLabel || '', icon: Layers, wrap: 'bg-sari-blue/10', text: 'text-sari-blue' },
    { value: stats.products || '500+', label: stats.productsLabel || '', icon: Package, wrap: 'bg-sari-lime/10', text: 'text-sari-lime' },
    { value: stats.clients || '500+', label: stats.clientsLabel || '', icon: Building, wrap: 'bg-purple-500/10', text: 'text-purple-500' },
    { value: stats.support || '24/7', label: stats.supportLabel || '', icon: Headphones, wrap: 'bg-green-500/10', text: 'text-green-500' },
  ];

  if (loading) {
    return (
      <div className="pt-40 pb-24 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-sari-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <PageVisibilityGuard visibilityKey="module.solutions">
    <div className="pt-32 pb-24 min-h-screen">
      {/* HERO PARALLAXE */}
      <div className="parallax-bg py-32 flex items-center justify-center text-center text-white relative" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1920)' }}>
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="relative z-10 container mx-auto px-6">
          <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-6 animate-fade-in-up">
            {t('hero.subtitle')}
          </span>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight animate-fade-in-up">
            {t('hero.title')}
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up">
            {t('hero.description')}
          </p>
        </div>
      </div>

      {/* INTRODUCTION AVEC STATS */}
      <section className="py-20 bg-white dark:bg-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">{t('intro.subtitle')}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2 mb-6">{t('intro.title')}</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">{t('intro.description')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {statsData.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-gray-50 dark:bg-[#111111] p-6 border border-gray-200 dark:border-gray-800 rounded-xl text-center hover:shadow-lg transition-all">
                  <div className={`w-14 h-14 ${stat.wrap} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Icon className={`w-7 h-7 ${stat.text}`} />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-sari-dark dark:text-white mb-2">{stat.value}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ✅ GRILLE DES SOLUTIONS — icône, couleur et contenu issus de la base */}
      <section className="py-20 bg-sari-gray dark:bg-[#111111]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">{t('categories.subtitle')}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2 mb-6">{t('categories.title')}</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('categories.description')}</p>
          </div>

          {categories.length === 0 ? (
            <div className="max-w-xl mx-auto text-center bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-12">
              <div className="w-16 h-16 rounded-full bg-sari-blue/10 flex items-center justify-center mx-auto mb-6">
                <Layers className="w-8 h-8 text-sari-blue" />
              </div>
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('categories.empty')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('categories.emptyDesc')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories.map((cat, i) => {
                // Couleur de la fiche → couleur CSS réelle (jeton charte, jeton
                // Tailwind ou hex saisi dans l'admin).
                const color = resolveColor(cat.color);
                return (
                  <Link
                    key={cat.id}
                    href={entityUrl(locale, 'solutions', cat)}
                    className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-2xl transition-all group overflow-hidden relative block"
                  >
                    <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} text-6xl font-black text-gray-100 dark:text-gray-800 transition-colors`}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all relative"
                      style={{ backgroundColor: withAlpha(cat.color, 0.12) }}
                    >
                      <IconMark name={cat.icon} fallback="layers" className="w-8 h-8" color={color} />
                    </div>
                    <h3 className="text-2xl font-bold text-sari-dark dark:text-white mb-3 relative">{cat.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 relative line-clamp-3">{cat.shortDesc}</p>
                    <span
                      className="font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all relative"
                      style={{ color }}
                    >
                      {t('categories.cta')}
                      {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* PROCESS EN 5 ÉTAPES */}
      {processSteps.length > 0 && (
        <section className="py-20 bg-white dark:bg-[#1a1a1a]">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <span className="text-sari-blue font-bold uppercase tracking-wider text-sm">{t('process.subtitle')}</span>
              <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-2 mb-6">{t('process.title')}</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('process.description')}</p>
            </div>
            <div className="relative max-w-6xl mx-auto">
              <div className="hidden lg:block absolute top-16 left-0 right-0 h-1 bg-sari-blue/20"></div>
              <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
                {processSteps.map((step: { number?: string; title?: string; desc?: string }, i: number) => (
                  <div key={i} className="relative text-center group">
                    <div className="relative z-10 w-32 h-32 bg-white dark:bg-[#1a1a1a] border-4 border-sari-blue rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-sari-blue group-hover:scale-110 transition-all shadow-lg">
                      <div className="text-center">
                        <div className="text-3xl font-black text-sari-blue group-hover:text-white transition-colors">{step.number}</div>
                        <Package className="w-6 h-6 text-sari-blue group-hover:text-white transition-colors mx-auto" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-sari-dark dark:text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqItems.length > 0 && (
        <section className="py-20 bg-sari-gray dark:bg-[#111111]">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white">{t('faq.title')}</h2>
            </div>
            <div className="max-w-4xl mx-auto">
              <FAQ items={faqItems} variant="numbered" />
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="py-20 bg-sari-blue text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t('cta.title')}</h2>
          <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">{t('cta.description')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/contact`} className="bg-sari-lime text-sari-dark px-10 py-4 font-bold text-lg inline-flex items-center justify-center gap-2 hover:bg-white transition-colors">
              {t('cta.primary')}
              {isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </Link>
            <Link href={`/${locale}/products`} className="bg-white text-sari-blue px-10 py-4 font-bold text-lg inline-flex items-center justify-center gap-2 hover:bg-sari-dark hover:text-white transition-colors">
              {t('cta.secondary')}
            </Link>
          </div>
        </div>
      </section>
    </div>
    </PageVisibilityGuard>
  );
}
