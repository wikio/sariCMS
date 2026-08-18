// app/admin/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Download, Code, Table, Search, Eye, Trash2, X,
  Clock, Loader, Truck, CheckCircle, XCircle,
  Package, AlertCircle, RefreshCw
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  client: string;
  email: string;
  date: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  address?: string;
}

export default function AdminOrdersPage() {
  const locale = useLocale();
  const t = useTranslations('admin.orders');
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<any>({ meta: { currency: 'DZD' } });
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadOrders();
  }, [locale]);

  const loadOrders = () => {
    // Charger la config pour la monnaie
    const storedConfig = localStorage.getItem(`sari_config_${locale}`);
    if (storedConfig) {
      try {
        setConfig(JSON.parse(storedConfig));
      } catch (e) {}
    }

    // Charger les commandes
    const stored = localStorage.getItem('sari_orders');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const safeOrders = parsed.map((o: any) => ({
          ...o,
          total: Number(o.total) || 0,
          items: (o.items || []).map((item: any) => ({
            ...item,
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0
          }))
        }));
        setOrders(safeOrders);
      } catch (e) {
        setOrders([]);
      }
    } else {
      // Données de test réalistes
      const defaultOrders: Order[] = [
        {
          id: 1001,
          client: 'Dr. Marie Laurent',
          email: 'marie@clinique.fr',
          date: '2024-06-15',
          status: 'delivered',
          total: 4500,
          items: [{ id: 1, name: 'Échographe Portable Pro', quantity: 1, price: 4500 }]
        },
        {
          id: 1002,
          client: 'CHU de Lyon',
          email: 'achats@chu-lyon.fr',
          date: '2024-07-01',
          status: 'processing',
          total: 18500,
          items: [
            { id: 7, name: 'Défibrillateur DSA Premium', quantity: 2, price: 8500 },
            { id: 15, name: 'Moniteur Multiparamètres', quantity: 1, price: 1500 }
          ]
        },
        {
          id: 1003,
          client: 'Cabinet Médical du Parc',
          email: 'secretariat@cabinet-parc.dz',
          date: '2024-07-10',
          status: 'pending',
          total: 850,
          items: [
            { id: 4, name: 'Tensiomètre Digital Brassard', quantity: 5, price: 120 },
            { id: 5, name: 'Stéthoscope Littmann Classic', quantity: 5, price: 50 }
          ]
        },
        {
          id: 1004,
          client: 'Clinique El Afia',
          email: 'direction@eliafia.dz',
          date: '2024-07-20',
          status: 'shipped',
          total: 12500,
          items: [
            { id: 3, name: 'Autoclave Classe B 23L', quantity: 1, price: 3500 },
            { id: 9, name: 'Lampe Scialytique LED Mobile', quantity: 2, price: 4500 }
          ]
        }
      ];
      setOrders(defaultOrders);
      localStorage.setItem('sari_orders', JSON.stringify(defaultOrders));
    }
  };

  const saveOrders = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('sari_orders', JSON.stringify(newOrders));
    showToast(t('saveSuccess'), 'success');
  };

  const statusConfig: Record<OrderStatus, { label: string; color: string; Icon: React.ElementType }> = {
    pending: { label: t('statusPending'), color: 'yellow', Icon: Clock },
    processing: { label: t('statusProcessing'), color: 'blue', Icon: Loader },
    shipped: { label: t('statusShipped'), color: 'purple', Icon: Truck },
    delivered: { label: t('statusDelivered'), color: 'green', Icon: CheckCircle },
    cancelled: { label: t('statusCancelled'), color: 'red', Icon: XCircle }
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = !searchQuery ||
      (o.client && o.client.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(o.id).includes(searchQuery);
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = (id: number, newStatus: OrderStatus) => {
    const newOrders = orders.map(o => o.id === id ? { ...o, status: newStatus } : o);
    saveOrders(newOrders);
  };

  const handleDelete = (id: number) => {
    if (confirm(t('deleteConfirm'))) {
      saveOrders(orders.filter(o => o.id !== id));
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(orders, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('exportSuccess', 'Exporté !'), 'success');
  };

  const currency = config?.meta?.currency || 'DZD';

  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length
  };

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-sari-dark dark:text-white">{stats.total}</div>
          <div className="text-xs text-gray-500">{t('stat_total', 'Total commandes')}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-green-600">{stats.revenue.toLocaleString()} {currency}</div>
          <div className="text-xs text-gray-500">{t('stat_revenue', 'Chiffre d\'affaires')}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-xs text-gray-500">{t('stat_pending')}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          <div className="text-xs text-gray-500">{t('stat_processing')}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm"
          >
            <option value="all">{t('allStatus')}</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadOrders} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Recharger
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('export', 'Exporter')}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? t('viewList') : t('viewJson', 'Vue JSON')}
          </button>
        </div>
      </div>

      {/* Contenu */}
      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <textarea
            value={JSON.stringify(orders, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) saveOrders(parsed);
              } catch (err) {}
            }}
            className="w-full h-[500px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#111111]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('client')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('items')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('total')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('status')}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredOrders.map(order => {
                  const sc = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = sc.Icon;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">#{order.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-sari-dark dark:text-white">{order.client || 'Inconnu'}</div>
                        <div className="text-xs text-gray-500">{order.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{order.date || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {order.items ? `${order.items.length} article(s)` : '0'}
                      </td>
                      <td className="px-6 py-4 font-bold text-sari-dark dark:text-white">
                        {(Number(order.total) || 0).toLocaleString()} {currency}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status || 'pending'}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className={`px-2 py-1 rounded-full text-xs font-semibold border-0 outline-none bg-${sc.color}-100 text-${sc.color}-700 dark:bg-${sc.color}-900/30 dark:text-${sc.color}-400`}
                        >
                          {Object.entries(statusConfig).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setEditingOrder(order)}
                          className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> {t('view')}
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-red-500 hover:underline text-sm inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('noOrders')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal détail commande */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">
                {t('orderDetail')} #{editingOrder.id}
              </h2>
              <button onClick={() => setEditingOrder(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block">{t('client')}</span>
                  <span className="font-bold text-sari-dark dark:text-white">{editingOrder.client || 'Inconnu'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('date')}</span>
                  <span className="font-bold text-sari-dark dark:text-white">{editingOrder.date || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Email</span>
                  <span className="font-bold text-sari-dark dark:text-white">{editingOrder.email || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('total')}</span>
                  <span className="font-bold text-green-600 text-lg">
                    {(Number(editingOrder.total) || 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <h3 className="font-bold text-sari-dark dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t('items')}
                </h3>
                <div className="space-y-2">
                  {editingOrder.items && editingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-[#111111] p-3 rounded-lg">
                      <div>
                        <div className="font-semibold text-sari-dark dark:text-white text-sm">{item.name || 'Article inconnu'}</div>
                        <div className="text-xs text-gray-500">
                          {Number(item.quantity) || 1} x {(Number(item.price) || 0).toLocaleString()} {currency}
                        </div>
                      </div>
                      <div className="font-bold text-sari-dark dark:text-white">
                        {((Number(item.quantity) || 1) * (Number(item.price) || 0)).toLocaleString()} {currency}
                      </div>
                    </div>
                  ))}
                  {(!editingOrder.items || editingOrder.items.length === 0) && (
                    <p className="text-sm text-gray-500 italic">Aucun article dans cette commande.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setEditingOrder(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}