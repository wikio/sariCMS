// app/admin/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Users, UserCog, Search, Download, Plus, Edit2, Trash2, X,
  Shield, Key, FileText, QrCode, Eye, Briefcase, Mail, Phone,
  Building, Calendar, CheckCircle, AlertCircle, User
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/admin/Toast';

type UserType = 'client' | 'partner' | 'candidate' | 'admin';
type UserStatus = 'active' | 'blocked' | 'pending';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  type: UserType;
  phone: string;
  company: string;
  status: UserStatus;
  createdAt: string;
  avatar: string;
  // Champs spécifiques
  partnerCode?: string;
  secretKey?: string;
  cv?: string;
  experience?: string;
  motivation?: string;
  position?: string;
  permissions?: string[];
}

const typeConfig: Record<UserType, { label: string; color: string; gradient: string; icon: React.ElementType }> = {
  client: { label: 'Client', color: 'blue', gradient: 'from-blue-500 to-blue-600', icon: User },
  partner: { label: 'Partenaire', color: 'purple', gradient: 'from-purple-500 to-purple-600', icon: Briefcase },
  candidate: { label: 'Candidat', color: 'orange', gradient: 'from-orange-500 to-orange-600', icon: UserCog },
  admin: { label: 'Admin', color: 'red', gradient: 'from-red-500 to-red-600', icon: Shield }
};

