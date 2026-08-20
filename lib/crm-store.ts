export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface CommerceItem {
  id: number | string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  category?: string;
}

export interface Order {
  id: number;
  client: string;
  email: string;
  phone?: string;
  company?: string;
  date: string;
  status: OrderStatus;
  total: number;
  items: CommerceItem[];
  address?: string;
  payment?: string;
  cost?: number;
  coupon?: string;
  quoteId?: number;
  zone?: string;
  history?: Array<{ status: string; at: string; note?: string }>;
}

export interface Quote {
  id: number;
  client: string;
  email: string;
  phone?: string;
  company?: string;
  date: string;
  status: QuoteStatus;
  total: number;
  validity: string;
  items: CommerceItem[];
  coupon?: string;
  orderId?: number;
  zone?: string;
  history?: Array<{ status: string; at: string; note?: string }>;
}

const ORDERS_KEY = 'sari_orders';
const QUOTES_KEY = 'sari_quotes';

const DEFAULT_ORDERS: Order[] = [
  {
    id: 1001, client: 'Dr. Marie Laurent', email: 'marie@clinique.fr', phone: '+33 6 12 34 56 78',
    company: 'Clinique Saint-Louis', date: '2026-01-15', status: 'delivered', total: 4500,
    payment: 'virement', cost: 3100, zone: 'DZ', quoteId: 2004,
    address: '12 rue des Lilas, Lyon',
    items: [{ id: 1, name: 'Échographe Portable Pro', quantity: 1, price: 4500, category: 'Imagerie' }],
  },
  {
    id: 1002, client: 'CHU de Lyon', email: 'achats@chu-lyon.fr', phone: '+33 4 72 11 22 33',
    company: 'CHU de Lyon', date: '2026-02-01', status: 'delivered', total: 18500,
    payment: 'cib', cost: 12800, zone: 'DZ',
    items: [
      { id: 7, name: 'Défibrillateur DSA Premium', quantity: 2, price: 8500, category: 'Urgence' },
      { id: 15, name: 'Moniteur Multiparamètres', quantity: 1, price: 1500, category: 'Cardiologie' },
    ],
  },
  {
    id: 1003, client: 'Cabinet Médical du Parc', email: 'secretariat@cabinet-parc.dz', phone: '+213 21 44 55 66',
    company: 'Cabinet du Parc', date: '2026-03-10', status: 'pending', total: 850,
    payment: 'cod', cost: 420, coupon: 'SARI10', zone: 'DZ',
    address: 'Lotissement El Biar, Alger',
    items: [
      { id: 4, name: 'Tensiomètre Digital Brassard', quantity: 5, price: 120, category: 'Diagnostic' },
      { id: 5, name: 'Stéthoscope Littmann Classic', quantity: 5, price: 50, category: 'Diagnostic' },
    ],
  },
  {
    id: 1004, client: 'Clinique El Afia', email: 'direction@eliafia.dz', phone: '+213 23 11 22 33',
    company: 'Clinique El Afia', date: '2026-04-20', status: 'shipped', total: 12500,
    payment: 'virement', cost: 8400, zone: 'DZ',
    items: [
      { id: 3, name: 'Autoclave Classe B 23L', quantity: 1, price: 3500, category: 'Chirurgie' },
      { id: 9, name: 'Lampe Scialytique LED Mobile', quantity: 2, price: 4500, category: 'Chirurgie' },
    ],
  },
  {
    id: 1005, client: 'Hôpital Mustapha Pacha', email: 'achats@mustapha.dz', phone: '+213 21 23 45 67',
    company: 'CHU Mustapha', date: '2026-05-08', status: 'delivered', total: 62000,
    payment: 'transfer', cost: 41000, zone: 'DZ', quoteId: 2001,
    items: [
      { id: 12, name: 'Couveuse Néonatale Advanced', quantity: 2, price: 16000, category: 'Pédiatrie' },
      { id: 1, name: 'Échographe Portable Pro', quantity: 4, price: 7500, category: 'Imagerie' },
    ],
  },
  {
    id: 1006, client: 'Labo Ibn Sina', email: 'contact@ibn-sina.dz', date: '2026-05-22',
    status: 'cancelled', total: 2800, payment: 'check', cost: 0, zone: 'DZ',
    items: [{ id: 22, name: 'Centrifugeuse de paillasse', quantity: 2, price: 1400, category: 'Laboratoire' }],
  },
  {
    id: 1007, client: 'Dr. Amina Khelifi', email: 'amina.k@cabinet.dz', phone: '+213 555 12 34 56',
    company: 'Cabinet Khelifi', date: '2026-06-18', status: 'delivered', total: 28800,
    payment: 'card-intl', cost: 19200, coupon: 'SARI10', zone: 'DZ',
    items: [{ id: 1, name: 'Échographe Portable Pro', quantity: 1, price: 32000, discount: 0, category: 'Imagerie' }],
  },
  {
    id: 1008, client: 'Clinique El Afia', email: 'direction@eliafia.dz', date: '2026-06-22',
    status: 'processing', total: 42000, payment: 'cib', cost: 27500, coupon: 'CLINIQUE5000', zone: 'DZ',
    items: [
      { id: 7, name: 'Défibrillateur DSA Premium', quantity: 3, price: 8500, category: 'Urgence' },
      { id: 18, name: 'Kit consommables ECG', quantity: 10, price: 180, category: 'Consommables' },
    ],
  },
  {
    id: 1009, client: 'Polyclinique Oran Est', email: 'direction@oran-est.dz', date: '2026-07-04',
    status: 'delivered', total: 9800, payment: 'paypal', cost: 6100, zone: 'DZ',
    items: [{ id: 15, name: 'Moniteur Multiparamètres', quantity: 4, price: 2450, category: 'Cardiologie' }],
  },
  {
    id: 1010, client: 'Dr. Marie Laurent', email: 'marie@clinique.fr', date: '2026-07-28',
    status: 'processing', total: 7200, payment: 'virement', cost: 4800, zone: 'DZ',
    items: [{ id: 3, name: 'Autoclave Classe B 23L', quantity: 2, price: 3600, category: 'Chirurgie' }],
  },
  {
    id: 1011, client: 'Groupe Hospitalier Nord', email: 'achats@ghn.dz', date: '2026-08-05',
    status: 'pending', total: 25000, payment: 'transfer', cost: 16800, zone: 'DZ', quoteId: 2001,
    items: [
      { id: 1, name: 'Échographe Portable Pro', quantity: 2, price: 4500, category: 'Imagerie' },
      { id: 12, name: 'Couveuse Néonatale Advanced', quantity: 1, price: 16000, category: 'Pédiatrie' },
    ],
  },
];

