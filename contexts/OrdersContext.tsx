// contexts/OrdersContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { nextCodeFor } from '@/lib/codes';
import { loadOrders as loadCrmOrders, saveOrders as saveCrmOrders, loadQuotes as loadCrmQuotes, saveQuotes as saveCrmQuotes } from '@/lib/crm-store';

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
  code?: string;
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
  addOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'code'> & { code?: string }) => Order;
  removeOrder: (id: number) => void;
  updateOrderStatus: (id: number, status: Order['status']) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const { user } = useAuth();

  // Stockage séparé : sari_orders_ctx pour l'espace client, sari_orders reste la source admin (crm-store)
  const CTX_KEY = 'sari_orders_ctx';
  useEffect(() => {
    // Migration : si ancienne donnée en sari_orders sans sari_orders_ctx, on reprend
    const storedCtx = localStorage.getItem(CTX_KEY);
    const storedLegacy = localStorage.getItem('sari_orders');
    const raw = storedCtx || storedLegacy;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Si on a utilisé le legacy et qu'on n'a pas encore de ctx, on migre
        if (!storedCtx && storedLegacy) {
          localStorage.setItem(CTX_KEY, storedLegacy);
        }
        // Filtre : ne garde que les commandes au format OrdersContext (présence de customerName ou isGuest)
        // Si le tableau contient des commandes CRM pures (client field), on les ignore pour l'affichage client
        const filtered = Array.isArray(parsed) ? parsed.filter((o:any)=> 'customerName' in o || 'customerEmail' in o || 'isGuest' in o) : [];
        // Si filtered vide mais parsed non vide, c'est peut-être un ancien mix -> on garde tout ce qui a totalAmount ou grandTotal
        const toUse = filtered.length ? filtered : (Array.isArray(parsed) ? parsed.filter((o:any)=> 'totalAmount' in o || 'grandTotal' in o) : []);
        // Si toujours vide, on garde parsed tel quel (fallback)
        setOrders((toUse.length ? toUse : (Array.isArray(parsed)? parsed : [])) as any);
      } catch (e) {
        localStorage.removeItem(CTX_KEY);
      }
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CTX_KEY, JSON.stringify(orders)); } catch {}
    // Ne pas écraser sari_orders (CRM) ici — la synchro CRM est gérée dans addOrder via saveOrders/saveQuotes
  }, [orders]);

  const addOrder = (orderData: Omit<Order, 'id' | 'createdAt' | 'code'> & { code?: string }): Order => {
    // Génère un code formaté SARI-WCMD{XX}-{ID} via lib/codes si non fourni, basé sur les commandes existantes
    let code = (orderData as any).code as string | undefined;
    if (!code) {
      try {
        const existing: string[] = JSON.parse(localStorage.getItem('sari_orders') || '[]').map((o: any)=> o.code).filter(Boolean);
        // aussi inclure les commandes CRM stockées (même clé) pour éviter collisions
        code = nextCodeFor('order', existing);
      } catch { code = `SARI-WCMD-${Date.now().toString().slice(-5)}`; }
    }
    // Devis (quote_requested) doit aussi avoir une référence devis
    let quoteRef: string | undefined;
    if ((orderData as any).isQuote || (orderData as any).status === 'quote_requested') {
      try {
        const existingQ: string[] = JSON.parse(localStorage.getItem('sari_quotes') || '[]').map((q: any)=> q.reference).filter(Boolean);
        quoteRef = nextCodeFor('quote', existingQ);
      } catch { quoteRef = undefined; }
    }
    const newOrder: Order = {
      ...orderData,
      id: Date.now(),
      code: code!,
      createdAt: new Date().toISOString(),
    } as Order;
    // Persistance locale OrdersContext (compatibilité historique)
    setOrders((prev) => [newOrder, ...prev]);
    // Persistance CRM (admin) : convertit vers le format Order CRM (lib/crm-store) pour visibilité admin + numéro formaté
    try {

      // Si devis demandé, créer un devis CRM plutôt qu'une commande
      if ((newOrder as any).isQuote || (newOrder as any).status === 'quote_requested') {
        const quotes = loadCrmQuotes();
        // évite doublon si déjà présent
        const qItems = (newOrder.items || []).map((it: any)=> ({ id: Number(it.id)||Date.now(), name: it.name, quantity: it.quantity||1, price: Number(String(it.price).replace(/[^0-9.]/g,''))||0, category: it.category }));
        const qTotal = Number((newOrder as any).grandTotal || (newOrder as any).totalAmount || 0);
        const newQuote: any = {
          id: Number(newOrder.id),
          client: (newOrder as any).customerName || 'Client',
          email: (newOrder as any).customerEmail || '',
          phone: (newOrder as any).customerPhone || '',
          company: (newOrder as any).customerCompany || '',
          date: new Date().toISOString().slice(0,10),
          status: 'pending',
          total: qTotal,
          validity: '30 jours',
          reference: quoteRef || code,
          items: qItems,
          zone: (newOrder as any).deliveryZone || (newOrder as any).saleZone || '',
          address: (newOrder as any).deliveryAddress || '',
          country: (newOrder as any).country || '',
        };
        saveCrmQuotes([newQuote, ...quotes]);
      } else {
        const orders = loadCrmOrders();
        const cItems = (newOrder.items || []).map((it: any)=> ({ id: Number(it.id)||Date.now(), name: it.name, quantity: it.quantity||1, price: Number(String(it.price).replace(/[^0-9.]/g,''))||0, category: it.category }));
        const cTotal = Number((newOrder as any).grandTotal || (newOrder as any).totalAmount || 0);
        const crmOrder: any = {
          id: Number(newOrder.id),
          code: code,
          client: (newOrder as any).customerName || 'Client',
          email: (newOrder as any).customerEmail || '',
          phone: (newOrder as any).customerPhone || '',
          company: (newOrder as any).customerCompany || '',
          date: new Date().toISOString().slice(0,10),
          status: 'pending',
          total: cTotal,
          subtotal: Number((newOrder as any).subtotal || cTotal),
          shippingFee: Number((newOrder as any).shippingFee || 0),
          taxTotal: Number((newOrder as any).taxTotal || (newOrder as any).taxAmount || 0),
          discountTotal: Number((newOrder as any).discountTotal || 0),
          items: cItems,
          payment: 'pending',
          zone: (newOrder as any).deliveryZone || (newOrder as any).saleZone || '',
          deliveryZone: (newOrder as any).deliveryZone || '',
          saleZone: (newOrder as any).saleZone || '',
          address: (newOrder as any).deliveryAddress || '',
          deliveryAddress: (newOrder as any).deliveryAddress || '',
          country: (newOrder as any).country || '',
          coupon: (newOrder as any).coupon || '',
          notes: (newOrder as any).notes || '',
        };
        saveCrmOrders([crmOrder, ...orders]);
      }
    } catch (e) {
      console.warn('[OrdersContext] sync CRM échouée', e);
    }
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