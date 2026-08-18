// app/[locale]/solutions/[categoryKey]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Package, Check } from 'lucide-react';
import { getProducts, getSolutionCategories } from '@/lib/data';
import type { Product, SolutionCategory } from '@/types';
import ProductCard from '@/components/cards/ProductCard';
import FAQ from '@/components/ui/FAQ';
import SectionTitle from '@/components/ui/SectionTitle';

// ✅ Mapping pour résoudre dynamiquement les icônes et couleurs depuis le JSON
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'stethoscope': require('lucide-react').Stethoscope,
  'heart-pulse': require('lucide-react').HeartPulse,
  'scan': require('lucide-react').Scan,
  'syringe': require('lucide-react').Syringe,
  'baby': require('lucide-react').Baby,
  'activity': require('lucide-react').Activity,
  'monitor': require('lucide-react').Monitor,
  'flask-conical': require('lucide-react').FlaskConical,
  'accessibility': require('lucide-react').Accessibility,
};

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  'sari-blue': { bg: 'bg-sari-blue', text: 'text-sari-blue', border: 'border-sari-blue' },
  'red-500': { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500' },
  'purple-500': { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
  'green-500': { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
  'pink-500': { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500' },
  'orange-500': { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
  'indigo-500': { bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500' },
  'teal-500': { bg: 'bg-teal-500', text: 'text-teal-500', border: 'border-teal-500' },
  'cyan-500': { bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500' },
};

export default function SolutionCategoryPage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('pages.solutionCategory');
  const isRtl = locale === 'ar';
  const key = (params.categoryKey as string) || 'diagnostic';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<SolutionCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [productsData, categoriesData] = await Promise.all([
        getProducts(locale),
        getSolutionCategories(locale),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setLoading(false);
    };
    loadData();
  }, [locale]);

  // ✅ Recherche de la catégorie par son ID dans le tableau chargé
  const cat = categories.find(c => c.id === key);
  
  // Si la catégorie n'existe pas dans le JSON, on affiche un état "Non trouvé"
  if (!loading && !cat) {
    return (
      <div className="pt-40 pb-24 container mx-auto px-6 text-center min-h-screen flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 rounded-full">
          <Package className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('notFound')}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('notFoundDesc')}</p>
        <Link href={`/${locale}/solutions`} className="btn-primary text-white px-6 py-3 inline-block rounded-lg">
          {t('backToSolutions')}
        </Link>
      </div>
    );
  }

  if (loading || !cat) {
    return (
      <div className="pt-40 pb-24 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-sari-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const catProducts = products.filter(p => cat.productIds.includes(p.id));
  const otherCategories = categories.filter(c => c.id !== key).slice(0, 4);
  
  // ✅ Récupération dynamique des couleurs et icônes via le mapping
  const colors = colorMap[cat.color] || colorMap['sari-blue'];
  const IconComponent = iconMap[cat.icon] || Package;

  return (
    <div className="pt-32 pb-24 min-h-screen page-enter">
      {/* HERO */}
      <div className="parallax-bg py-32 flex items-center justify-center text-center text-white relative" style={{ backgroundImage: `url(${cat.image})` }}>
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="relative z-10 container mx-auto px-6">
          <Link href={`/${locale}/solutions`} className="inline-flex items-center gap-2 text-sari-lime hover:text-white mb-8 transition-colors">
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {t('backToSolutions')}
          </Link>
          <div className={`w-24 h-24 ${colors.bg}/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 ${colors.border}`}>
            <IconComponent className={`w-12 h-12 ${colors.text}`} />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">{cat.title}</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">{cat.shortDesc}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href={`/${locale}`} className="hover:text-sari-blue transition-colors">{t('breadcrumb.home')}</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${locale}/solutions`} className="hover:text-sari-blue transition-colors">{t('breadcrumb.solutions')}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-sari-dark dark:text-white font-semibold">{cat.title}</span>
        </nav>

        {/* Description complète */}
        {cat.fullDesc && (
          <section className="mb-20">
            <div className="prose dark:prose-invert max-w-4xl mx-auto text-gray-600 dark:text-gray-400 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: cat.fullDesc }} />
          </section>
        )}

        {/* ✅ PRODUITS DE LA CATÉGORIE */}
        {catProducts.length > 0 && (
          <section className="mb-20">
            <SectionTitle subtitle={t('products.subtitle')} title={t('products.title')} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {catProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href={`/${locale}/products`} className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2">
                {t('products.viewAll')} 
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Link>
            </div>
          </section>
        )}

        {/* ✅ FEATURES - Lu directement depuis le JSON (gère à la fois les strings et les objets) */}
        {cat.features && cat.features.length > 0 && (
          <section className="mb-20">
            <SectionTitle subtitle={t('features.subtitle')} title={t('features.title')} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {cat.features.map((feature, i) => {
                // Supporte à la fois "Feature text" et { text: "Feature text" }
                const featureText = typeof feature === 'string' ? feature : (feature as any).text;
                return (
                  <div key={i} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-4 hover:shadow-lg transition-all">
                    <div className={`w-12 h-12 ${colors.bg}/10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Check className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{featureText}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ✅ FAQ - Lu directement depuis le JSON */}
        {cat.faq && cat.faq.length > 0 && (
          <section className="mb-20">
            <SectionTitle title={t('faq.title')} />
            <div className="max-w-4xl mx-auto">
              <FAQ items={cat.faq} variant="numbered" />
            </div>
          </section>
        )}

        {/* CTA */}
        <section className={`${colors.bg} text-white p-12 md:p-16 rounded-2xl text-center mb-20`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t('cta.title')}</h2>
          <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">{t('cta.description')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/contact`} className="bg-sari-lime text-sari-dark px-10 py-4 font-bold text-lg inline-flex items-center justify-center gap-2 hover:bg-white transition-colors rounded-lg">
              {t('cta.primary')}
              {isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </Link>
            <Link href={`/${locale}/products`} className="bg-white text-sari-blue px-10 py-4 font-bold text-lg inline-flex items-center justify-center gap-2 hover:bg-sari-dark hover:text-white transition-colors rounded-lg">
              {t('cta.secondary')}
            </Link>
          </div>
        </section>

        {/* ✅ AUTRES CATÉGORIES - Lu directement depuis le JSON */}
        {otherCategories.length > 0 && (
          <section>
            <SectionTitle title={t('related.title')} />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {otherCategories.map((other) => {
                const otherColors = colorMap[other.color] || colorMap['sari-blue'];
                const OtherIcon = iconMap[other.icon] || Package;
                return (
                  <Link key={other.id} href={`/${locale}/solutions/${other.id}`} className="bg-gray-50 dark:bg-[#111111] p-6 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg hover:border-sari-blue transition-all group text-center block">
                    <div className={`w-14 h-14 ${otherColors.bg}/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:${otherColors.bg} transition-colors`}>
                      <OtherIcon className={`w-7 h-7 ${otherColors.text} group-hover:text-white transition-colors`} />
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors">{other.title}</h3>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}