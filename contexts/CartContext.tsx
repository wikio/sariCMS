// contexts/CartContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CartItem {
  id: number | string;
  name: string;
  price: number | string;
  quantity: number;
  image: string;
  category?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: number | string) => void;
  updateQuantity: (id: number | string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('sari_cart');
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('sari_cart');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sari_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => String(i.id) === String(item.id));
      if (existing) {
        return prev.map((i) =>
          String(i.id) === String(item.id) ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: number | string) => {
    setItems((prev) => prev.filter((i) => String(i.id) !== String(id)));
  };

  const updateQuantity = (id: number | string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems((prev) => prev.map((i) => (String(i.id) === String(id) ? { ...i, quantity } : i)));
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