// contexts/CartContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: number | string;
  name: string;
  price: number | string;
  quantity: number;
  image: string;
  category?: string;
  // Commerce enrichi (optionnel, rétro-compatible)
  sku?: string;
  discountValue?: number;
  discountType?: 'fixed' | 'percent';
  discount?: number; // legacy %
  vatRate?: number;
  vatIncluded?: boolean;
  shippingFee?: number;
  shippingType?: 'fixed' | 'per_qty' | 'free';
  zones?: string[];
  weight?: number;
  // Variantes / sous-catégories
  selectedOptions?: Record<string, string>;
  variantKey?: string; // ex: "Taille:M|Couleur:Rouge" pour séparer les lignes
  variantPrice?: number; // prix unitaire déjà ajusté selon variante
  optionSummary?: string; // ex: "Taille: M • Couleur: Rouge"
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: number | string, variantKey?: string) => void;
  updateQuantity: (id: number | string, quantity: number, variantKey?: string) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('sari_cart');
    const pending = localStorage.getItem('sari_pending_cart');
    const toLoad = stored || pending;
    if (toLoad) {
      try {
        const parsed = JSON.parse(toLoad);
        if (Array.isArray(parsed) && parsed.length) setItems(parsed);
        // Si on a restauré depuis pending, on resync sari_cart
        if (!stored && pending) localStorage.setItem('sari_cart', pending);
      } catch (e) {
        localStorage.removeItem('sari_cart');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sari_cart', JSON.stringify(items));
  }, [items]);

  const cartKey = (it: CartItem) => `${String(it.id)}::${it.variantKey||''}::${it.optionSummary||''}`;
  const addToCart = (item: CartItem) => {
    // Génère une clé variante pour séparer les mêmes articles par catégorie/type/taille
    const key = cartKey(item);
    setItems((prev) => {
      const existing = prev.find((i) => cartKey(i) === key);
      if (existing) {
        return prev.map((i) =>
          cartKey(i) === key ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: number | string, variantKey?: string) => {
    setItems((prev) => prev.filter((i) => {
      if (variantKey != null) return !(String(i.id)===String(id) && (i.variantKey||'')===variantKey);
      // sans variantKey : si plusieurs variantes, on retire seulement si une seule, sinon on retire toutes pour compat
      return String(i.id) !== String(id);
    }));
  };

  const updateQuantity = (id: number | string, quantity: number, variantKey?: string) => {
    if (quantity <= 0) {
      removeFromCart(id, variantKey);
      return;
    }
    setItems((prev) => prev.map((i) => {
      const match = variantKey != null ? (String(i.id)===String(id) && (i.variantKey||'')===variantKey) : String(i.id)===String(id);
      return match ? { ...i, quantity } : i;
    }));
  };

  const clearCart = () => setItems([]);

  // Le prix peut arriver sous forme de chaîne selon la source : on le
  // normalise avant de calculer, sinon le total vaut NaN.
  const toNumber = (value: number | string): number => {
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const total = items.reduce((sum, item) => sum + toNumber(item.price) * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}