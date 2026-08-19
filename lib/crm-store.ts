export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface CommerceItem {
  id: number | string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  client: string;
  email: string;
  date: string;
  status: OrderStatus;
  total: number;
  items: CommerceItem[];
  address?: string;
  payment?: string;
  cost?: number;
  coupon?: string;
}

export interface Quote {
  id: number;
  client: string;
  email: string;
  date: string;
  status: QuoteStatus;
  total: number;
  validity: string;
  items: CommerceItem[];
}

const ORDERS_KEY = 'sari_orders';
const QUOTES_KEY = 'sari_quotes';

const DEFAULT_ORDERS: Order[] = [
  {
    id: 1001, client: 'Dr. Marie Laurent', email: 'marie@clinique.fr', date: '2026-06-15',
    status: 'delivered', total: 4500, payment: 'virement', cost: 3100,
    items: [{ id: 1, name: 'Échographe Portable Pro', quantity: 1, price: 4500 }],
  },
  {
    id: 1002, client: 'CHU de Lyon', email: 'achats@chu-lyon.fr', date: '2026-07-01',
    status: 'processing', total: 18500, payment: 'cib', cost: 12800,
    items: [
      { id: 7, name: 'Défibrillateur DSA Premium', quantity: 2, price: 8500 },
      { id: 15, name: 'Moniteur Multiparamètres', quantity: 1, price: 1500 },
    ],
  },
  {
    id: 1003, client: 'Cabinet Médical du Parc', email: 'secretariat@cabinet-parc.dz', date: '2026-07-10',
    status: 'pending', total: 850, payment: 'cod', cost: 420, coupon: 'SARI10',
    items: [
      { id: 4, name: 'Tensiomètre Digital Brassard', quantity: 5, price: 120 },
      { id: 5, name: 'Stéthoscope Littmann Classic', quantity: 5, price: 50 },
    ],
  },
  {
    id: 1004, client: 'Clinique El Afia', email: 'direction@eliafia.dz', date: '2026-07-20',
    status: 'shipped', total: 12500,
    items: [
      { id: 3, name: 'Autoclave Classe B 23L', quantity: 1, price: 3500 },
      { id: 9, name: 'Lampe Scialytique LED Mobile', quantity: 2, price: 4500 },
    ],
  },
];

const DEFAULT_QUOTES: Quote[] = [
  {
    id: 2001, client: 'Groupe Hospitalier Nord', email: 'achats@ghn.dz', date: '2026-07-25',
    status: 'pending', total: 25000, validity: '30 jours',
    items: [
      { id: 1, name: 'Échographe Portable Pro', quantity: 2, price: 4500 },
      { id: 12, name: 'Couveuse Néonatale Advanced', quantity: 1, price: 16000 },
    ],
  },
  {
    id: 2002, client: 'Dr. Thomas Bernard', email: 'thomas@cabinet.dz', date: '2026-07-28',
    status: 'sent', total: 3200, validity: '15 jours',
    items: [{ id: 3, name: 'Autoclave Classe B 23L', quantity: 1, price: 3200 }],
  },
  {
    id: 2003, client: 'Clinique Saint-Louis', email: 'marie@clinique.fr', date: '2026-07-30',
    status: 'accepted', total: 8500, validity: '30 jours',
    items: [{ id: 7, name: 'Défibrillateur DSA Premium', quantity: 1, price: 8500 }],
  },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadOrders(): Order[] {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(ORDERS_KEY) : null;
  if (!stored) {
    if (typeof window !== 'undefined') localStorage.setItem(ORDERS_KEY, JSON.stringify(DEFAULT_ORDERS));
    return DEFAULT_ORDERS;
  }
  const parsed = readJson<Order[]>(ORDERS_KEY, DEFAULT_ORDERS);
  return parsed.map((o) => ({
    ...o,
    total: Number(o.total) || 0,
    items: (o.items || []).map((it) => ({
      ...it,
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
    })),
  }));
}

export function saveOrders(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function loadQuotes(): Quote[] {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(QUOTES_KEY) : null;
  if (!stored) {
    if (typeof window !== 'undefined') localStorage.setItem(QUOTES_KEY, JSON.stringify(DEFAULT_QUOTES));
    return DEFAULT_QUOTES;
  }
  return readJson<Quote[]>(QUOTES_KEY, DEFAULT_QUOTES);
}

export function saveQuotes(quotes: Quote[]) {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

export function orderRevenue(orders: Order[]) {
  return orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
}
