// app/[locale]/dashboard/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, User, Briefcase, Mail, Package, FileText, LogOut, CheckCircle,
  Clock, ShoppingBag, CreditCard, Inbox, Activity, Handshake, Plus, Minus, Trash2,
  Search, MapPin, Banknote, Target, Award, Gift, ChevronDown, ChevronUp, Eye,
  MessageCircle, AlertTriangle, X, Send,
} from 'lucide-react';
import { useAuth, frontToken } from '@/contexts/AuthContext';
import { useApplications } from '@/contexts/ApplicationsContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useCart } from '@/contexts/CartContext';
import { getProducts } from '@/lib/data';
import type { Product } from '@/types';
import QuoteRequestModule from '@/components/dashboard/QuoteRequestModule';
import MessagesModule from '@/components/dashboard/MessagesModule';
import ProfileModule from '@/components/dashboard/ProfileModule';
import { unreadForUser, ensureThread, sendMessage } from '@/lib/messages';
import { isBackOfficeUser } from '@/lib/admin-session';
import DateText from '@/components/shared/DateText';
import { useCurrency } from '@/lib/use-currency';
import { paymentTypeLabel, normalizeOrderPaymentType } from '@/lib/payments';
import { cmsFetch } from '@/lib/cms';

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations('pages.dashboard');
  const { withSymbol, format: formatMoney } = useCurrency();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { applications, removeApplication } = useApplications();
  const { orders, removeOrder, updateOrderStatus } = useOrders();
  const { items: cart, addToCart, removeFromCart, updateQuantity, total: cartTotal } = useCart();
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [productQ, setProductQ] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [cancelModal, setCancelModal] = useState<{ order: any; reason: string } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const refreshUnread = () => setUnreadMessages(user?.email ? unreadForUser(user.email) : 0);
    refreshUnread();
    window.addEventListener('sari-threads-changed', refreshUnread);
    return () => window.removeEventListener('sari-threads-changed', refreshUnread);
  }, [user?.email]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/connexion`);
      return;
    }
    // L'espace personnel est réservé aux clients, partenaires et candidats :
    // un administrateur dispose du back-office et est redirigé vers celui-ci.
    if (isBackOfficeUser(user?.type)) {
      router.replace(`/${locale}/admin/dashboard`);
    }
  }, [isAuthenticated, locale, router, user?.type]);

  useEffect(() => {
    if (user?.type === 'client' || user?.type === 'partner') {
      getProducts(locale).then(setProducts);
    }
  }, [locale, user?.type]);

  // Ce filtre doit rester AVANT le retour anticipé ci-dessous : un hook
  // placé après un « return » conditionnel n'est pas appelé à chaque
  // rendu, ce que React refuse (« Rendered more hooks than during the
  // previous render »). Il ne dépend pas de l'utilisateur, donc le
  // calculer systématiquement ne coûte rien.
  const filteredProducts = useMemo(() => {
    const q = productQ.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  }, [products, productQ]);

  // Pas de rendu pendant la redirection : évite que l'espace client
  // n'apparaisse une fraction de seconde à un administrateur.
  if (!user || isBackOfficeUser(user.type)) return null;

  const isCandidate = user.type === 'candidate';
  const isPartner = user.type === 'partner';
  const isClient = user.type === 'client';

  const myOrders = orders.filter((o) => o.userId === user.id || (o.customerEmail && o.customerEmail === user.email));
  const myQuotes = myOrders.filter((o) => o.isQuote || o.status === 'quote_requested');
  const realOrders = myOrders.filter((o) => !o.isQuote && o.status !== 'quote_requested');

  const menuItems = [
    { id: 'overview', label: t('overview'), icon: LayoutDashboard },
    { id: 'products', label: t('productsTab'), icon: ShoppingBag, show: isClient || isPartner },
    { id: 'orders', label: t('orders'), icon: Package, show: isClient },
    { id: 'quotes', label: t('quotes'), icon: FileText, show: isClient },
    { id: 'applications', label: t('applications'), icon: Briefcase, show: isCandidate },
    { id: 'messages', label: t('messages'), icon: Mail },
    { id: 'profile', label: t('profile'), icon: User },
  ].filter((item) => item.show !== false);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string }> = {
      pending: { label: t('statusPending'), color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
      pending_payment: { label: t('waitingPayment'), color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      reviewed: { label: t('statusReviewed'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      interview: { label: 'Entretien', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
      accepted: { label: t('statusAccepted'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      paid: { label: t('paymentConfirmed'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      shipped: { label: t('orderShipped'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      delivered: { label: t('orderDelivered'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      rejected: { label: t('statusRejected'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
      cancelled: { label: t('cancel'), color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
      cancel_requested: { label: t('cancelRequested', { defaultMessage: 'Annulation demandée' }), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
      quote_requested: { label: t('quoteRequested'), color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    };
    const c = config[status] || config.pending;
    return <span className={`px-3 py-1 text-xs font-bold rounded-full ${c.color}`}>{c.label}</span>;
  };

  const handleLogout = () => {
    logout();
    router.push(`/${locale}`);
  };

  const handleMessageForOrder = (order: any) => {
    if (!user?.email) return;
    const code = order.code || `#${order.id}`;
    const subject = `Commande ${code} — ${order.status}`;
    const thread = ensureThread({
      email: user.email,
      name: user.name,
      type: 'client' as const,
      subject,
      context: { kind: 'order' as const, id: order.id, ref: code },
    });
    // Pré-remplir un message d'intention si le fil est vide
    try {
      if (thread.messages.length === 0) {
        // ne pas envoyer auto, juste créer le fil
      }
      localStorage.setItem('sari_pending_open_thread', thread.id);
    } catch {}
    setActiveTab('messages');
    // petit délai pour laisser MessagesModule se charger puis ouvrir
    setTimeout(() => window.dispatchEvent(new Event('sari-threads-changed')), 100);
  };

  const canShowPayButton = (order: any) => {
    const norm = normalizeOrderPaymentType((order as any).payment || 'pending');
    const isPendingStatus = order.status === 'pending' || order.status === 'pending_payment';
    const isCod = norm === 'cod';
    const isPaid = order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered';
    const isCancelled = order.status === 'cancelled' || order.status === 'cancel_requested';
    if (isCancelled || isPaid) return false;
    // Affiche si en attente OU si COD (pour changer d'avis et payer autrement)
    return isPendingStatus || isCod || norm === 'pending';
  };

  const isPaymentDone = (order: any) => {
    const norm = normalizeOrderPaymentType((order as any).payment || 'pending');
    return order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered' || (norm !== 'pending' && norm !== 'cod' && order.status !== 'pending' && order.status !== 'pending_payment');
  };

  const handleCancelClick = (order: any) => {
    const paid = isPaymentDone(order) || order.status === 'shipped' || order.status === 'delivered';
    const norm = normalizeOrderPaymentType((order as any).payment || 'pending');
    const isCodPending = norm === 'cod' && (order.status === 'pending' || order.status === 'pending_payment');
    // Si paiement effectué (hors COD en attente), demande confirmation via modal
    if (paid && !isCodPending) {
      setCancelModal({ order, reason: '' });
    } else {
      // Annulation directe pour commandes non payées
      if (confirm(t('confirmCancel', { defaultMessage: 'Annuler cette commande ?' }))) {
        removeOrder(order.id);
        // sync backend si possible
        try {
          const token = frontToken();
          cmsFetch(`/orders/${order.id}`, { method: 'PATCH', json: { status: 'cancelled' }, ...(token ? { token } : {}), timeoutMs: 6000 }).catch(()=>{});
        } catch {}
      }
    }
  };

  const confirmCancelRequest = async () => {
    if (!cancelModal) return;
    setCancelLoading(true);
    const order = cancelModal.order;
    try {
      // Local: passe en cancel_requested pour revue admin
      updateOrderStatus(order.id, 'cancel_requested' as any);
      // Backend: PATCH status + history note
      const token = frontToken();
      await cmsFetch(`/orders/${order.id}`, {
        method: 'PATCH',
        json: { status: 'cancel_requested', adminNotes: cancelModal.reason || 'Demande d\'annulation client', history: [...(order.history||[]), { status: 'cancel_requested', at: new Date().toISOString(), note: cancelModal.reason || 'Demande annulation' }] },
        ...(token ? { token } : {}),
        timeoutMs: 8000,
      }).catch(()=>{});
      // Optionnel: créer un fil de discussion pour suivi remboursement
      try {
        const thread = ensureThread({
          email: user.email,
          name: user.name,
          type: 'client' as const,
          subject: `Demande d'annulation — Commande ${order.code || order.id}`,
          context: { kind: 'order' as const, id: order.id, ref: order.code },
        });
        const body = `Bonjour, je souhaite annuler la commande ${order.code || '#' + order.id} (montant ${formatMoney(order.grandTotal, { decimals: 2 })}).` + (cancelModal.reason ? ` Motif : ${cancelModal.reason}` : '') + ` Merci de me confirmer l'annulation et le remboursement.`;
        sendMessage(thread.id, 'user', body);
      } catch {}
    } catch {}
    setCancelLoading(false);
    setCancelModal(null);
  };

  const RoleIcon = isCandidate ? User : isPartner ? Handshake : ShoppingBag;
  const roleLabel = isCandidate ? 'Compte Candidat' : isPartner ? 'Compte Partenaire' : 'Compte Client';

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-sari-blue to-sari-dark text-white p-8 shadow-xl mb-8 rounded-xl">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30">
              <RoleIcon className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">{t('welcome')}, {user.name} !</h1>
              <p className="text-blue-100 capitalize">{roleLabel}</p>
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
                  const badge = item.id === 'applications' ? applications.length : item.id === 'orders' ? realOrders.length : item.id === 'quotes' ? myQuotes.length : item.id === 'messages' ? unreadMessages : null;
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
                      {badge != null && badge > 0 && (
                        <span className={`ml-auto px-2 py-0.5 text-xs font-bold rounded-full ${activeTab === item.id ? 'bg-white text-sari-blue' : 'bg-sari-blue text-white'}`}>
                          {badge}
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
            {/* === OVERVIEW === */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-sari-dark dark:text-white">{t('overviewTitle')}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('overviewDesc')}</p>
                </div>

                {/* KPI cards */}
                <div className="grid md:grid-cols-3 gap-4">
                  {isCandidate && (
                    <>
                      <Kpi icon={Briefcase} color="sari-blue" value={applications.length} label={t('totalApplications')} />
                      <Kpi icon={CheckCircle} color="green" value={applications.filter((a) => a.status === 'accepted').length} label={t('accepted')} />
                      <Kpi icon={Clock} color="orange" value={applications.filter((a) => a.status === 'pending').length} label={t('pending')} />
                    </>
                  )}
                  {isClient && (
                    <>
                      <Kpi icon={ShoppingBag} color="sari-blue" value={cart.length} label={t('cartItems')} />
                      <Kpi icon={Package} color="green" value={realOrders.length} label={t('totalOrders')} />
                      <Kpi icon={FileText} color="orange" value={myQuotes.length} label={t('totalQuotes')} />
                    </>
                  )}
                  {isPartner && (
                    <>
                      <Kpi icon={ShoppingBag} color="sari-blue" value={products.length} label={t('products')} />
                      <Kpi icon={Handshake} color="green" value={realOrders.length} label={t('referrals')} />
                      <Kpi icon={Banknote} color="orange" value={formatMoney(realOrders.reduce((s, o) => s + o.grandTotal, 0))} label={t('revenue')} />
                    </>
                  )}
                </div>

                {/* Quick actions */}
                <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl p-6">
                  <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-sari-blue" /> {t('quickActions')}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {isCandidate && <Link href={`/${locale}/carrieres`} className="btn-primary text-white px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2"><Briefcase className="w-4 h-4" /> {t('browseJobs')}</Link>}
                    {(isClient || isPartner) && <button onClick={() => setActiveTab('products')} className="btn-primary text-white px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> {t('browseCatalog')}</button>}
                    {isClient && <Link href={`/${locale}/contact`} className="bg-sari-lime text-sari-dark px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2"><FileText className="w-4 h-4" /> {t('requestQuote')}</Link>}
                    <button onClick={() => setActiveTab('profile')} className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2"><User className="w-4 h-4" /> {t('editProfile')}</button>
                  </div>
                </div>

                {/* Recent activity */}
                {(isClient || isPartner) && realOrders.length > 0 && (
                  <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl p-6">
                    <h3 className="font-bold text-sari-dark dark:text-white mb-4">{t('recentOrders')}</h3>
                    <div className="space-y-3">
                      {realOrders.slice(0, 5).map((o) => (
                        <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-sari-blue" />
                            <div>
                              <div className="font-semibold text-sari-dark dark:text-white">#{o.id}</div>
                              <div className="text-xs text-gray-500"><DateText value={o.createdAt} dateOnly /></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sari-dark dark:text-white">{formatMoney(o.grandTotal, { decimals: 2 })}</span>
                            {getStatusBadge(o.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === PRODUCTS === */}
            {activeTab === 'products' && (isClient || isPartner) && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3"><ShoppingBag className="w-6 h-6 text-sari-blue" /> {t('productsTab')}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('productsDesc')}</p>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Rechercher…" className="pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg focus:border-sari-blue outline-none" />
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
                    <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">{t('noProducts')}</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredProducts.map((p) => {
                      const inCart = cart.some((i) => String(i.id) === String(p.id));
                      const qty = cart.find((i) => String(i.id) === String(p.id))?.quantity || 0;
                      return (
                        <div key={p.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl overflow-hidden flex flex-col">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="h-36 w-full object-cover" />
                          ) : (
                            <div className="h-36 w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Package className="w-10 h-10 text-gray-400" /></div>
                          )}
                          <div className="p-4 flex flex-col flex-1">
                            <div className="text-xs text-sari-blue font-bold uppercase tracking-wide">{p.category || '—'}</div>
                            <h3 className="font-bold text-sari-dark dark:text-white mt-1 line-clamp-2">{p.name}</h3>
                            {p.shortDesc && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.shortDesc}</p>}
                            <div className="mt-auto pt-3 flex items-center justify-between">
                              <span className="font-black text-sari-dark dark:text-white">{withSymbol(p.price)}</span>
                              {inCart ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => updateQuantity(p.id, qty - 1)} className="p-1.5 border border-gray-300 dark:border-gray-700 rounded"><Minus className="w-3.5 h-3.5" /></button>
                                  <span className="text-sm font-bold w-6 text-center">{qty}</span>
                                  <button onClick={() => updateQuantity(p.id, qty + 1)} className="p-1.5 border border-gray-300 dark:border-gray-700 rounded"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Link href={`/${locale}/products/${p.id}`} className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 hover:border-sari-blue hover:text-sari-blue transition inline-flex items-center gap-1.5 bg-white dark:bg-[#1a1a1a]"><Eye className="w-3.5 h-3.5" /> Détail</Link>
                                  <button onClick={() => addToCart({ id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image || '', category: p.category })} className="btn-primary text-white px-3 py-1.5 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> {t('addToCart')}</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="bg-sari-blue text-white rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="w-6 h-6" />
                      <span className="font-bold">{cart.length} {t('products')} · {formatMoney(cartTotal)}</span>
                    </div>
                    <Link href={`/${locale}/cart`} className="bg-white text-sari-blue px-4 py-2 font-semibold rounded-lg">{t("viewCart", { defaultMessage: "Voir le panier" })}</Link>
                  </div>
                )}
              </div>
            )}

            {/* === APPLICATIONS (candidat) === */}
            {activeTab === 'applications' && isCandidate && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
                  <Briefcase className="w-6 h-6 text-sari-blue" /> {t('myApplications')} ({applications.length})
                </h2>
                {applications.length === 0 ? (
                  <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
                    <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noApplications')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t('noApplicationsDesc')}</p>
                    <Link href={`/${locale}/carrieres`} className="btn-primary text-white px-6 py-3 inline-block font-semibold rounded-lg">{t('browseJobs')}</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => (
                      <div key={app.id} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                        <div className="flex items-start gap-4">
                          {app.image && <img src={app.image} alt={app.title} className="w-20 h-20 object-cover rounded-lg" />}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-xl font-bold text-sari-dark dark:text-white">{app.title}</h3>
                              {getStatusBadge(app.status)}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {app.location}</span>
                              <span className="flex items-center gap-1"><Banknote className="w-4 h-4" /> {app.salary}</span>
                              <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {app.type}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('appliedOn')} <DateText value={app.appliedAt} dateOnly /></div>
                            <div className="flex gap-2">
                              <Link href={`/${locale}/jobs/${app.jobId}`} className="text-sari-blue font-semibold hover:underline text-sm">{t('viewOffer')}</Link>
                              <button onClick={() => removeApplication(app.id)} className="text-red-500 hover:underline text-sm">{t('withdraw')}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === ORDERS (client) === */}
            {activeTab === 'orders' && isClient && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
                  <Package className="w-6 h-6 text-sari-blue" /> {t('myOrders')} ({realOrders.length})
                </h2>
                {realOrders.length === 0 ? (
                  <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noOrders')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t('noOrdersDesc')}</p>
                    <button onClick={() => setActiveTab('products')} className="btn-primary text-white px-6 py-3 inline-block font-semibold rounded-lg">{t('browseProducts')}</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {realOrders.map((order) => {
                      const isExpanded = !!expandedOrders[String(order.id)];
                      const toggle = () => setExpandedOrders((prev) => ({ ...prev, [String(order.id)]: !prev[String(order.id)] }));
                      const paymentLabel = paymentTypeLabel(normalizeOrderPaymentType((order as any).payment || 'pending'));
                      const showPay = canShowPayButton(order);
                      const isCancelled = order.status === 'cancelled' || order.status === 'cancel_requested';
                      return (
                      <div key={order.id} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl overflow-hidden">
                        {/* En-tête repliable : infos de base code / date / paiement / montant / bouton + flèche */}
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-sm text-sari-dark dark:text-white">{t('orderNumber')} #{order.code || order.id}</span>
                              <span className="px-2 py-0.5 bg-sari-blue/10 text-sari-blue rounded-full font-mono text-[10px] border border-sari-blue/20">{paymentLabel}</span>
                              <span className="hidden sm:inline-flex">{getStatusBadge(order.status)}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> <DateText value={order.createdAt} dateOnly /></span>
                              <span className="font-mono">{(order as any).code || `#${order.id}`}</span>
                              <span className="sm:hidden">{getStatusBadge(order.status)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right hidden sm:block">
                              <div className="font-black text-sari-lime text-base leading-none">{formatMoney(order.grandTotal, { decimals: 2 })}</div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('total')}</div>
                            </div>
                            <div className="sm:hidden font-black text-sari-lime text-sm">{formatMoney(order.grandTotal, { decimals: 2 })}</div>
                            {showPay ? (
                              <Link href={`/${locale}/payment/${order.id}`} onClick={(e)=> e.stopPropagation()} className="hidden sm:inline-flex btn-primary text-white px-3 py-1.5 text-xs font-semibold rounded-lg items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5" /> {t('completePayment')}
                              </Link>
                            ) : isCancelled ? (
                              <span className="hidden sm:inline-flex text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">{t('cancelRequested', { defaultMessage: 'Annulation demandée' })}</span>
                            ) : (
                              <span className="hidden sm:inline-flex text-xs text-gray-400">—</span>
                            )}
                            <button
                              aria-label={isExpanded ? 'Replier' : 'Déplier'}
                              aria-expanded={isExpanded}
                              onClick={toggle}
                              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        {/* Actions rapides en mode replié (mobile) */}
                        {(showPay || !isCancelled) && (
                          <div className="sm:hidden px-4 pb-3 flex gap-2">
                            {showPay && (
                              <Link href={`/${locale}/payment/${order.id}`} className="flex-1 btn-primary text-white px-3 py-2 text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2">
                                <CreditCard className="w-4 h-4" /> {t('completePayment')}
                              </Link>
                            )}
                            {!isCancelled && (
                              <button onClick={() => handleCancelClick(order)} className="px-3 py-2 border border-red-200 dark:border-red-800 text-red-500 rounded-lg text-sm">{t('cancel')}</button>
                            )}
                            <button onClick={() => handleMessageForOrder(order)} className="px-3 py-2 border border-sari-blue/30 text-sari-blue rounded-lg text-sm inline-flex items-center gap-1"><MessageCircle className="w-4 h-4" /> Msg</button>
                          </div>
                        )}
                        {/* Contenu déplié : liste articles */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#111111]/50 p-4 space-y-3 animate-in">
                            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Articles · {order.items.length}</div>
                            <div className="space-y-2">
                              {Array.isArray(order.items) && order.items.length > 0 ? order.items.map((it: any) => {
                                const unit = Number(String(it.price).replace(/[^0-9.]/g,'')) || 0;
                                return (
                                <div key={String(it.id)+it.name} className="flex items-center justify-between text-sm bg-white dark:bg-[#1a1a1a] p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                  <span className="text-gray-700 dark:text-gray-300 truncate pr-3">{it.name} <span className="text-gray-400">× {it.quantity}</span></span>
                                  <span className="font-semibold text-sari-dark dark:text-white whitespace-nowrap">{formatMoney(unit * Number(it.quantity||1))}</span>
                                </div>
                              )}) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400 italic">{t('noItems', { defaultMessage: 'Aucun article détaillé' })} — {formatMoney(order.grandTotal, { decimals: 2 })}</div>
                              )}
                            </div>
                            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                              <span className="font-bold text-sari-dark dark:text-white text-sm">{t('total')}</span>
                              <span className="font-black text-sari-lime">{formatMoney(order.grandTotal, { decimals: 2 })}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {showPay ? (
                                <>
                                  <Link href={`/${locale}/payment/${order.id}`} className="flex-1 btn-primary text-white px-4 py-2 font-semibold text-center rounded-lg inline-flex items-center justify-center gap-2 text-sm">
                                    <CreditCard className="w-4 h-4" /> {t('completePayment')}
                                  </Link>
                                  {!isCancelled && (
                                    <button onClick={() => handleCancelClick(order)} className="px-4 py-2 border-2 border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm">{t('cancel')}</button>
                                  )}
                                  <button onClick={() => handleMessageForOrder(order)} className="px-4 py-2 border border-sari-blue/30 text-sari-blue hover:bg-sari-blue/5 rounded-lg text-sm inline-flex items-center gap-2"><MessageCircle className="w-4 h-4" /> {t('contactAboutOrder', { defaultMessage: 'Message' })}</button>
                                </>
                              ) : isCancelled ? (
                                <div className="w-full flex flex-col gap-2">
                                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/> {t('cancelReview', { defaultMessage: 'Demande d\'annulation transmise — en attente de validation admin et remboursement.' })}</div>
                                  <button onClick={() => handleMessageForOrder(order)} className="px-4 py-2 bg-sari-blue text-white rounded-lg text-sm inline-flex items-center gap-2 self-start"><MessageCircle className="w-4 h-4" /> {t('sendMessage', { defaultMessage: 'Envoyer un message' })}</button>
                                </div>
                              ) : (
                                <div className="w-full flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Paiement : {paymentLabel} · {t('syncedWithAdmin', { defaultMessage: 'Synchronisé avec l’admin' })}</span>
                                  <button onClick={() => handleMessageForOrder(order)} className="px-3 py-1.5 text-xs border border-sari-blue/30 text-sari-blue rounded-lg inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {t('contact', { defaultMessage: 'Contacter' })}</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}

            {/* === QUOTES / DEMANDE DE DEVIS (client) === */}
            {activeTab === 'quotes' && isClient && (
              <QuoteRequestModule user={user} locale={locale} />
            )}

            {/* === MESSAGES === */}
            {activeTab === 'messages' && (
              <MessagesModule user={user} />
            )}

            {/* === PROFILE === */}
            {activeTab === 'profile' && <ProfileModule />}
          </div>
        </div>
      </div>
      {/* Modal annulation avec remboursement */}
      {cancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !cancelLoading && setCancelModal(null)} />
          <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-orange-600" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-black text-sari-dark dark:text-white">{t('cancelOrderTitle', { defaultMessage: 'Demander l\'annulation ?' })}</h3>
                    <p className="text-xs text-gray-500">{t('orderNumber')} #{cancelModal.order.code || cancelModal.order.id} · {formatMoney(cancelModal.order.grandTotal, { decimals: 2 })}</p>
                  </div>
                </div>
                <button onClick={() => !cancelLoading && setCancelModal(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-sm text-amber-800 dark:text-amber-200 mb-4">
                {t('cancelPaidWarning', { defaultMessage: 'Cette commande a déjà été payée. Elle ne sera pas supprimée immédiatement. Votre demande sera transmise à l\'administration pour validation et remboursement. Vous serez notifié.' })}
              </div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('cancelReason', { defaultMessage: 'Motif (optionnel)' })}</label>
              <textarea value={cancelModal.reason} onChange={(e)=> setCancelModal({ ...cancelModal, reason: e.target.value })} rows={3} placeholder={t('cancelReasonPlaceholder', { defaultMessage: 'Ex: erreur de commande, délai trop long...' })} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-xl outline-none focus:border-red-500" />
              <div className="flex gap-3 mt-6">
                <button onClick={()=> setCancelModal(null)} disabled={cancelLoading} className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">{t('keepOrder', { defaultMessage: 'Garder la commande' })}</button>
                <button onClick={confirmCancelRequest} disabled={cancelLoading} className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-xl font-black shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">{cancelLoading ? '...' : <><Trash2 className="w-4 h-4" /> {t('confirmCancelRequest', { defaultMessage: 'Confirmer la demande' })}</>}</button>
              </div>
              <button onClick={()=> { handleMessageForOrder(cancelModal.order); setCancelModal(null); }} className="w-full mt-3 px-4 py-2.5 border border-sari-blue/30 text-sari-blue rounded-xl font-semibold inline-flex items-center justify-center gap-2 hover:bg-sari-blue/5"><MessageCircle className="w-4 h-4" /> {t('messageAboutOrder', { defaultMessage: 'Envoyer un message à propos de cette commande' })}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, color, value, label }: { icon: React.ElementType; color: string; value: number | string; label: string }) {
  const colorClasses: Record<string, string> = {
    'sari-blue': 'bg-sari-blue/10 text-sari-blue',
    'green': 'bg-green-500/10 text-green-500',
    'orange': 'bg-orange-500/10 text-orange-500',
  };
  return (
    <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color] || colorClasses['sari-blue']}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-3xl font-bold text-sari-dark dark:text-white">{value}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
        </div>
      </div>
    </div>
  );
}
