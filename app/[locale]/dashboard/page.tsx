// app/[locale]/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, User, Briefcase, Mail, Package, FileText, 
  LogOut, CheckCircle, Clock, ShoppingBag, Edit, Upload, Save,
  CreditCard, Inbox, Activity, Handshake
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApplications } from '@/contexts/ApplicationsContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useCart } from '@/contexts/CartContext';

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations('pages.dashboard');
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { applications, removeApplication } = useApplications();
  const { orders, removeOrder } = useOrders();
  const { items: cart } = useCart();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/connexion`);
    }
  }, [isAuthenticated, locale, router]);

  if (!user) return null;

  const menuItems = [
    { id: 'overview', label: t('overview'), icon: LayoutDashboard },
    { id: 'profile', label: t('profile'), icon: User },
    { id: 'applications', label: t('applications'), icon: Briefcase },
    { id: 'messages', label: t('messages'), icon: Mail },
    { id: 'orders', label: t('orders'), icon: Package, show: user.type === 'client' },
    { id: 'quotes', label: t('quotes'), icon: FileText, show: user.type === 'client' },
  ].filter((item) => item.show !== false);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string }> = {
      pending: { label: t('statusPending'), color: 'bg-yellow-100 text-yellow-700' },
      reviewed: { label: t('statusReviewed'), color: 'bg-blue-100 text-blue-700' },
      accepted: { label: t('statusAccepted'), color: 'bg-green-100 text-green-700' },
      rejected: { label: t('statusRejected'), color: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || config.pending;
    return <span className={`px-3 py-1 text-xs font-bold rounded-full ${c.color}`}>{c.label}</span>;
  };

  const handleLogout = () => {
    logout();
    router.push(`/${locale}`);
  };

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-sari-blue to-sari-dark text-white p-8 shadow-xl mb-8 rounded-xl">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30">
              {user.type === 'candidate' ? <User className="w-10 h-10" /> : user.type === 'partner' ? <Handshake className="w-10 h-10" /> : <ShoppingBag className="w-10 h-10" />}
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {t('welcome')}, {user.name} !
              </h1>
              <p className="text-blue-100 capitalize">
                {user.type === 'candidate' ? 'Compte Candidat' : user.type === 'partner' ? 'Compte Partenaire' : 'Compte Client'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl overflow-hidden sticky top-32">
              <nav className="p-4 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        activeTab === item.id
                          ? 'bg-sari-blue text-white font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{item.label}</span>
                      {item.id === 'applications' && applications.length > 0 && (
                        <span className={`ml-auto px-2 py-0.5 text-xs font-bold rounded-full ${
                          activeTab === item.id ? 'bg-white text-sari-blue' : 'bg-sari-blue text-white'
                        }`}>
                          {applications.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-gray-200 dark:border-gray-800 p-4">
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('logout')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="lg:col-span-3">
            {/* TAB: Vue d'ensemble */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('overviewTitle')}</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {user.type === 'candidate' && (
                    <>
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-sari-blue/10 rounded-lg flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-sari-blue" />
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-sari-dark dark:text-white">{applications.length}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('totalApplications')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-sari-dark dark:text-white">
                              {applications.filter((a) => a.status === 'accepted').length}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('accepted')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                            <Clock className="w-6 h-6 text-orange-500" />
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-sari-dark dark:text-white">
                              {applications.filter((a) => a.status === 'pending').length}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('pending')}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {user.type === 'client' && (
                    <>
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-sari-blue/10 rounded-lg flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-sari-blue" />
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-sari-dark dark:text-white">{cart.length}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('cartItems')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-green-500" />
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-sari-dark dark:text-white">
                              {orders.filter((o) => o.userId === user.id).length}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('orders')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-purple-500" />
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-sari-dark dark:text-white">
                              {orders.filter((o) => o.userId === user.id && o.isQuote).length}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('quotes')}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Activité récente */}
                <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                  <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-sari-blue" />
                    {t('recentActivity')}
                  </h3>
                  {applications.length === 0 && user.type === 'candidate' ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('noActivity')}</p>
                      <Link href={`/${locale}/carrieres`} className="text-sari-blue font-semibold hover:underline mt-2 inline-block">
                        {t('browseJobs')}
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {applications.slice(0, 5).map((app) => (
                        <div key={app.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <div className="w-10 h-10 bg-sari-blue/10 rounded-lg flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-sari-blue" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sari-dark dark:text-white text-sm">{app.title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {t('appliedOn')} {new Date(app.appliedAt).toLocaleDateString()}
                            </div>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions rapides */}
                <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                  <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-4">
                    {t('quickActions')}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <button onClick={() => setActiveTab('profile')} className="p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-lg text-left">
                      <div className="flex items-center gap-3">
                        <Edit className="w-5 h-5 text-sari-blue" />
                        <span className="font-semibold text-sari-dark dark:text-white">{t('editProfile')}</span>
                      </div>
                    </button>
                    {user.type === 'candidate' && (
                      <button onClick={() => setActiveTab('applications')} className="p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-lg text-left">
                        <div className="flex items-center gap-3">
                          <Briefcase className="w-5 h-5 text-sari-blue" />
                          <span className="font-semibold text-sari-dark dark:text-white">{t('viewApplications')}</span>
                        </div>
                      </button>
                    )}
                    {user.type === 'client' && (
                      <button onClick={() => router.push(`/${locale}/produits`)} className="p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-lg text-left">
                        <div className="flex items-center gap-3">
                          <ShoppingBag className="w-5 h-5 text-sari-blue" />
                          <span className="font-semibold text-sari-dark dark:text-white">{t('browseProducts')}</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Mon profil */}
            {activeTab === 'profile' && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                  <User className="w-6 h-6 text-sari-blue" />
                  {t('myProfile')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('fullName')}</label>
                    <input type="text" defaultValue={user.name} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('email')}</label>
                    <input type="email" defaultValue={user.email} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('phone')}</label>
                    <input type="tel" defaultValue={(user as any).phone || ''} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  {user.type === 'candidate' && (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('cv')}</label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 text-center hover:border-sari-blue transition-colors rounded-lg">
                          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">{(user as any).cv || t('uploadCv')}</p>
                          <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX (max 5MB)</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('linkedin')}</label>
                        <input type="url" defaultValue={(user as any).linkedin || ''} placeholder="https://linkedin.com/in/..." className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                      </div>
                    </>
                  )}
                  {user.type === 'client' && (
                    <div>
                      <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('company')}</label>
                      <input type="text" defaultValue={(user as any).company || ''} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                    </div>
                  )}
                  <button className="btn-primary text-white px-6 py-3 font-semibold rounded-lg flex items-center gap-2">
                    <Save className="w-5 h-5" />
                    {t('saveChanges')}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Candidatures */}
            {activeTab === 'applications' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
                  <Briefcase className="w-6 h-6 text-sari-blue" />
                  {t('myApplications')} ({applications.length})
                </h2>
                {applications.length === 0 ? (
                  <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
                    <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noApplications')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t('noApplicationsDesc')}</p>
                    <Link href={`/${locale}/carrieres`} className="btn-primary text-white px-6 py-3 inline-block font-semibold rounded-lg">
                      {t('browseJobs')}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => (
                      <div key={app.id} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-start gap-4">
                          <img src={app.image} alt={app.title} className="w-20 h-20 object-cover rounded-lg" />
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-xl font-bold text-sari-dark dark:text-white">{app.title}</h3>
                              {getStatusBadge(app.status)}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                              <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {app.location}</span>
                              <span className="flex items-center gap-1"><CreditCard className="w-4 h-4" /> {app.salary}</span>
                              <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {app.type}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                              {t('appliedOn')} {new Date(app.appliedAt).toLocaleDateString()}
                            </div>
                            <div className="flex gap-2">
                              <Link href={`/${locale}/emplois/${app.jobId}`} className="text-sari-blue font-semibold hover:underline text-sm">
                                {t('viewOffer')}
                              </Link>
                              <button onClick={() => removeApplication(app.id)} className="text-red-500 hover:underline text-sm">
                                {t('withdraw')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Commandes (pour clients) */}
            {activeTab === 'orders' && user.type === 'client' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
                  <Package className="w-6 h-6 text-sari-blue" />
                  {t('myOrders')} ({orders.filter((o) => o.userId === user.id).length})
                </h2>
                {orders.filter((o) => o.userId === user.id).length === 0 ? (
                  <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noOrders')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t('noOrdersDesc')}</p>
                    <Link href={`/${locale}/produits`} className="btn-primary text-white px-6 py-3 inline-block font-semibold rounded-lg">
                      {t('browseProducts')}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.filter((o) => o.userId === user.id).map((order) => (
                      <div key={order.id} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                              {t('orderNumber')} #{order.id}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('items')}</div>
                            <div className="font-semibold text-sari-dark dark:text-white">
                              {order.items.length} {t('products')}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('total')}</div>
                            <div className="font-bold text-sari-lime text-lg">
                              {order.grandTotal.toFixed(2)} €
                            </div>
                          </div>
                        </div>
                        {order.status === 'pending' && (
                          <div className="flex gap-2">
                            <Link href={`/${locale}/paiement/${order.id}`} className="flex-1 btn-primary text-white px-4 py-2 font-semibold text-center rounded-lg inline-flex items-center justify-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              {t('completePayment')}
                            </Link>
                            <button onClick={() => removeOrder(order.id)} className="px-4 py-2 border-2 border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                              {t('cancel')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Messages */}
            {activeTab === 'messages' && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                  <Mail className="w-6 h-6 text-sari-blue" />
                  {t('messages')}
                </h2>
                <div className="text-center py-12">
                  <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noMessages')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('noMessagesDesc')}</p>
                </div>
              </div>
            )}

            {/* TAB: Devis */}
            {activeTab === 'quotes' && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-sari-blue" />
                  {t('quotes')}
                </h2>
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noQuotes')}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">{t('noQuotesDesc')}</p>
                  <Link href={`/${locale}/contact`} className="btn-primary text-white px-6 py-3 inline-block font-semibold rounded-lg">
                    {t('requestQuote')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}