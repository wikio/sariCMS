// contexts/CartContext.tsx
'use client';

import { createContext, useContext, useState, useSyncExternalStore, ReactNode } from 'react';

import { catalogPrice } from '@/lib/catalog-price';

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
  taxRate?: number;
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

const EMPTY: CartItem[] = [];
const serverCart = () => EMPTY;

function readCart(): CartItem[] {
  for (const key of ['sari_cart', 'sari_pending_cart']) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(rows)) return rows.filter(row => row && typeof row.name === 'string' && row.id != null && row.quantity > 0);
    } catch { /* essayer la copie de secours, ou fonctionner en mémoire */ }
  }
  return EMPTY;
}

// Un magasin par Provider. Le SSR ne lit pas le navigateur et le montage (même
// en Strict Mode) n'écrit rien : seules les actions de l'utilisateur persistent.
function createCartStore() {
  let items: CartItem[] | undefined;
  const listeners = new Set<() => void>();
  const get = () => items ??= readCart();
  return {
    get,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const reload = (event: StorageEvent) => {
        if (event.key === null || event.key === 'sari_cart' || event.key === 'sari_pending_cart') {
          items = undefined;
          listener();
        }
      };
      window.addEventListener('storage', reload);
      return () => { listeners.delete(listener); window.removeEventListener('storage', reload); };
    },
    update(change: (previous: CartItem[]) => CartItem[]) {
      items = change(get());
      try {
        localStorage.setItem('sari_cart', JSON.stringify(items));
        localStorage.removeItem('sari_pending_cart');
      } catch { /* stockage privé ou quota atteint : conserver la session en mémoire */ }
      listeners.forEach(listener => listener());
    },
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCartStore);
  const items = useSyncExternalStore(store.subscribe, store.get, serverCart);
  const setItems = store.update;

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

  const clearCart = () => setItems(() => []);
  const total = items.reduce((sum, item) => sum + catalogPrice(item.price) * item.quantity, 0);

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