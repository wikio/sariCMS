// contexts/OrdersContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface OrderItem {
  id: number;
  name: string;
  price: string;
  quantity: number;
  image: string;
  category: string;
}

export interface Order {
  id: number;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  customerType: string;
  isGuest: boolean;
  isQuote: boolean;
  items: OrderItem[];
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  status: 'pending' | 'pending_payment' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'quote_requested';
  createdAt: string;
}

interface OrdersContextType {
  orders: Order[];
  addOrder: (orderData: Omit<Order, 'id' | 'createdAt'>) => Order;
  removeOrder: (id: number) => void;
  updateOrderStatus: (id: number, status: Order['status']) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem('sari_orders');
    if (stored) {
      try {
        setOrders(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('sari_orders');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sari_orders', JSON.stringify(orders));
  }, [orders]);

  const addOrder = (orderData: Omit<Order, 'id' | 'createdAt'>): Order => {
    const newOrder: Order = {
      ...orderData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    setOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  };

  const removeOrder = (id: number) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const updateOrderStatus = (id: number, status: Order['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  };

  return (
    <OrdersContext.Provider value={{ orders, addOrder, removeOrder, updateOrderStatus }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used within OrdersProvider');
  return context;
}