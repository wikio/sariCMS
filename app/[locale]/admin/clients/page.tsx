// app/admin/clients/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Download, Code, Table, User, Trash2, Eye, X } from 'lucide-react';

export default function AdminClientsPage() {
  const locale = useLocale();
  // On suppose que vos traductions admin sont dans un namespace 'admin.clients'
  // Ajustez le chemin si nécessaire (ex: 'admin.clients' ou juste 'clients')
  const t = useTranslations('admin.clients'); 

  const [clients, setClients] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');
  const [editingClient, setEditingClient] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, [locale]);

  const loadClients = () => {
    setLoading(true);
    const stored = localStorage.getItem(`sari_clients_${locale}`);
    if (stored) {
      try {
        setClients(JSON.parse(stored));
      } catch (e) {
        setClients([]);
      }
    } else {
      // Données de fallback pour la Phase 1
      setClients([
        { id: 1, name: 'Dr. Marie Laurent', email: 'marie@clinique.fr', phone: '+213 555 123 456', company: 'Clinique Saint-Louis', address: 'Alger', totalOrders: 12, totalSpent: '45000 €', status: 'active', createdAt: '2023-01-15' },
        { id: 2, name: 'Dr. Philippe Martin', email: 'philippe@chu.dz', phone: '+213 555 789 012', company: 'CHU de Lyon', address: 'Oran', totalOrders: 5, totalSpent: '78000 €', status: 'active', createdAt: '2023-03-20' },
      ]);
    }
    setLoading(false);
  };

  const saveClients = (newClients: any[]) => {
    setClients(newClients);
    localStorage.setItem(`sari_clients_${locale}`, JSON.stringify(newClients));
    // TODO: Remplacer par votre système de toast (ex: showToast('success', ...))
    alert(t('saveSuccess', 'Clients sauvegardés !')); 
  };

  const filteredClients = clients.filter(c =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: number) => {
    if (confirm(t('deleteConfirm', 'Supprimer ce client ?'))) {
      saveClients(clients.filter(c => c.id !== id));
    }
  };

  const handleSaveEdit = () => {
    saveClients(clients.map(c => c.id === editingClient.id ? editingClient : c));
    setEditingClient(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(clients, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(t('exportSuccess', 'Fichier JSON exporté !'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-sari-blue border-t-transparent animate-spin rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête et Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">{t('title', 'Clients')}</h1>
            <p className="text-sm text-gray-500">{clients.length} {t('total', 'client(s)')}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
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
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('export', 'Exporter')}
          </button>
          <button onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? t('viewList', 'Vue Liste') : 'Vue JSON'}
          </button>
        </div>
      </div>

      {/* Contenu Principal */}
      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          {/* Remplacez ce <pre> par votre composant <JsonEditor /> quand il sera prêt */}
          <pre className="text-sm text-gray-600 dark:text-gray-400 overflow-auto max-h-[500px] font-mono">
            {JSON.stringify(clients, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#111111]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('name', 'Nom')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('company', 'Entreprise')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('orders', 'Commandes')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('spent', 'Dépenses')}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{client.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <div className="font-semibold text-sari-dark dark:text-white">{client.name}</div>
                          <div className="text-xs text-gray-500">{client.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{client.company}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{client.email}</td>
                    <td className="px-6 py-4 text-sm font-bold text-sari-dark dark:text-white">{client.totalOrders || 0}</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">{client.totalSpent || '0 €'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => setEditingClient({...client})}
                        className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {t('edit', 'Éditer')}
                      </button>
                      <button onClick={() => handleDelete(client.id)}
                        className="text-red-500 hover:underline text-sm inline-flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal d'édition */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('editClient', 'Éditer le client')}</h2>
              <button onClick={() => setEditingClient(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('name', 'Nom')}</label>
                <input type="text" value={editingClient.name} onChange={(e) => setEditingClient({...editingClient, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Email</label>
                <input type="email" value={editingClient.email} onChange={(e) => setEditingClient({...editingClient, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('phone', 'Téléphone')}</label>
                <input type="text" value={editingClient.phone} onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('company', 'Entreprise')}</label>
                <input type="text" value={editingClient.company} onChange={(e) => setEditingClient({...editingClient, company: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('address', 'Adresse')}</label>
                <input type="text" value={editingClient.address} onChange={(e) => setEditingClient({...editingClient, address: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setEditingClient(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg">
                {t('cancel', 'Annuler')}
              </button>
              <button onClick={handleSaveEdit} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg">
                {t('save', 'Sauvegarder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}