export default function AdminUsersPage() {
  const locale = useLocale();
  const t = useTranslations('admin.users');
  const { showToast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState<{ user: AdminUser; data: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<{ user: AdminUser; password: string } | null>(null);
  const [showCVModal, setShowCVModal] = useState<AdminUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | UserType>('all');

  useEffect(() => {
    loadUsers();
  }, [locale]);

  const loadUsers = () => {
    const stored = localStorage.getItem('sari_users');
    if (stored) {
      try {
        setUsers(JSON.parse(stored));
      } catch (e) {
        setUsers([]);
      }
    } else {
      // Données par défaut
      const defaultUsers: AdminUser[] = [
        { id: 1, name: 'Dr. Marie Laurent', email: 'marie@clinique.fr', type: 'client', phone: '+213 555 123 456', company: 'Clinique Saint-Louis', status: 'active', createdAt: '2023-01-15', avatar: '👩‍⚕️' },
        { id: 2, name: 'Dr. Philippe Martin', email: 'philippe@chu.dz', type: 'client', phone: '+213 555 789 012', company: 'CHU de Lyon', status: 'active', createdAt: '2023-03-20', avatar: '👨‍⚕️' },
        { id: 3, name: 'Sarah Benali', email: 'sarah@hopital.dz', type: 'client', phone: '+213 555 345 678', company: 'Groupe Hospitalier Nord', status: 'active', createdAt: '2023-06-10', avatar: '👩‍💼' },
        { id: 4, name: 'Ahmed Kaci', email: 'ahmed@meditech.dz', type: 'partner', phone: '+213 555 901 234', company: 'MediTech International', status: 'active', createdAt: '2022-11-05', avatar: '🤝', partnerCode: 'PART-001', secretKey: 'sk_live_abc123' },
        { id: 5, name: 'Fatima Zahra', email: 'fatima@email.dz', type: 'candidate', phone: '+213 555 567 890', company: '', status: 'pending', createdAt: '2024-07-01', avatar: '👩‍🎓', cv: 'data/cv/fatima.pdf', experience: '5 ans', motivation: 'Passionnée par les équipements médicaux', position: 'Technicienne biomédicale' },
        { id: 6, name: 'Admin SARI', email: 'admin@sarisysteme.com', type: 'admin', phone: '+213 23 52 42 72', company: 'SARI Système', status: 'active', createdAt: '2020-01-01', avatar: '🛡️', permissions: ['all'] }
      ];
      setUsers(defaultUsers);
      localStorage.setItem('sari_users', JSON.stringify(defaultUsers));
    }
  };

  const saveUsers = (newUsers: AdminUser[]) => {
    setUsers(newUsers);
    localStorage.setItem('sari_users', JSON.stringify(newUsers));
    showToast(t('saveSuccess'), 'success');
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'all' || u.type === filterType;
    return matchSearch && matchType;
  });

  const handleStatusToggle = (id: number) => {
    const newUsers = users.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'blocked' : 'active' } : u);
    saveUsers(newUsers);
  };

  const handleDelete = (id: number) => {
    if (confirm(t('deleteConfirm'))) {
      saveUsers(users.filter(u => u.id !== id));
    }
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    saveUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
    setEditingUser(null);
  };

  const handleAddUser = () => {
    const newUser: AdminUser = {
      id: Date.now(),
      name: '',
      email: '',
      type: 'client',
      phone: '',
      company: '',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      avatar: '👤'
    };
    setShowAddModal(true);
    setEditingUser(newUser);
  };

  const handleSaveNew = () => {
    if (!editingUser) return;
    saveUsers([editingUser, ...users]);
    setEditingUser(null);
    setShowAddModal(false);
  };

  const generateQRCode = (user: AdminUser) => {
    const qrData = `SARI_USER:${user.id}:${user.type}:${user.email}`;
    setShowQRModal({ user, data: qrData });
  };

  const generateTempPassword = (user: AdminUser) => {
    const tempPass = 'Temp' + Math.random().toString(36).slice(-8) + '!';
    showToast(`${t('tempPassword')} : ${tempPass}`, 'info');
    setShowPasswordModal({ user, password: tempPass });
  };

  const generatePartnerCode = (user: AdminUser) => {
    const code = 'PART-' + Math.random().toString(36).slice(2, 5).toUpperCase() + '-' + Date.now().toString().slice(-4);
    const secretKey = 'sk_live_' + Math.random().toString(36).slice(2, 15);
    const updatedUser = { ...user, partnerCode: code, secretKey: secretKey };
    saveUsers(users.map(u => u.id === user.id ? updatedUser : u));
    showToast(`${t('codeGenerated')} : ${code}`, 'success');
  };

  const handleShowCV = (user: AdminUser) => {
    if (user.cv) {
      setShowCVModal(user);
    } else {
      showToast(t('noCV'), 'warning');
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${locale}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Statistiques par type
  const statsByType = Object.entries(typeConfig).map(([key, cfg]) => ({
    key: key as UserType,
    ...cfg,
    count: users.filter(u => u.type === key).length
  }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statsByType.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className={`bg-gradient-to-br ${stat.gradient} p-4 rounded-xl text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{stat.count}</div>
                  <div className="text-sm opacity-90">{stat.label}</div>
                </div>
                <Icon className="w-8 h-8 opacity-50" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | UserType)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-lg outline-none focus:border-sari-blue text-sm"
          >
            <option value="all">{t('allTypes')}</option>
            {Object.entries(typeConfig).map(([key, cfg]) => (
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
          <button
            onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2"
          >
            {viewMode === 'cards' ? <Users className="w-4 h-4" /> : <UserCog className="w-4 h-4" />}
            {viewMode === 'cards' ? 'Vue Liste' : 'Vue Cartes'}
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('export')}
          </button>
          <button onClick={handleAddUser} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('add')}
          </button>
        </div>
      </div>

      {/* Vue Cartes */}
      {viewMode === 'cards' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => {
            const tc = typeConfig[user.type] || typeConfig.client;
            return (
              <div key={user.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all">
                <div className={`bg-gradient-to-r ${tc.gradient} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                        {user.avatar}
                      </div>
                      <div>
                        <div className="font-bold">{user.name}</div>
                        <div className="text-xs opacity-90">{tc.label}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      user.status === 'active' ? 'bg-green-500' : user.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {user.status === 'active' ? t('active') : user.status === 'pending' ? 'En attente' : t('blocked')}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{user.phone}</span>
                  </div>
                  {user.company && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Building className="w-4 h-4" />
                      <span>{user.company}</span>
                    </div>
                  )}
                  {user.partnerCode && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-xs font-mono">
                      <div className="font-bold text-purple-700 dark:text-purple-400">{user.partnerCode}</div>
                      <div className="text-gray-600 dark:text-gray-400 truncate">{user.secretKey}</div>
                    </div>
                  )}
                  {user.type === 'candidate' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded text-xs">
                      <div className="font-bold text-orange-700 dark:text-orange-400">{user.position || 'Candidat'}</div>
                      <div className="text-gray-600 dark:text-gray-400">{user.experience || ''}</div>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-800 p-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => generateQRCode(user)}
                    className="flex-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3 h-3" /> QR
                  </button>
                  <button
                    onClick={() => generateTempPassword(user)}
                    className="flex-1 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs font-semibold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Key className="w-3 h-3" /> {t('password')}
                  </button>
                  {user.type === 'partner' && (
                    <button
                      onClick={() => generatePartnerCode(user)}
                      className="flex-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Shield className="w-3 h-3" /> Code
                    </button>
                  )}
                  {user.type === 'candidate' && (
                    <button
                      onClick={() => handleShowCV(user)}
                      className="flex-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center justify-center gap-1"
                    >
                      <FileText className="w-3 h-3" /> CV
                    </button>
                  )}
                  <button
                    onClick={() => setEditingUser(user)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 rounded text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleStatusToggle(user.id)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 rounded text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {user.status === 'active' ? <AlertCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vue Liste */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#111111]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('status')}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredUsers.map(user => {
                  const tc = typeConfig[user.type] || typeConfig.client;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{user.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 bg-gradient-to-br ${tc.gradient} rounded-full flex items-center justify-center text-white text-sm`}>
                            {user.avatar}
                          </div>
                          <div className="font-semibold text-sari-dark dark:text-white">{user.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold bg-${tc.color}-100 text-${tc.color}-700`}>
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.status === 'active' ? t('active') : t('blocked')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => generateQRCode(user)} className="text-blue-500 hover:underline text-sm">QR</button>
                        {user.type === 'candidate' && user.cv && (
                          <button onClick={() => handleShowCV(user)} className="text-green-500 hover:underline text-sm">CV</button>
                        )}
                        <button onClick={() => setEditingUser(user)} className="text-sari-blue hover:underline text-sm">{t('edit')}</button>
                        <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:underline text-sm">{t('delete')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal CV Candidat */}
      {showCVModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-orange-500" />
                {t('cvDetails')}
              </h2>
              <button onClick={() => setShowCVModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl">
                    {showCVModal.avatar}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{showCVModal.name}</h3>
                    <p className="text-sm opacity-90">{showCVModal.position || 'Candidat'}</p>
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Mail className="w-4 h-4" /> Email
                  </div>
                  <div className="font-semibold text-sari-dark dark:text-white">{showCVModal.email}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Phone className="w-4 h-4" /> {t('phone')}
                  </div>
                  <div className="font-semibold text-sari-dark dark:text-white">{showCVModal.phone}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" /> {t('experience')}
                  </div>
                  <div className="font-semibold text-sari-dark dark:text-white">{showCVModal.experience || 'Non spécifié'}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" /> Date de candidature
                  </div>
                  <div className="font-semibold text-sari-dark dark:text-white">{showCVModal.createdAt}</div>
                </div>
              </div>
              {showCVModal.motivation && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                  <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400 mb-2 font-bold">
                    <Eye className="w-4 h-4" /> {t('motivation')}
                  </div>
                  <p className="text-sari-dark dark:text-white">{showCVModal.motivation}</p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-[#111111] p-4 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <FileText className="w-4 h-4" /> Fichier CV
                </div>
                <a
                  href={showCVModal.cv}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le CV
                </a>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowCVModal(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition */}
      {editingUser && !showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('editUser')}</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('name')}</label>
                <input type="text" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Email</label>
                <input type="email" value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('phone')}</label>
                <input type="text" value={editingUser.phone} onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('company')}</label>
                <input type="text" value={editingUser.company} onChange={(e) => setEditingUser({...editingUser, company: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('type')}</label>
                <select value={editingUser.type} onChange={(e) => setEditingUser({...editingUser, type: e.target.value as UserType})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">{t('cancel')}</button>
              <button onClick={handleSaveEdit} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout */}
      {showAddModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('addUser')}</h2>
              <button onClick={() => { setEditingUser(null); setShowAddModal(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('name')}</label>
                <input type="text" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">Email</label>
                <input type="email" value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('type')}</label>
                <select value={editingUser.type} onChange={(e) => setEditingUser({...editingUser, type: e.target.value as UserType})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => { setEditingUser(null); setShowAddModal(false); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">{t('cancel')}</button>
              <button onClick={handleSaveNew} className="btn-primary text-white px-4 py-2 font-semibold rounded-lg">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('qrCode')}</h2>
              <button onClick={() => setShowQRModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center">
              <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-lg mb-4">
                <QrCode className="w-32 h-32 text-sari-dark dark:text-white mx-auto" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{showQRModal.user.name}</p>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded block break-all">{showQRModal.data}</code>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowQRModal(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mot de passe temporaire */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('tempPassword')}</h2>
              <button onClick={() => setShowPasswordModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center">
              <Key className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{showPasswordModal.user.name}</p>
              <code className="text-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-4 py-2 rounded block font-mono">{showPasswordModal.password}</code>
              <p className="text-xs text-gray-500 mt-2">{t('passwordNote')}</p>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowPasswordModal(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">{t('close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}