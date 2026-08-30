'use client';

import { useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { getProducts } from '@/lib/data';
import { useLocale } from 'next-intl';

interface Product {
  id: string | number;
  name: string;
  category?: string;
  image?: string;
}

interface ProductMultiSelectProps {
  value: Array<string | number>;
  onChange: (value: Array<string | number>) => void;
}

export default function ProductMultiSelect({ value = [], onChange }: ProductMultiSelectProps) {
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await getProducts(locale);
        setProducts(data);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [locale]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleProduct = (productId: string | number) => {
    const newValue = value.includes(productId)
      ? value.filter(id => id !== productId)
      : [...value, productId];
    onChange(newValue);
  };

  const removeProduct = (productId: string | number) => {
    onChange(value.filter(id => id !== productId));
  };

  const selectedProducts = products.filter(p => value.includes(p.id));

  return (
    <div className="space-y-2">
      {/* Selected products */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {selectedProducts.map(product => (
            <div
              key={product.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-sari-blue text-white rounded-full text-sm"
            >
              {product.image && (
                <img src={product.image} alt="" className="w-5 h-5 rounded-full object-cover" />
              )}
              <span>{product.name}</span>
              <button
                type="button"
                onClick={() => removeProduct(product.id)}
                className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="ad-search">
          <Search className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
          <input
            className="ad-input"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          />
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Chargement...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Aucun produit trouvé</div>
            ) : (
              <div className="py-1">
                {filteredProducts.map(product => {
                  const isSelected = value.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                        isSelected ? 'bg-sari-blue/10' : ''
                      }`}
                    >
                      {product.image && (
                        <img src={product.image} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {product.name}
                        </div>
                        {product.category && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {product.category}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-sari-blue flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {value.length} produit{value.length !== 1 ? 's' : ''} sélectionné{value.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
