// app/[locale]/payment/[id]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  CreditCard, User, Building, FileText, Globe, Lock, Copy, Upload,
  CheckCircle, AlertCircle, Clock, Info, ExternalLink, Send, Loader, Banknote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useCart } from '@/contexts/CartContext';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { loadPayments, type PaymentMethod, type PaymentType } from '@/lib/shop-store';
import { addPaymentRecord, isAutoValidated } from '@/lib/payments';
import { cardLast4, maskCardNumber, maskCvv, maskExpiry, maskPhone } from '@/lib/masks';

const CARD_TYPES: PaymentType[] = ['card-intl', 'cib'];
const MANUAL_TYPES: PaymentType[] = ['transfer', 'check'];

export default function PaymentPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('pages.payment');
  const { isAuthenticated, user } = useAuth();
  const { orders, updateOrderStatus } = useOrders();
  const { clearCart } = useCart();

  const order = orders.find(o => o.id === parseInt(id)) || null;

  const [selectedMethod, setSelectedMethod] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [cardData, setCardData] = useState({ cardNumber: '', cardName: '', expiry: '', cvv: '' });
  const [paypalEmail, setPaypalEmail] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', company: '', address: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Modes de paiement actifs (configurés dans l'admin).
  const methods = useMemo(() => loadPayments().filter((p) => p.active), []);

  // Pré-remplir les infos si connecté
  useEffect(() => {
    if (!order) return;
    if (isAuthenticated && user) {
      setCustomerInfo({
        name: user.name || '',
        email: user.email || '',
        phone: (user as any)?.phone || '',
        company: (user as any)?.company || '',
        address: '',
      });
    }
  }, [order, isAuthenticated, user]);

  // Reset des inputs quand la méthode change
  useEffect(() => {
    setCardData({ cardNumber: '', cardName: '', expiry: '', cvv: '' });
    setPaymentProof(null);
  }, [selectedMethod]);

  const method = methods.find((m) => m.id === selectedMethod) || null;
  const isCard = method ? CARD_TYPES.includes(method.type) : false;
  const isManual = method ? MANUAL_TYPES.includes(method.type) || method.type === 'cod' : false;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setPaymentProof(e.target.files[0]);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!method) {
      alert(t('selectMethod', { defaultMessage: 'Veuillez sélectionner une méthode de paiement' }));
      return;
    }
    if (isCard && (!cardData.cardNumber || !cardData.cardName || !cardData.expiry || !cardData.cvv)) {
      alert(t('fillCardInfo', { defaultMessage: 'Veuillez remplir toutes les informations de la carte' }));
      return;
    }
    if (method.type === 'paypal' && !paypalEmail) {
      alert(t('fillPaypalEmail', { defaultMessage: "Veuillez saisir l'email PayPal" }));
      return;
    }
    if (method.type === 'transfer' || method.type === 'check') {
      if (!paymentProof) {
        alert(t('uploadProof', { defaultMessage: 'Veuillez uploader la preuve de paiement' }));
        return;
      }
    }
    if (!isAuthenticated && (!customerInfo.name || !customerInfo.email)) {
      alert(t('fillInfo', { defaultMessage: 'Veuillez remplir vos informations' }));
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      if (order) {
        // Enregistre le paiement (masquage carte + statut déduit de la méthode).
        addPaymentRecord({
          orderId: order.id,
          client: isAuthenticated && user ? user.name : customerInfo.name,
          email: isAuthenticated && user ? user.email : customerInfo.email,
          method: method.type,
          methodName: method.name,
          amount: order.grandTotal || 0,
          cardLast4: isCard ? cardLast4(cardData.cardNumber) : undefined,
        });
        const auto = isAutoValidated(method.type);
        updateOrderStatus(order.id, auto ? 'paid' : 'pending_payment');
      }
      setIsProcessing(false);
      setCompleted(true);
      clearCart();
      setTimeout(() => router.push(`/${locale}/dashboard`), 1600);
    }, 1500);
  };

  // État : Aucune commande
  if (!order) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111] page-enter">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-xl">
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-yellow-500" />
            </div>
            <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-4">
              {t('noOrder', { defaultMessage: 'Aucune commande en cours' })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('noOrderDesc', { defaultMessage: "Vous n'avez pas de commande à payer." })}
            </p>
            <div className="flex gap-4 justify-center">
              <Link href={`/${locale}/panier`} className="btn-primary text-white px-6 py-3 font-semibold inline-block rounded-lg">
                {t('goToCart', { defaultMessage: 'Voir le panier' })}
              </Link>
              <Link href={`/${locale}/dashboard`} className="px-6 py-3 border-2 border-gray-300 dark:border-gray-700 font-semibold hover:border-sari-blue inline-block rounded-lg">
                {t('viewDashboard', { defaultMessage: 'Tableau de bord' })}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // État : paiement terminé
  if (completed) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111] page-enter">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-xl">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-4">
              {t('paymentDone', { defaultMessage: 'Paiement enregistré' })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {isAutoValidated(method?.type || 'other')
                ? t('paymentValidated', { defaultMessage: 'Votre paiement est validé. Merci !' })
                : t('paymentPending', { defaultMessage: 'Votre paiement est en attente de validation par notre équipe.' })}
            </p>
            <Loader className="w-5 h-5 animate-spin mx-auto mt-4 text-sari-blue" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111] page-enter">
      <div className="container mx-auto px-6">
        <Breadcrumb items={[
          { label: t('home', { defaultMessage: 'Accueil' }), href: '/' },
          { label: t('cart', { defaultMessage: 'Panier' }), href: '/panier' },
          { label: t('payment', { defaultMessage: 'Paiement' }) },
        ]} />

        <h1 className="text-4xl font-bold text-sari-dark dark:text-white mb-8">
          {t('title', { defaultMessage: 'Finaliser votre commande' })}
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-8">
            {/* Infos client (si non connecté) */}
            {!isAuthenticated && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                  <User className="w-6 h-6 text-sari-blue" />
                  {t('customerInfo', { defaultMessage: 'Vos informations' })}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('name', { defaultMessage: 'Nom complet' })} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" required value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('email', { defaultMessage: 'Email' })} <span className="text-red-500">*</span>
                    </label>
                    <input type="email" required value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('phone', { defaultMessage: 'Téléphone' })}</label>
                    <input type="tel" value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: maskPhone(e.target.value) })} placeholder="+213 …" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('company', { defaultMessage: 'Entreprise' })}</label>
                    <input type="text" value={customerInfo.company} onChange={(e) => setCustomerInfo({ ...customerInfo, company: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('address', { defaultMessage: 'Adresse de livraison' })}</label>
                    <textarea rows={3} value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg resize-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Sélection de la méthode */}
            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-sari-blue" />
                {t('selectMethodTitle', { defaultMessage: 'Choisir une méthode de paiement' })}
              </h2>
              <div className="space-y-4">
                {methods.map((m) => {
                  const Icon = iconFor(m.type);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`w-full p-6 border-2 transition-all text-left rounded-xl ${
                        selectedMethod === m.id ? 'border-sari-blue bg-sari-blue/5' : 'border-gray-200 dark:border-gray-700 hover:border-sari-blue/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedMethod === m.id ? 'bg-sari-blue text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sari-dark dark:text-white mb-1">{m.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{m.instructions || describe(m.type)}</div>
                        </div>
                        {selectedMethod === m.id && <CheckCircle className="w-6 h-6 text-sari-blue flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
                {methods.length === 0 && (
                  <p className="text-gray-500 text-center py-4">{t('noMethod', { defaultMessage: 'Aucun mode de paiement disponible.' })}</p>
                )}
              </div>
            </div>

            {/* Informations de paiement selon la méthode */}
            {method && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-6">
                  {t('paymentInfo', { defaultMessage: 'Informations de paiement' })}
                </h2>

                {/* Carte (internationale ou CIB) */}
                {isCard && (
                  <div className={`${method.type === 'cib' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'} border p-6 rounded-lg`}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                          {t('cardNumber', { defaultMessage: 'Numéro de carte' })} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text" inputMode="numeric" value={cardData.cardNumber}
                          onChange={(e) => setCardData({ ...cardData, cardNumber: maskCardNumber(e.target.value) })}
                          placeholder="1234 5678 9012 3456" maxLength={19}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                          {t('cardName', { defaultMessage: 'Nom sur la carte' })} <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={cardData.cardName} onChange={(e) => setCardData({ ...cardData, cardName: e.target.value })} placeholder="JEAN DUPONT" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg uppercase" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                            {t('expiry', { defaultMessage: "Date d'expiration" })} <span className="text-red-500">*</span>
                          </label>
                          <input type="text" inputMode="numeric" value={cardData.expiry} onChange={(e) => setCardData({ ...cardData, expiry: maskExpiry(e.target.value) })} placeholder="MM/AA" maxLength={5} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">CVV <span className="text-red-500">*</span></label>
                          <input type="password" inputMode="numeric" value={cardData.cvv} onChange={(e) => setCardData({ ...cardData, cvv: maskCvv(e.target.value) })} placeholder="123" maxLength={4} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg font-mono" />
                        </div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-3 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{t('cardSecure', { defaultMessage: 'Seuls les 4 derniers chiffres sont conservés, le reste est masqué.' })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* PayPal */}
                {method.type === 'paypal' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                    <div className="flex items-start gap-4 mb-4">
                      <Info className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('paypalRedirect', { defaultMessage: 'Vous serez redirigé vers PayPal pour finaliser votre paiement.' })}
                      </p>
                    </div>
                    <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
                      {t('paypalEmail', { defaultMessage: 'Email PayPal' })} <span className="text-red-500">*</span>
                    </label>
                    <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="votre@email.com" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded" />
                  </div>
                )}

                {/* Virement ou chèque : coordonnées + preuve */}
                {(method.type === 'transfer' || method.type === 'check') && (
                  <div>
                    <div className="bg-sari-blue/5 border border-sari-blue/20 p-6 rounded-lg mb-6">
                      <h3 className="font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
                        <Building className="w-5 h-5 text-sari-blue" />
                        {t('bankDetails', { defaultMessage: 'Coordonnées bancaires' })}
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{t('accountHolder', { defaultMessage: 'Titulaire' })} :</span>
                          <span className="font-semibold text-sari-dark dark:text-white">{method.account || 'SARI Système SARL'}</span>
                        </div>
                        {method.rib && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('rib', { defaultMessage: 'RIB' })} :</span>
                            <span className="font-semibold text-sari-dark dark:text-white font-mono">{method.rib}</span>
                          </div>
                        )}
                        {method.iban && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('iban', { defaultMessage: 'IBAN' })} :</span>
                            <span className="font-semibold text-sari-dark dark:text-white font-mono">{method.iban}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{t('reference', { defaultMessage: 'Référence' })} :</span>
                          <span className="font-semibold text-sari-dark dark:text-white font-mono">{order.id}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`Titulaire: ${method.account || 'SARI Système SARL'}\nRIB: ${method.rib || ''}\nIBAN: ${method.iban || ''}\nRéférence: ${order.id}`);
                          alert(t('copied', { defaultMessage: 'Coordonnées copiées !' }));
                        }}
                        className="mt-4 text-sm text-sari-blue hover:underline inline-flex items-center gap-1"
                      >
                        <Copy className="w-4 h-4" /> {t('copyDetails', { defaultMessage: 'Copier les coordonnées' })}
                      </button>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 text-center hover:border-sari-blue transition-colors rounded-lg">
                      <input type="file" id="payment-proof" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                      <label htmlFor="payment-proof" className="cursor-pointer">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="font-bold text-sari-dark dark:text-white mb-1">
                          {paymentProof ? t('fileUploaded', { defaultMessage: 'Fichier sélectionné' }) : t('uploadProof', { defaultMessage: 'Uploader la preuve de paiement' })}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {paymentProof ? paymentProof.name : t('uploadDesc', { defaultMessage: 'Photo du virement ou du chèque (JPG, PNG, PDF)' })}
                        </p>
                      </label>
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {t('manualValidation', { defaultMessage: 'Ce paiement sera validé manuellement par notre équipe.' })}
                    </p>
                  </div>
                )}

                {/* Paiement à la livraison (cash) */}
                {method.type === 'cod' && (
                  <div className="bg-sari-blue/5 border border-sari-blue/20 p-6 rounded-lg">
                    <div className="flex items-start gap-4">
                      <Banknote className="w-6 h-6 text-sari-blue flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-bold text-sari-dark dark:text-white mb-2">{t('codTitle', { defaultMessage: 'Paiement à la livraison' })}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('codDesc', { defaultMessage: 'Réglez en espèces à la réception de votre commande.' })}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {t('manualValidation', { defaultMessage: 'Ce paiement sera validé manuellement par notre équipe.' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar : Récapitulatif */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-6">{t('orderSummary', { defaultMessage: 'Récapitulatif' })}</h3>
              <div className="space-y-4 mb-6">
                {order.items && order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                    <div className="flex-1">
                      <div className="font-semibold text-sari-dark dark:text-white text-sm mb-1">{item.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.quantity} x {item.price}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 mb-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('subtotal', { defaultMessage: 'Sous-total' })} :</span>
                  <span className="font-semibold text-sari-dark dark:text-white">{(order.totalAmount || 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('tax', { defaultMessage: 'TVA (19%)' })} :</span>
                  <span className="font-semibold text-sari-dark dark:text-white">{(order.taxAmount || 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t border-gray-200 dark:border-gray-800">
                  <span className="font-bold text-sari-dark dark:text-white">{t('total', { defaultMessage: 'Total' })} :</span>
                  <span className="font-bold text-sari-lime">{(order.grandTotal || 0).toFixed(2)} €</span>
                </div>
              </div>
              <button
                onClick={handleSubmitPayment}
                disabled={!selectedMethod || isProcessing}
                className="w-full btn-primary text-white py-3 font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg"
              >
                {isProcessing ? (
                  <><Loader className="w-5 h-5 animate-spin" />{t('processing', { defaultMessage: 'Traitement en cours...' })}</>
                ) : (
                  <><Lock className="w-5 h-5" />{t('confirmPayment', { defaultMessage: 'Confirmer le paiement' })}</>
                )}
              </button>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> {t('securePayment', { defaultMessage: 'Paiement 100% sécurisé' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function iconFor(type: PaymentType) {
  switch (type) {
    case 'card-intl': return Globe;
    case 'cib': return CreditCard;
    case 'transfer': return Building;
    case 'paypal': return ExternalLink;
    case 'check': return FileText;
    case 'cod': return Banknote;
    default: return CreditCard;
  }
}

function describe(type: PaymentType): string {
  switch (type) {
    case 'card-intl': return 'Visa, Mastercard, etc.';
    case 'cib': return 'Carte interbancaire algérienne';
    case 'transfer': return 'Virement local ou international';
    case 'paypal': return 'Paiement sécurisé via PayPal';
    case 'check': return 'Paiement par chèque bancaire';
    case 'cod': return 'Espèces à la livraison';
    default: return '';
  }
}
