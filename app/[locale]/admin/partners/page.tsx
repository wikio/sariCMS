// app/admin/partners/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Download, Code, Table, Handshake, Image, Plus, Edit, Trash2, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

interface Partner {
  id: number;
  name: string;
  logo: string;
  category: string;
  contact: string;
  phone: string;
  status: 'active' | 'pending';
}

export default function AdminPartnersPage() {
  const locale = useLocale();
  const t = useTranslations('admin.partners');
  const { showToast } = useToast();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPartners();
  }, [locale]);

  const loadPartners = () => {
    const stored = localStorage.getItem('sari_admin_partners');
    if (stored) {
      try { setPartners(JSON.parse(stored)); } catch (e) {}
    } else {
      const defaultPartners: Partner[] = [
        { id: 1, name: 'MediTech International', logo: 'https://via.placeholder.com/150x80/169EC9/FFFFFF?text=MEDI+TECH', category: 'Équipements', contact: 'contact@meditech.com', phone: '+33 1 23 45 67 89', status: 'active' },
        { id: 2, name: 'HealthCare Solutions', logo: 'https://via.placeholder.com/150x80/C6DA34/333333?text=HEALTHCARE', category: 'Consommables', contact: 'info@healthcare.com', phone: '+33 1 98 76 54 32', status: 'active' },
        { id: 3, name: 'BioMedical Pro', logo: 'https://via.placeholder.com/150x80/EAB616/333333?text=BIOMED', category: 'Diagnostic', contact: 'sales@biomed.com', phone: '+33 4 56 78 90 12', status: 'active' },
        { id: 4, name: 'SurgiCare', logo: 'https://via.placeholder.com/150x80/169EC9/FFFFFF?text=SURGICARE', category: 'Chirurgie', contact: 'info@surgicare.com', phone: '+33 4 12 34 56 78', status: 'active' },
        { id: 5, name: 'MedEquip Global', logo: 'https://via.placeholder.com/150x80/333333/FFFFFF?text=MEDEQUIP', category: 'Équipements', contact: 'global@medequip.com', phone: '+44 20 1234 5678', status: 'active' },
        { id: 6, name: 'PharmaDist', logo: 'https://via.placeholder.com/150x80/C6DA34/333333?text=PHARMA', category: 'Consommables', contact: 'dist@pharma.com', phone: '+33 5 67 89 01 23', status: 'pending' }
      ];
      setPartners(defaultPartners);
      localStorage.setItem('sari_admin_partners', JSON.stringify(defaultPartners));
    }
  };

  const savePartners = (newPartners: Partner[]) => {
    setPartners(newPartners);
    localStorage.setItem('sari_admin_partners', JSON.stringify(newPartners));
    showToast(t('saveSuccess', 'Partenaires sauvegardés !'), 'success');
  };

  const filteredPartners = partners.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = () => {
    const newPartner: Partner = { id: Date.now(), name: '', logo: '', category: '', contact: '', phone: '', status: 'pending' };
    setPartners([newPartner, ...partners]);
    setEditingPartner(newPartner);
  };

  const handleDelete = (id: number) => {
    if (confirm(t('deleteConfirm', 'Supprimer ?'))) {
      savePartners(partners.filter(p => p.id !== id));
    }
  };

  const handleSaveEdit = () => {
    if (!editingPartner) return;
    savePartners(partners.map(p => p.id === editingPartner.id ? editingPartner : p));
    setEditingPartner(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(partners, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partners_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <Handshake className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white">{t('title', 'Partenaires')}</h1>
            <p className="text-sm text-gray-500">{partners.length} {t('total', 'partenaire(s)')}</p>
          </div>
        </div>
        <div className="flex gap-2">
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
          <button 
            onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? 'Vue Liste' : 'Vue JSON'}
          </button>
          <button onClick={handleAdd} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('add', 'Ajouter')}
          </button>
        </div>
      </div>

      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <textarea
            value={JSON.stringify(partners, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) savePartners(parsed);
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Logo</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('name', 'Nom')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('category', 'Catégorie')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('contact', 'Contact')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('status', 'Statut')}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredPartners.map(partner => (
                  <tr key={partner.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{partner.id}</td>
                    <td className="px-6 py-4">
                      {partner.logo ? (
                        <img src={partner.logo} alt="" className="h-10 object-contain" />
                      ) : (
                        <div className="w-16 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                          <Image className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-sari-dark dark:text-white">{partner.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{partner.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{partner.contact}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        partner.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {partner.status === 'active' ? t('active', 'Actif') : t('pending', 'En attente')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => setEditingPartner({...partner})}
                        className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" /> {t('edit', 'Éditer')}
                      </button>
                      <button 
                        onClick={() => handleDelete(partner.id)}
                        className="text-red-500 hover:underline text-sm inline-flex items-center gap-1"
                      >
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

      {/* Modal édition */}
      {editingPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('editPartner', 'Éditer le partenaire')}</h2>
              <button onClick={() => setEditingPartner(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('name', 'Nom')}</label>
                <input 
                  type="text" 
                  value={editingPartner.name} 
                  onChange={(e) => setEditingPartner({...editingPartner, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Logo URL</label>
                <input 
                  type="text" 
                  value={editingPartner.logo} 
                  onChange={(e) => setEditingPartner({...editingPartner, logo: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('category', 'Catégorie')}</label>
                <input 
                  type="text" 
                  value={editingPartner.category} 
                  onChange={(e) => setEditingPartner({...editingPartner, category: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('contact', 'Contact')}</label>
                <input 
                  type="email" 
                  value={editingPartner.contact} 
                  onChange={(e) => setEditingPartner({...editingPartner, contact: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('phone', 'Téléphone')}</label>
                <input 
                  type="text" 
                  value={editingPartner.phone} 
                  onChange={(e) => setEditingPartner({...editingPartner, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setEditingPartner(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
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