// app/admin/quotes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Download, Code, Table, FileText, Eye, Trash2, X, Send, CheckCircle, Clock } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

interface QuoteItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface Quote {
  id: number;
  client: string;
  email: string;
  date: string;
  status: QuoteStatus;
  total: number;
  validity: string;
  items: QuoteItem[];
}

export default function AdminQuotesPage() {
  const locale = useLocale();
  const t = useTranslations('admin.quotes');
  const { showToast } = useToast();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [config, setConfig] = useState<any>({ meta: { currency: 'DZD' } });
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [locale]);

  const loadData = () => {
    // Charger la config pour la monnaie
    const storedConfig = localStorage.getItem(`sari_config_${locale}`);
    if (storedConfig) {
      try { setConfig(JSON.parse(storedConfig)); } catch (e) {}
    }

    // Charger les devis
    const stored = localStorage.getItem('sari_quotes');
    if (stored) {
      try { setQuotes(JSON.parse(stored)); } catch (e) { setQuotes([]); }
    } else {
      const defaultQuotes: Quote[] = [
        {
          id: 2001,
          client: 'Groupe Hospitalier Nord',
          email: 'achats@ghn.dz',
          date: '2024-07-25',
          status: 'pending',
          total: 25000,
          validity: '30 jours',
          items: [
            { id: 1, name: 'Échographe Portable Pro', quantity: 2, price: 4500 },
            { id: 12, name: 'Couveuse Néonatale Advanced', quantity: 1, price: 16000 }
          ]
        },
        {
          id: 2002,
          client: 'Dr. Thomas Bernard',
          email: 'thomas@cabinet.dz',
          date: '2024-07-28',
          status: 'sent',
          total: 3200,
          validity: '15 jours',
          items: [
            { id: 3, name: 'Autoclave Classe B 23L', quantity: 1, price: 3200 }
          ]
        },
        {
          id: 2003,
          client: 'Clinique Saint-Louis',
          email: 'marie@clinique.fr',
          date: '2024-07-30',
          status: 'accepted',
          total: 8500,
          validity: '30 jours',
          items: [
            { id: 7, name: 'Défibrillateur DSA Premium', quantity: 1, price: 8500 }
          ]
        }
      ];
      setQuotes(defaultQuotes);
      localStorage.setItem('sari_quotes', JSON.stringify(defaultQuotes));
    }
  };

  const saveQuotes = (newQuotes: Quote[]) => {
    setQuotes(newQuotes);
    localStorage.setItem('sari_quotes', JSON.stringify(newQuotes));
    showToast(t('saveSuccess', 'Devis sauvegardés !'), 'success');
  };

  const statusConfig: Record<QuoteStatus, { label: string; color: string; Icon: React.ElementType }> = {
    pending: { label: t('statusPending', 'Brouillon'), color: 'gray', Icon: FileText },
    sent: { label: t('statusSent', 'Envoyé'), color: 'blue', Icon: Send },
    accepted: { label: t('statusAccepted', 'Accepté'), color: 'green', Icon: CheckCircle },
    rejected: { label: t('statusRejected', 'Refusé'), color: 'red', Icon: X },
    expired: { label: t('statusExpired', 'Expiré'), color: 'yellow', Icon: Clock }
  };

  const filteredQuotes = quotes.filter(q => {
    const matchSearch = !searchQuery || 
      q.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(q.id).includes(searchQuery);
    const matchStatus = filterStatus === 'all' || q.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = (id: number, newStatus: QuoteStatus) => {
    saveQuotes(quotes.map(q => q.id === id ? { ...q, status: newStatus } : q));
  };

  const handleDelete = (id: number) => {
    if (confirm(t('deleteConfirm', 'Supprimer ce devis ?'))) {
      saveQuotes(quotes.filter(q => q.id !== id));
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotes_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currency = config.meta?.currency || 'DZD';

  const stats = {
    total: quotes.length,
    pending: quotes.filter(q => q.status === 'pending' || q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + (Number(q.total) || 0), 0),
    conversion: quotes.length > 0 ? Math.round((quotes.filter(q => q.status === 'accepted').length / quotes.length) * 100) : 0
  };

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-sari-dark dark:text-white">{stats.total}</div>
          <div className="text-xs text-gray-500">{t('stat_total', 'Total devis')}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          <div className="text-xs text-gray-500">{t('stat_pending', 'En attente / Envoyés')}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-green-600">{stats.accepted.toLocaleString()} {currency}</div>
          <div className="text-xs text-gray-500">{t('stat_accepted', 'Devis acceptés')}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-purple-600">{stats.conversion}%</div>
          <div className="text-xs text-gray-500">{t('stat_conversion', 'Taux de conversion')}</div>
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
            <option value="all">{t('allStatus', 'Tous les statuts')}</option>
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
              placeholder={t('search', 'Rechercher...')}
              className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm" 
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('export', 'Exporter')}
          </button>
          <button 
            onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? t('viewList', 'Vue Liste') : t('viewJson', 'Vue JSON')}
          </button>
        </div>
      </div>

      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <textarea
            value={JSON.stringify(quotes, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) saveQuotes(parsed);
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">N° Devis</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('client', 'Client')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('date', 'Date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('items', 'Articles')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('total', 'Total')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('status', 'Statut')}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredQuotes.map(quote => {
                  const sc = statusConfig[quote.status] || statusConfig.pending;
                  return (
                    <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">DEV-{quote.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-sari-dark dark:text-white">{quote.client}</div>
                        <div className="text-xs text-gray-500">{quote.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{quote.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {quote.items ? `${quote.items.length} article(s)` : '0'}
                      </td>
                      <td className="px-6 py-4 font-bold text-sari-dark dark:text-white">
                        {(Number(quote.total) || 0).toLocaleString()} {currency}
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={quote.status} 
                          onChange={(e) => handleStatusChange(quote.id, e.target.value as QuoteStatus)}
                          className={`px-2 py-1 rounded-full text-xs font-semibold border-0 outline-none bg-${sc.color}-100 text-${sc.color}-700 dark:bg-${sc.color}-900/30 dark:text-${sc.color}-400`}
                        >
                          {Object.entries(statusConfig).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => setEditingQuote(quote)} 
                          className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> {t('view', 'Voir')}
                        </button>
                        <button 
                          onClick={() => handleDelete(quote.id)} 
                          className="text-red-500 hover:underline text-sm inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('noQuotes', 'Aucun devis')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Détail Devis */}
      {editingQuote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">Devis DEV-{editingQuote.id}</h2>
              <button onClick={() => setEditingQuote(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block">{t('client', 'Client')}</span>
                  <span className="font-bold text-sari-dark dark:text-white">{editingQuote.client}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Validité</span>
                  <span className="font-bold text-sari-dark dark:text-white">{editingQuote.validity}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('total', 'Total')}</span>
                  <span className="font-bold text-green-600 text-lg">{(Number(editingQuote.total) || 0).toLocaleString()} {currency}</span>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <h3 className="font-bold text-sari-dark dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> {t('items', 'Articles')}
                </h3>
                <div className="space-y-2">
                  {editingQuote.items && editingQuote.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-[#111111] p-3 rounded-lg">
                      <div>
                        <div className="font-semibold text-sari-dark dark:text-white text-sm">{item.name || 'Article inconnu'}</div>
                        <div className="text-xs text-gray-500">{Number(item.quantity) || 1} x {(Number(item.price) || 0).toLocaleString()} {currency}</div>
                      </div>
                      <div className="font-bold text-sari-dark dark:text-white">
                        {((Number(item.quantity) || 1) * (Number(item.price) || 0)).toLocaleString()} {currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setEditingQuote(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                {t('close', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}