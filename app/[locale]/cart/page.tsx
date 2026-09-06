// app/[locale]/panier/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Shield, CheckCircle, LogIn, FileText } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, type Order, type OrderItem } from '@/contexts/OrdersContext';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { useCurrency } from '@/lib/use-currency';
import ImageCaptcha from '@/components/ImageCaptcha';
import { computeTotals } from '@/lib/commerce-math';
import { loadTaxes, type TaxRule } from '@/lib/shop-store';
import { loadAdminSettings } from '@/lib/admin-settings';

export default function CartPage() {
  const locale = useLocale();
  const t = useTranslations('pages.cart');
  const router = useRouter();
  
  const { format: formatMoney, withSymbol } = useCurrency();
  const { items: cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { addOrder } = useOrders();

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  /** Vrai pendant la création de la commande et la navigation vers le paiement. */
  const [redirecting, setRedirecting] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaError, setCaptchaError] = useState('');

  /**
   * Règles de taxe configurées dans l'administration.
   *
   * Elles vivent dans le `localStorage` : la lecture doit donc attendre le
   * montage, sinon le rendu serveur et le premier rendu client divergent.
   */
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  useEffect(() => { setTaxes(loadTaxes()); }, []);

  const antispam = loadAdminSettings().security?.siteCaptcha !== false;

  /**
   * Totaux calculés par le moteur commun, et non par un taux écrit en dur.
   *
   * Le panier appliquait « × 0,19 » quelles que soient les règles définies
   * dans Administration → Taxes : une TVA réduite, une éco-taxe fixe ou une
   * taxe déjà incluse dans le prix étaient toutes ignorées, et le tableau
   * affichait un montant qui ne correspondait à rien.
   */
  const totals = useMemo(() => {
    const items = cart.map((item) => ({
      id: Number(item.id) || 0,
      name: item.name,
      price: parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0,
      quantity: item.quantity,
      discount: 0,
      category: item.category || undefined,
    }));
    return computeTotals(items, taxes);
  }, [cart, taxes]);

  const totalAmount = totals.subtotal;
  const taxAmount = totals.taxTotal;
  const grandTotal = totals.total;

  const createOrderAndRedirect = (options: { isQuote?: boolean; customerName?: string; customerEmail?: string; customerPhone?: string; customerCompany?: string } = {}) => {
    // Le panier tolère des ids/prix textuels et une catégorie absente ; une
    // commande exige des champs stricts. On normalise à la conversion.
    const orderItems: OrderItem[] = cart.map((item) => ({
      id: Number(item.id),
      name: item.name,
      price: String(item.price),
      quantity: item.quantity,
      image: item.image,
      category: item.category || '',
    }));

    const orderData = {
      items: orderItems,
      totalAmount,
      taxAmount,
      grandTotal,
      userId: isAuthenticated ? user?.id || null : null,
      customerName: isAuthenticated ? user?.name || '' : options.customerName || '',
      customerEmail: isAuthenticated ? user?.email || '' : options.customerEmail || '',
      customerPhone: isAuthenticated ? (user as any)?.phone || '' : (options.customerPhone || ''),
      customerCompany: isAuthenticated ? (user as any)?.company || '' : (options.customerCompany || ''),
      customerType: isAuthenticated ? user?.type || 'guest' : 'guest',
      isGuest: !isAuthenticated,
      isQuote: options.isQuote || false,
      status: (options.isQuote ? 'quote_requested' : 'pending') as Order['status'],
    };
    return addOrder(orderData);
  };

  /**
   * Crée la commande, affiche l'écran de transition, puis navigue.
   *
   * Le panier était vidé avant la navigation : la page se re-rendait
   * immédiatement, tombait sur `cart.length === 0` et affichait « votre panier
   * est vide » à la place de l'attente. On garde donc le panier jusqu'à ce que
   * la page de paiement soit demandée, et on le vide seulement ensuite.
   */
  const goToPayment = (orderId: number | string) => {
    setRedirecting(true);
    router.push(`/${locale}/payment/${orderId}`);
    // Laisse le temps à la navigation de partir avant de toucher au panier.
    setTimeout(() => clearCart(), 600);
  };

  /** L'antispam ne s'applique qu'aux visiteurs non authentifiés. */
  const antispamPasse = () => {
    if (!antispam || isAuthenticated) return true;
    if (captchaOk) return true;
    setCaptchaError(t('captchaRequired'));
    return false;
  };

  const handleCheckout = () => {
    if (cart.length === 0 || redirecting) return;
    if (isAuthenticated) {
      const order = createOrderAndRedirect();
      goToPayment(order.id);
    } else {
      setShowCheckoutModal(true);
    }
  };

  const handleCheckoutOption = (option: string) => {
    if (option === 'login') {
      localStorage.setItem('sari_pending_cart', JSON.stringify(cart));
      router.push(`/${locale}/connexion?source=produit`);
      return;
    }
    // Paiement et demande de devis créent une commande : on protège les deux.
    if (!antispamPasse()) return;

    if (option === 'pay') {
      const order = createOrderAndRedirect();
      setShowCheckoutModal(false);
      goToPayment(order.id);
    } else if (option === 'quote') {
      createOrderAndRedirect({ isQuote: true });
      setShowCheckoutModal(false);
      setOrderSubmitted(true);
      clearCart();
      setTimeout(() => {
        setOrderSubmitted(false);
        router.push(`/${locale}`);
      }, 3000);
    }
  };

  if (orderSubmitted) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-xl">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-4">{t('quoteSent')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">{t('quoteSentDesc')}</p>
            <Link href={`/${locale}`} className="btn-primary text-white px-8 py-3 font-semibold inline-block rounded-lg">
              {t('backHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /*
   * Écran de transition, placé AVANT le test du panier vide.
   *
   * La commande est créée et la navigation lancée : sans cet écran, l'ordre
   * des rendus faisait apparaître « votre panier est vide » pendant la
   * fraction de seconde qui précède l'arrivée sur la page de paiement.
   */
  if (redirecting) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-xl">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-sari-blue animate-spin" />
            <h1 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('preparingPayment')}</h1>
            <p className="text-gray-600 dark:text-gray-400">{t('preparingPaymentDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-xl">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-10 h-10 text-gray-400" />
            </div>
            <h1 className="text-3xl font-bold text-sari-dark dark:text-white mb-4">{t('empty')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">{t('emptyDesc')}</p>
            <Link href={`/${locale}/products`} className="btn-primary text-white px-8 py-3 font-semibold inline-block rounded-lg">
              {t('browseProducts')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        <Breadcrumb items={[
          { label: t('home'), href: '/' },
          { label: t('products'), href: '/products' },
          { label: t('cart') }
        ]} />
        <h1 className="text-4xl font-bold text-sari-dark dark:text-white mb-8">
          {t('title')} ({cart.length} {t('items')})
        </h1>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, index) => (
              <div key={index} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl flex items-center gap-4">
                <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-bold text-sari-dark dark:text-white mb-2">{item.name}</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{item.category}</div>
                  <div className="text-lg font-bold text-sari-lime">{withSymbol(item.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">-</button>
                  <span className="w-12 text-center font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">+</button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-6">{t('summary')}</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('subtotal')} :</span>
                  <span className="font-semibold text-sari-dark dark:text-white">{formatMoney(totalAmount, { decimals: 2 })}</span>
                </div>
                {/*
                  * Une ligne par règle de taxe, avec son libellé et son taux.
                  * Une taxe « incluse » est déjà comprise dans le prix affiché :
                  * on la signale sans l'ajouter une seconde fois au total.
                  */}
                {totals.taxLines.length === 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('tax')} :</span>
                    <span className="font-semibold text-sari-dark dark:text-white">{formatMoney(taxAmount, { decimals: 2 })}</span>
                  </div>
                ) : (
                  totals.taxLines.map((line) => (
                    <div key={line.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {line.name}
                        {line.mode === 'percent' && <span className="opacity-70"> ({line.rate} %)</span>}
                        {line.included && <span className="opacity-70"> · {t('taxIncluded')}</span>}
                        {' :'}
                      </span>
                      <span className="font-semibold text-sari-dark dark:text-white">
                        {formatMoney(line.amount, { decimals: 2 })}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-lg pt-3 border-t border-gray-200 dark:border-gray-800">
                  <span className="font-bold text-sari-dark dark:text-white">{t('total')} :</span>
                  <span className="font-bold text-sari-lime">{formatMoney(grandTotal, { decimals: 2 })}</span>
                </div>
              </div>
              <button onClick={handleCheckout} className="w-full btn-primary text-white py-3 font-semibold shadow-lg flex items-center justify-center gap-2 rounded-lg">
                <CreditCard className="w-5 h-5" />
                {t('checkout')}
              </button>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  {t('securePayment')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-sari-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-sari-blue" />
              </div>
              <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('checkoutOptions')}</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('checkoutOptionsDesc')}</p>
            </div>
            {/*
              * Antispam avant toute création de commande par un visiteur non
              * authentifié — que ce soit pour payer ou pour demander un devis.
              */}
            {antispam && !isAuthenticated && (
              <div className="mb-4">
                <ImageCaptcha onChange={(ok) => { setCaptchaOk(ok); if (ok) setCaptchaError(''); }} />
                {captchaError && (
                  <p className="text-xs text-red-500 mt-1">{captchaError}</p>
                )}
              </div>
            )}
            <div className="space-y-3">
              <button onClick={() => handleCheckoutOption('login')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue transition-all rounded-lg text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sari-blue/10 rounded-lg flex items-center justify-center group-hover:bg-sari-blue transition-colors">
                    <LogIn className="w-5 h-5 text-sari-blue group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sari-dark dark:text-white">{t('optionLogin')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('optionLoginDesc')}</div>
                  </div>
                </div>
              </button>
              <button onClick={() => handleCheckoutOption('pay')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-lime transition-all rounded-lg text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sari-lime/10 rounded-lg flex items-center justify-center group-hover:bg-sari-lime transition-colors">
                    <CreditCard className="w-5 h-5 text-sari-lime group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sari-dark dark:text-white">{t('optionPay')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('optionPayDesc')}</div>
                  </div>
                </div>
              </button>
              <button onClick={() => handleCheckoutOption('quote')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 transition-all rounded-lg text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                    <FileText className="w-5 h-5 text-purple-500 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sari-dark dark:text-white">{t('optionQuote')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('optionQuoteDesc')}</div>
                  </div>
                </div>
              </button>
            </div>
            <button onClick={() => setShowCheckoutModal(false)} className="w-full mt-4 py-2 text-gray-500 hover:text-sari-dark dark:hover:text-white text-sm flex items-center justify-center gap-2">
              <span className="text-lg">×</span>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}