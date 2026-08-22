// app/[locale]/produits/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronLeft, ChevronRight, Check, ShoppingCart, Loader,
  Download, Package, AlertTriangle
} from 'lucide-react';
import { getProducts } from '@/lib/data';
import { matchesEntity } from '@/lib/ids';
import { useCart } from '@/contexts/CartContext';
import { useVisibility } from '@/lib/site-visibility';
import type { Product } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const t = useTranslations('pages.productDetail');
  const { addToCart } = useCart();
  const visibility = useVisibility();

  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      const data = await getProducts(locale);
      setProducts(data);
      const found = data.find((p) => matchesEntity(p, id));
      setProduct(found || null);
    };
    loadProduct();
  }, [id, locale]);

  useEffect(() => {
    setActiveImage(0);
    setQty(1);
    setSelectedOptions({});
  }, [id]);

  if (products.length === 0) {
    return (
      <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 p-8 max-w-2xl rounded-xl">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">
            ⚠️ {t('noProductsLoaded')}
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {t('noProductsLoadedDesc')}
          </p>
          <Link href={`/${locale}/produits`} className="btn-primary text-white px-6 py-3 font-semibold inline-block rounded-lg">
            {t('backToCatalog')}
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 rounded-full">
          <Package className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('productNotFound')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          {t('requestedId')} : <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{id}</code>
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('availableProducts')} : {products.map((p) => p.id).join(', ')}
        </p>
        <div className="flex gap-4">
          <Link href={`/${locale}/produits`} className="btn-primary text-white px-6 py-3 font-semibold rounded-lg">
            {t('viewCatalog')}
          </Link>
          <Link href={`/${locale}`} className="px-6 py-3 border-2 border-gray-300 dark:border-gray-700 font-semibold hover:border-sari-blue rounded-lg">
            {t('home')}
          </Link>
        </div>
      </div>
    );
  }

  const gallery = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];
  const currentImage = gallery[activeImage] || product.image;
  const showArrows = gallery.length > 1;

  const nextImage = () => setActiveImage((prev) => (prev + 1) % gallery.length);
  const prevImage = () => setActiveImage((prev) => (prev - 1 + gallery.length) % gallery.length);

  const handleAddToCart = () => {
    setIsAdding(true);
    setTimeout(() => {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        image: currentImage,
        category: product.category,
      });
      setAddedToCart(true);
      setIsAdding(false);
      setTimeout(() => setAddedToCart(false), 3000);
    }, 500);
  };

  return (
    <div className="pt-44 pb-24 container mx-auto px-6 min-h-screen page-enter">
      {addedToCart && (
        <div className="fixed top-24 right-4 bg-green-500 text-white px-6 py-3 shadow-lg z-50 animate-fade-in-up rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {t('addedToQuote')}
        </div>
      )}

      <Breadcrumb items={[
        { label: t('home'), href: '/' },
        { label: t('Products'), href: '/products' },
        { label: product.name }
      ]} />

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        {/* Galerie Images */}
        <div>
          <div className="relative">
            {showArrows && (
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-sari-dark/90 p-3 z-10 hover:bg-white shadow-lg transition-all hover:scale-110 rounded-full"
                aria-label={t('previousImage')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="bg-gray-100 dark:bg-[#1a1a1a] mb-4 overflow-hidden border border-gray-200 dark:border-gray-800 aspect-square flex items-center justify-center rounded-xl">
              <img
                src={currentImage}
                alt={product.name}
                className="max-w-full max-h-full object-contain transition-transform duration-500 hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x600?text=Image'; }}
              />
            </div>
            {showArrows && (
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-sari-dark/90 p-3 z-10 hover:bg-white shadow-lg transition-all hover:scale-110 rounded-full"
                aria-label={t('nextImage')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
            {showArrows && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-sari-dark/80 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {activeImage + 1} / {gallery.length}
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`aspect-square overflow-hidden border-2 transition-all rounded-lg ${
                    activeImage === idx
                      ? 'border-sari-blue shadow-lg scale-105'
                      : 'border-gray-200 dark:border-gray-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Infos Produit */}
        <div className="flex flex-col">
          <span className="text-sari-blue font-bold uppercase tracking-wider mb-2">
            {product.category}
          </span>
          <h1 className="text-4xl font-bold text-sari-dark dark:text-white mb-4">
            {product.name}
          </h1>
          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl font-bold text-sari-lime">{product.price}</span>
            {product.inStock ? (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold flex items-center gap-1 rounded-full">
                <Check className="w-4 h-4" />
                {t('inStock')}
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-semibold rounded-full">
                {t('deliveryDelay')}: {product.deliveryTime || t('toConfirm')}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg leading-relaxed">
            {product.shortDesc}
          </p>

          {/* Options */}
          {product.options && product.options.length > 0 && (
            <div className="mb-6">
              {product.options.map((opt, i) => (
                <div key={i} className="mb-4">
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                    {opt.name}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {opt.choices.map((choice, j) => (
                      <button
                        key={j}
                        onClick={() => setSelectedOptions({ ...selectedOptions, [opt.name]: choice })}
                        className={`px-4 py-2 border-2 font-medium transition-all rounded-lg ${
                          selectedOptions[opt.name] === choice
                            ? 'border-sari-blue bg-sari-blue/10 text-sari-blue'
                            : 'border-gray-300 dark:border-gray-700 hover:border-sari-blue/50'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quantité + Ajouter au panier (masquable depuis Admin → Visibilité) */}
          {visibility['action.order'] !== false && (
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex items-center border-2 border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800"
                disabled={isAdding}
              >
                -
              </button>
              <span className="px-4 py-3 font-bold min-w-[3rem] text-center">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800"
                disabled={isAdding}
              >
                +
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="flex-1 btn-primary text-white px-8 py-3 font-semibold shadow-lg flex items-center justify-center gap-2 rounded-lg"
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {t('adding')}
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  {t('addToQuote')}
                </>
              )}
            </button>
          </div>
          )}

          {/* PDF */}
          {product.catalogPdf && product.catalogPdf !== '#' && (
            <a
              href={product.catalogPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sari-blue font-semibold hover:underline mb-8"
            >
              <Download className="w-5 h-5" />
              {t('downloadPdf')}
            </a>
          )}

          {/* Description complète */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
            <h3 className="font-bold text-sari-dark dark:text-white mb-4 text-xl">
              {t('productDetails')}
            </h3>
            <div
              className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400"
              dangerouslySetInnerHTML={{ __html: product.fullDesc || product.shortDesc }}
            />
          </div>

          {/* Points forts */}
          {product.features && product.features.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-8">
              <h3 className="font-bold text-sari-dark dark:text-white mb-4 text-xl">
                {t('highlights')}
              </h3>
              <ul className="space-y-2">
                {product.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Check className="w-5 h-5 text-sari-blue flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Spécifications */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-8">
              <h3 className="font-bold text-sari-dark dark:text-white mb-4 text-xl">
                {t('technicalSpecs')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-[#111111] p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
                {Object.entries(product.specs).map(([key, value], i) => (
                  <div key={i} className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
                    <span className="text-gray-600 dark:text-gray-400">{key}</span>
                    <span className="font-semibold text-sari-dark dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}