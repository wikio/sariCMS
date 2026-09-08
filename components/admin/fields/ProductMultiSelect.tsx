'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check, Package } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getProducts } from '@/lib/data';
import type { Product } from '@/types';

interface ProductMultiSelectProps {
  value: Array<string | number>;
  onChange: (value: Array<string | number>) => void;
}

/**
 * Sélection multiple de produits par autocomplétion (champ `productIds`).
 *
 * Les IDs sont comparés en chaîne : selon la source (JSON statique ou API),
 * un même produit peut arriver en `1` ou `"1"`.
 */
export default function ProductMultiSelect({ value = [], onChange }: ProductMultiSelectProps) {
  const locale = useLocale();
  const t = useTranslations('admin.editor');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(
    () => new Set((Array.isArray(value) ? value : []).map((id) => String(id))),
    [value],
  );

  useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await getProducts(locale);
        if (!cancelled) setProducts(data);
      } catch (error) {
        console.error('[ProductMultiSelect] chargement impossible :', error);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Fermer la liste au clic extérieur
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q) ||
        String(p.id).toLowerCase() === q,
    );
  }, [products, search]);

  const toggleProduct = (productId: string | number) => {
    const key = String(productId);
    const current = (Array.isArray(value) ? value : []).map((id) => String(id));
    const next = current.includes(key) ? current.filter((id) => id !== key) : [...current, key];
    onChange(next);
  };

  const removeProduct = (productId: string | number) => {
    const key = String(productId);
    onChange((Array.isArray(value) ? value : []).filter((id) => String(id) !== key));
  };

  // On conserve aussi les IDs orphelins (produit supprimé / autre langue)
  // pour ne pas les perdre silencieusement à l'enregistrement.
  const selectedProducts = products.filter((p) => selectedIds.has(String(p.id)));
  const knownIds = new Set(products.map((p) => String(p.id)));
  const orphanIds = Array.from(selectedIds).filter((id) => !knownIds.has(id));

  return (
    <div className="space-y-2" ref={boxRef}>
      {/* Produits sélectionnés */}
      {(selectedProducts.length > 0 || orphanIds.length > 0) && (
        <div className="flex flex-wrap gap-2 p-2 rounded-lg" style={{ background: 'var(--ad-surface-2)' }}>
          {selectedProducts.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
              style={{ background: 'var(--ad-accent)', color: 'var(--ad-accent-ink)' }}
            >
              {product.image ? (
                <img src={product.image} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <Package className="w-4 h-4 opacity-80" />
              )}
              <span>{product.name}</span>
              <button
                type="button"
                onClick={() => removeProduct(product.id)}
                className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                aria-label={String(product.name)}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {orphanIds.map((id) => (
            <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ad-chip ad-chip-warn">
              <span className="font-mono">#{id}</span>
              <button type="button" onClick={() => removeProduct(id)} className="p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <div className="ad-search">
          <Search className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
          <input
            className="ad-input"
            placeholder={t('searchProduct')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />
        </div>

        {isOpen && (
          <div
            className="absolute z-30 w-full mt-1 rounded-lg shadow-lg max-h-64 overflow-y-auto ad-scroll"
            style={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-line)' }}
          >
            {loading ? (
              <div className="p-4 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>{t('loading')}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>{t('noProductFound')}</div>
            ) : (
              <div className="py-1">
                {filteredProducts.map((product) => {
                  const isSelected = selectedIds.has(String(product.id));
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggleProduct(product.id)}
                      className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ad-combo-item"
                      style={isSelected ? { background: 'var(--ad-surface-2)' } : undefined}
                    >
                      {product.image ? (
                        <img src={product.image} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <span className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--ad-surface-2)' }}>
                          <Package className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        {product.category && (
                          <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{product.category}</div>
                        )}
                      </div>
                      {isSelected && <Check className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--ad-accent)' }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ad-muted)' }}>
        <span>{t('selectedCount', { count: selectedIds.size })}</span>
        {selectedIds.size > 0 && (
          <button type="button" className="underline" onClick={() => onChange([])}>
            {t('clearAll')}
          </button>
        )}
      </div>
    </div>
  );
}
