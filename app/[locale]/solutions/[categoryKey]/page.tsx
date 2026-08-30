// app/[locale]/solutions/[categoryKey]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Package, Check } from 'lucide-react';
import { getProducts, getSolutionCategories } from '@/lib/data';
import { entityUrl, findByRouteKey } from '@/lib/entity-url';
import { readableTextOn, resolveColor, withAlpha } from '@/lib/colors';
import type { Product, SolutionCategory } from '@/types';
import ProductCard from '@/components/cards/ProductCard';
import FAQ from '@/components/ui/FAQ';
import SectionTitle from '@/components/ui/SectionTitle';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';
import IconMark from '@/components/admin/IconMark';

export default function SolutionCategoryPage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('pages.solutionCategory');
  const isRtl = locale === 'ar';
  // Segment d'URL : `id-slug`, `id` seul ou ancien slug.
  const key = decodeURIComponent(String(params.categoryKey || ''));

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<SolutionCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const [productsData, categoriesData] = await Promise.all([
          getProducts(locale),
          getSolutionCategories(locale),
        ]);

        if (!cancelled) {
          setProducts(productsData);
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('[solutions/detail] chargement impossible :', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // ✅ Résolution par ID en priorité, puis slug (donc l'URL arabe `3-slug-ar`
  //    et l'URL française `3-slug-fr` pointent bien sur la même fiche).
  const cat = findByRouteKey(categories, key);

  // Si la solution n'existe pas, on affiche un état "Non trouvé"
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

  // ✅ Produits associés — la comparaison est faite en chaîne car les IDs
  //    peuvent être numériques (JSON) ou textuels (API).
  const linkedIds = new Set((cat.productIds || []).map((id) => String(id)));
  const catProducts = products.filter((p) => linkedIds.has(String(p.id)));

  const otherCategories = categories.filter((c) => String(c.id) !== String(cat.id)).slice(0, 4);

  // ✅ Couleur de la fiche → couleur CSS réelle
  const color = resolveColor(cat.color);
  const ctaText = readableTextOn(cat.color);

  return (
    <PageVisibilityGuard visibilityKey="module.solutions">
    <div className="pt-32 pb-24 min-h-screen page-enter">
      {/* HERO */}
      <div
        className="parallax-bg py-32 flex items-center justify-center text-center text-white relative"
        style={{
          backgroundImage: cat.image ? `url(${cat.image})` : 'none',
          backgroundColor: cat.image ? undefined : '#1e293b',
        }}
      >
        <div className="absolute inset-0 bg-sari-dark/80"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="relative z-10 container mx-auto px-6">
          <Link href={`/${locale}/solutions`} className="inline-flex items-center gap-2 text-sari-lime hover:text-white mb-8 transition-colors">
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {t('backToSolutions')}
          </Link>
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2"
            style={{ backgroundColor: withAlpha(cat.color, 0.18), borderColor: color }}
          >
            <IconMark name={cat.icon} fallback="layers" className="w-12 h-12" color={color} />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">{cat.title}</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">{cat.shortDesc}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href={`/${locale}`} className="hover:text-sari-blue transition-colors">{t('breadcrumb.home')}</Link>
          {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Link href={`/${locale}/solutions`} className="hover:text-sari-blue transition-colors">{t('breadcrumb.solutions')}</Link>
          {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-sari-dark dark:text-white font-semibold">{cat.title}</span>
        </nav>

        {/* Description complète */}
        {cat.fullDesc && (
          <section className="mb-20">
            <div className="prose dark:prose-invert max-w-4xl mx-auto text-gray-600 dark:text-gray-400 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: cat.fullDesc }} />
          </section>
        )}

        {/* ✅ PRODUITS ASSOCIÉS (sélection faite dans l'admin) */}
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

        {/* ✅ ATOUTS — supporte les chaînes et les objets { text } */}
        {cat.features && cat.features.length > 0 && (
          <section className="mb-20">
            <SectionTitle subtitle={t('features.subtitle')} title={t('features.title')} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {cat.features.map((feature, i) => {
                const featureText = typeof feature === 'string' ? feature : String((feature as { text?: string })?.text ?? '');
                if (!featureText) return null;
                return (
                  <div key={i} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-4 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: withAlpha(cat.color, 0.12) }}>
                      <Check className="w-6 h-6" style={{ color }} />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{featureText}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ✅ FAQ de la fiche */}
        {cat.faq && cat.faq.length > 0 && (
          <section className="mb-20">
            <SectionTitle title={t('faq.title')} />
            <div className="max-w-4xl mx-auto">
              <FAQ items={cat.faq} variant="numbered" />
            </div>
          </section>
        )}

        {/* CTA — fond à la couleur de la fiche, texte contrasté automatiquement */}
        <section className="p-12 md:p-16 rounded-2xl text-center mb-20" style={{ backgroundColor: color, color: ctaText }}>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t('cta.title')}</h2>
          <p className="text-xl mb-12 max-w-3xl mx-auto opacity-90">{t('cta.description')}</p>
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

        {/* ✅ AUTRES SOLUTIONS */}
        {otherCategories.length > 0 && (
          <section>
            <SectionTitle title={t('related.title')} />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {otherCategories.map((other) => {
                const otherColor = resolveColor(other.color);
                return (
                  <Link
                    key={other.id}
                    href={entityUrl(locale, 'solutions', other)}
                    className="bg-gray-50 dark:bg-[#111111] p-6 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg hover:border-sari-blue transition-all group text-center block"
                  >
                    <div className="w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: withAlpha(other.color, 0.12) }}>
                      <IconMark name={other.icon} fallback="layers" className="w-7 h-7" color={otherColor} />
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
    </PageVisibilityGuard>
  );
}