const DEFAULT_QUOTES: Quote[] = [
  {
    id: 2001, client: 'Groupe Hospitalier Nord', email: 'achats@ghn.dz', phone: '+213 21 98 76 54',
    company: 'GHN', date: '2026-07-25', status: 'accepted', total: 25000, validity: '30 jours',
    orderId: 1011, zone: 'DZ',
    items: [
      { id: 1, name: 'Échographe Portable Pro', quantity: 2, price: 4500, category: 'Imagerie' },
      { id: 12, name: 'Couveuse Néonatale Advanced', quantity: 1, price: 16000, category: 'Pédiatrie' },
    ],
  },
  {
    id: 2002, client: 'Dr. Thomas Bernard', email: 'thomas@cabinet.dz', date: '2026-07-28',
    status: 'sent', total: 3200, validity: '15 jours', zone: 'DZ',
    items: [{ id: 3, name: 'Autoclave Classe B 23L', quantity: 1, price: 3200, category: 'Chirurgie' }],
  },
  {
    id: 2003, client: 'Clinique Saint-Louis', email: 'marie@clinique.fr', date: '2026-07-30',
    status: 'accepted', total: 8500, validity: '30 jours', zone: 'DZ',
    items: [{ id: 7, name: 'Défibrillateur DSA Premium', quantity: 1, price: 8500, category: 'Urgence' }],
  },
  {
    id: 2004, client: 'Dr. Marie Laurent', email: 'marie@clinique.fr', date: '2025-12-20',
    status: 'accepted', total: 4500, validity: '30 jours', orderId: 1001, zone: 'DZ',
    items: [{ id: 1, name: 'Échographe Portable Pro', quantity: 1, price: 4500, category: 'Imagerie' }],
  },
  {
    id: 2005, client: 'Labo Ibn Sina', email: 'contact@ibn-sina.dz', date: '2026-06-01',
    status: 'rejected', total: 6400, validity: '15 jours', zone: 'DZ',
    items: [{ id: 22, name: 'Centrifugeuse de paillasse', quantity: 4, price: 1600, category: 'Laboratoire' }],
  },
  {
    id: 2006, client: 'Polyclinique Oran Est', email: 'direction@oran-est.dz', date: '2026-08-12',
    status: 'pending', total: 18700, validity: '21 jours', coupon: 'SARI10', zone: 'DZ',
    items: [
      { id: 15, name: 'Moniteur Multiparamètres', quantity: 3, price: 2450, category: 'Cardiologie' },
      { id: 5, name: 'Stéthoscope Littmann Classic', quantity: 10, price: 50, category: 'Diagnostic' },
    ],
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

function normalizeItems(items: CommerceItem[] = []): CommerceItem[] {
  return items.map((it) => ({
    ...it,
    quantity: Number(it.quantity) || 1,
    price: Number(it.price) || 0,
    discount: Number(it.discount || 0),
  }));
}

export function loadOrders(): Order[] {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(ORDERS_KEY) : null;
  if (!stored || stored === '[]') {
    if (typeof window !== 'undefined') localStorage.setItem(ORDERS_KEY, JSON.stringify(DEFAULT_ORDERS));
    return DEFAULT_ORDERS;
  }
  const parsed = readJson<Order[]>(ORDERS_KEY, DEFAULT_ORDERS);
  return parsed.map((o) => ({ ...o, total: Number(o.total) || 0, items: normalizeItems(o.items) }));
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
  return readJson<Quote[]>(QUOTES_KEY, DEFAULT_QUOTES).map((q) => ({
    ...q,
    total: Number(q.total) || 0,
    items: normalizeItems(q.items),
  }));
}

export function saveQuotes(quotes: Quote[]) {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

export function orderRevenue(orders: Order[]) {
  return orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
}

export function quoteConversion(quotes: Quote[]) {
  if (!quotes.length) return { rate: 0, avgDelay: 0, convertedAvg: 0, otherAvg: 0 };
  const converted = quotes.filter((q) => q.orderId || q.status === 'accepted');
  const others = quotes.filter((q) => !q.orderId && q.status !== 'accepted');
  const orders = typeof window !== 'undefined' ? loadOrders() : [];
  const delays = converted
    .map((q) => {
      const o = orders.find((ord) => ord.id === q.orderId || ord.quoteId === q.id);
      if (!o) return null;
      return (new Date(o.date).getTime() - new Date(q.date).getTime()) / 86400000;
    })
    .filter((n): n is number => n != null && Number.isFinite(n));
  return {
    rate: converted.length / quotes.length,
    avgDelay: delays.length ? delays.reduce((s, n) => s + n, 0) / delays.length : 0,
    convertedAvg: converted.length ? converted.reduce((s, q) => s + q.total, 0) / converted.length : 0,
    otherAvg: others.length ? others.reduce((s, q) => s + q.total, 0) / others.length : 0,
  };
}
