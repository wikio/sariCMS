// app/admin/applications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Download, Table, Code, Eye, Trash2, X, Star, Eye as EyeIcon, Users } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

export default function AdminApplicationsPage() {
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();

  const [applications, setApplications] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'json'>('list');
  const [editingApp, setEditingApp] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadApplications();
  }, [locale]);

  const loadApplications = () => {
    const stored = localStorage.getItem('sari_applications');
    if (stored) {
      try { setApplications(JSON.parse(stored)); } catch (e) { setApplications([]); }
    } else {
      // Fallback Phase 1
      setApplications([
        { id: 1, candidate: 'Fatima Zahra', email: 'fatima@email.dz', phone: '+213 555 567 890', jobTitle: 'Technicien Biomédical', jobId: 1, status: 'new', date: '2024-07-15', experience: '3 ans', motivation: 'Passionnée par les équipements médicaux...' },
        { id: 2, candidate: 'Karim Boudiaf', email: 'karim@email.dz', phone: '+213 555 111 222', jobTitle: 'Commercial Médical', jobId: 2, status: 'reviewed', date: '2024-07-10', experience: '5 ans', motivation: 'Expert en vente de dispositifs médicaux...' }
      ]);
    }
  };

  const saveApplications = (newApps: any[]) => {
    setApplications(newApps);
    localStorage.setItem('sari_applications', JSON.stringify(newApps));
    showToast(t('applications.saveSuccess', 'Candidatures sauvegardées !'), 'success');
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    new: { label: t('applications.statusNew', 'Nouvelle'), color: 'blue' },
    reviewed: { label: t('applications.statusReviewed', 'Examinée'), color: 'yellow' },
    interview: { label: t('applications.statusInterview', 'Entretien'), color: 'purple' },
    accepted: { label: t('applications.statusAccepted', 'Acceptée'), color: 'green' },
    rejected: { label: t('applications.statusRejected', 'Refusée'), color: 'red' }
  };

  const filteredApps = applications.filter(a => {
    const matchSearch = !searchQuery || a.candidate.toLowerCase().includes(searchQuery.toLowerCase()) || a.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = (id: number, newStatus: string) => {
    saveApplications(applications.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  const handleDelete = (id: number) => {
    if (confirm(t('applications.deleteConfirm', 'Supprimer ?'))) {
      saveApplications(applications.filter(a => a.id !== id));
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(applications, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `applications_${locale}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast(t('applications.exportSuccess', 'Exporté !'), 'success');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 rounded-xl text-center">
            <div className="text-2xl font-bold text-sari-dark dark:text-white">{applications.filter(a => a.status === key).length}</div>
            <div className="text-xs text-gray-500">{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm">
            <option value="all">{t('applications.allStatus', 'Tous les statuts')}</option>
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
              placeholder={t('applications.search', 'Rechercher...')} 
              className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm" 
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('applications.export', 'Exporter')}
          </button>
          <button onClick={() => setViewMode(viewMode === 'json' ? 'list' : 'json')} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            {viewMode === 'json' ? <Table className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'json' ? t('applications.viewList', 'Vue Liste') : 'Vue JSON'}
          </button>
        </div>
      </div>

      {viewMode === 'json' ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
          <textarea
            value={JSON.stringify(applications, null, 2)}
            onChange={(e) => {
              try { saveApplications(JSON.parse(e.target.value)); } catch (err) {}
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Candidat</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Poste</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredApps.map(app => {
                  const sc = statusConfig[app.status] || statusConfig.new;
                  return (
                    <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{app.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-sari-dark dark:text-white">{app.candidate}</div>
                        <div className="text-xs text-gray-500">{app.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-sari-dark dark:text-white">{app.jobTitle}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{app.date}</td>
                      <td className="px-6 py-4">
                        <select 
                          value={app.status} 
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}
                          className={`px-2 py-1 rounded-full text-xs font-semibold border-0 outline-none bg-${sc.color}-100 text-${sc.color}-700`}
                        >
                          {Object.entries(statusConfig).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => setEditingApp(app)} className="text-sari-blue hover:underline text-sm inline-flex items-center gap-1">
                          <EyeIcon className="w-3 h-3" /> Voir
                        </button>
                        <button onClick={() => handleDelete(app.id)} className="text-red-500 hover:underline text-sm inline-flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal détail */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">Détail de la candidature</h2>
              <button onClick={() => setEditingApp(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-sm text-gray-500">Candidat</span><div className="font-bold text-sari-dark dark:text-white">{editingApp.candidate}</div></div>
                <div><span className="text-sm text-gray-500">Email</span><div className="font-bold text-sari-dark dark:text-white">{editingApp.email}</div></div>
                <div><span className="text-sm text-gray-500">Téléphone</span><div className="font-bold text-sari-dark dark:text-white">{editingApp.phone}</div></div>
                <div><span className="text-sm text-gray-500">Expérience</span><div className="font-bold text-sari-dark dark:text-white">{editingApp.experience}</div></div>
              </div>
              <div><span className="text-sm text-gray-500">Poste</span><div className="font-bold text-sari-dark dark:text-white">{editingApp.jobTitle}</div></div>
              <div>
                <span className="text-sm text-gray-500">Motivation</span>
                <div className="mt-2 p-4 bg-gray-50 dark:bg-[#111111] rounded-lg text-sm text-sari-dark dark:text-white whitespace-pre-wrap">{editingApp.motivation}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setEditingApp(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}