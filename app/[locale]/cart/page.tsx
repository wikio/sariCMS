// app/[locale]/cart/page.tsx — Tunnel de vente modernisé (3 étapes)
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Shield, CheckCircle, LogIn, FileText, ArrowLeft, ArrowRight, MapPin, Truck, Tag, AlertTriangle, Info, Package, ClipboardList, X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, type Order } from '@/contexts/OrdersContext';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { useCurrency } from '@/lib/use-currency';
import ImageCaptcha from '@/components/ImageCaptcha';
import { computeTotals } from '@/lib/commerce-math';
import { loadTaxes, loadCoupons, type TaxRule, type Coupon } from '@/lib/shop-store';
import { loadShopConfig, type ShopConfig, formatZoneLabel, getShippingFeeForZone } from '@/lib/shop-config';
import { loadAdminSettings } from '@/lib/admin-settings';

type Step = 1 | 2 | 3;

export default function CartPage() {
  const locale = useLocale();
  const t = useTranslations('pages.cart');
  const router = useRouter();
  const { format: formatMoney, withSymbol } = useCurrency();
  const { items: cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { addOrder } = useOrders();

  const [step, setStep] = useState<Step>(1);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaError, setCaptchaError] = useState('');

  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [saleConditionsAccepted, setSaleConditionsAccepted] = useState(false);
  const [showZonesHelp, setShowZonesHelp] = useState(false);

  useEffect(() => {
    setTaxes(loadTaxes());
    const cfg = loadShopConfig();
    setShopConfig(cfg);
    // zone par défaut : première zone active
    const active = cfg.saleZones.find(z => z.active);
    if (active) setSelectedZone(active.code);
    const handler = () => setShopConfig(loadShopConfig());
    window.addEventListener('sari-shop-config-changed', handler);
    return () => window.removeEventListener('sari-shop-config-changed', handler);
  }, []);

  const antispam = loadAdminSettings().security?.siteCaptcha !== false;

  // Vérifie disponibilité par produit vs zone choisie
  const unavailableProducts = useMemo(() => {
    if (!shopConfig || !selectedZone) return [];
    return cart.filter(item => {
      const zones = (item as any).zones as string[] | undefined;
      if (Array.isArray(zones) && zones.length > 0) {
        return !zones.includes(selectedZone) && !zones.includes('ALL') && !zones.includes('DZ-ALL');
      }
      const gz = shopConfig.saleZones.find(z => z.code === selectedZone);
      if (gz && !gz.active) return true;
      return false;
    });
  }, [cart, selectedZone, shopConfig]);

  const totals = useMemo(() => {
    const items = cart.map(item => ({
      id: String(item.id),
      name: item.name,
      price: parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0,
      quantity: item.quantity,
      discount: (item as any).discount || 0,
      discountValue: (item as any).discountValue,
      discountType: (item as any).discountType,
      category: item.category || undefined,
      shippingFee: (item as any).shippingFee,
      shippingType: (item as any).shippingType,
      vatRate: (item as any).vatRate,
      vatIncluded: (item as any).vatIncluded,
      taxRate: (item as any).taxRate,
      zones: (item as any).zones,
    }));
    return computeTotals(items as any, taxes, appliedCoupon, { zone: selectedZone, shopConfig });
  }, [cart, taxes, appliedCoupon, selectedZone, shopConfig]);

  const handleApplyCoupon = () => {
    setCouponError('');
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponError('Saisissez un code'); return; }
    const all = loadCoupons();
    const found = all.find(c => c.code.toUpperCase() === code);
    if (!found) { setCouponError('Coupon introuvable'); return; }
    if (!found.active) { setCouponError('Coupon inactif'); return; }
    const now = new Date().toISOString().slice(0,10);
    if (found.start && now < found.start) { setCouponError(`Actif à partir du ${found.start}`); return; }
    if (found.end && now > found.end) { setCouponError('Coupon expiré'); return; }
    if (found.limitGlobal && found.used >= found.limitGlobal) { setCouponError('Coupon épuisé'); return; }
    if (found.minOrder && totals.subtotal < found.minOrder) { setCouponError(`Minimum ${formatMoney(found.minOrder)} requis`); return; }
    // scope check
    if (found.scope === 'category' && found.scopeValues?.length) {
      const has = cart.some(c => found.scopeValues!.includes(c.category || ''));
      if (!has) { setCouponError('Aucun article de la catégorie cible'); return; }
    }
    if (found.scope === 'product' && found.scopeValues?.length) {
      const has = cart.some(c => found.scopeValues!.includes(c.name));
      if (!has) { setCouponError('Aucun produit éligible'); return; }
    }
    setAppliedCoupon(found);
    setCouponError('');
  };

  const handleRemoveCoupon = () => { setAppliedCoupon(null); setCouponCode(''); };

  const createOrderAndRedirect = (options: { isQuote?: boolean; customerName?: string; customerEmail?: string; customerPhone?: string; customerCompany?: string } = {}) => {
    const orderItems = cart.map(item => ({
      id: Number(item.id) || Date.now(),
      name: item.name,
      price: String(item.price),
      quantity: item.quantity,
      image: item.image,
      category: item.category || '',
      discount: (item as any).discount,
      discountValue: (item as any).discountValue,
      discountType: (item as any).discountType,
      shippingFee: (item as any).shippingFee,
      shippingType: (item as any).shippingType,
      vatRate: (item as any).vatRate,
      taxRate: (item as any).vatRate,
      zones: (item as any).zones,
    }));
    const orderData: any = {
      items: orderItems,
      totalAmount: totals.subtotal,
      taxAmount: totals.taxTotal,
      grandTotal: totals.total,
      subtotal: totals.subtotal,
      discountTotal: totals.discount,
      shippingFee: totals.shipping,
      taxTotal: totals.taxTotal,
      globalDiscount: totals.globalDiscount,
      taxLines: totals.taxLines,
      userId: isAuthenticated ? (user as any)?.id || null : null,
      customerName: isAuthenticated ? (user as any)?.name || '' : options.customerName || '',
      customerEmail: isAuthenticated ? (user as any)?.email || '' : options.customerEmail || '',
      customerPhone: isAuthenticated ? (user as any)?.phone || '' : (options.customerPhone || ''),
      customerCompany: isAuthenticated ? (user as any)?.company || '' : (options.customerCompany || ''),
      customerType: isAuthenticated ? (user as any)?.type || 'guest' : 'guest',
      isGuest: !isAuthenticated,
      isQuote: options.isQuote || false,
      status: (options.isQuote ? 'quote_requested' : 'pending') as Order['status'],
      saleZone: selectedZone,
      deliveryZone: selectedZone,
      deliveryAddress,
      notes: customerNotes,
      saleConditionsAccepted,
      coupon: appliedCoupon?.code,
    };
    return addOrder(orderData);
  };

  const goToPayment = (orderId: number | string) => {
    setRedirecting(true);
    router.push(`/${locale}/payment/${orderId}`);
    setTimeout(() => clearCart(), 600);
  };

  const antispamPasse = () => {
    if (!antispam || isAuthenticated) return true;
    if (captchaOk) return true;
    setCaptchaError(t('captchaRequired'));
    return false;
  };

  const handleCheckout = () => {
    if (cart.length === 0 || redirecting) return;
    if (unavailableProducts.length > 0) {
      alert(`Certains articles ne sont pas livrables en ${formatZoneLabel(selectedZone)} : ${unavailableProducts.map(p=>p.name).join(', ')}`);
      return;
    }
    if (!saleConditionsAccepted) {
      alert('Veuillez accepter les conditions de vente');
      return;
    }
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
      setTimeout(() => { setOrderSubmitted(false); router.push(`/${locale}`); }, 3000);
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
            <Link href={`/${locale}`} className="btn-primary text-white px-8 py-3 font-semibold inline-block rounded-lg">{t('backHome')}</Link>
          </div>
        </div>
      </div>
    );
  }

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
            <Link href={`/${locale}/products`} className="btn-primary text-white px-8 py-3 font-semibold inline-block rounded-lg">{t('browseProducts')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const Stepper = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[
        { n: 1, label: 'Panier', icon: ShoppingCart },
        { n: 2, label: 'Livraison & Zone', icon: Truck },
        { n: 3, label: 'Paiement', icon: CreditCard },
      ].map((s, i) => {
        const Icon = s.icon;
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-12 h-0.5 ${done ? 'bg-sari-blue' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            <button onClick={() => setStep(s.n as Step)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${active ? 'bg-sari-blue text-white shadow-lg' : done ? 'bg-green-100 text-green-700' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-500'}`}>
              <Icon className="w-4 h-4" /> {s.n}. {s.label} {done && <CheckCircle className="w-4 h-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('products'), href: '/products' }, { label: t('cart') }]} />
        <h1 className="text-4xl font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-sari-blue" /> {t('title')} <span className="text-lg font-normal text-gray-500">({cart.length} {t('items')})</span>
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 flex items-center gap-2">
          <Info className="w-4 h-4" /> Tunnel en 3 étapes — vous pouvez revenir en arrière à tout moment pour modifier les quantités ou annuler un article.
        </p>

        <Stepper />

        {/* Zones indisponibles */}
        {unavailableProducts.length > 0 && (
          <div className="max-w-5xl mx-auto mb-6 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-400 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-bold text-orange-700 dark:text-orange-300">Zone non livrable pour certains articles</div>
              <div className="text-gray-700 dark:text-gray-300">En {formatZoneLabel(selectedZone)} : {unavailableProducts.map(p=>p.name).join(', ')} — choisissez une autre zone ou retirez ces articles.</div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item, index) => (
                <div key={index} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl flex items-center gap-4">
                  <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg" />
                  <div className="flex-1">
                    <h3 className="font-bold text-sari-dark dark:text-white mb-1">{item.name}</h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{item.category} { (item as any).sku && <span className="font-mono">· {(item as any).sku}</span>}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {(item as any).discountValue ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Remise {(item as any).discountValue}{(item as any).discountType==='percent'?'%':' DA'}</span> : null}
                      {(item as any).vatRate ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">TVA {(item as any).vatRate}%{(item as any).vatIncluded?' incl.':''}</span> : null}
                      {(item as any).shippingFee ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Livraison {(item as any).shippingFee} DA {(item as any).shippingType==='per_qty'?'×Qté':''}</span> : null}
                      {(item as any).zones?.length ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1"><MapPin className="w-3 h-3"/>{(item as any).zones.join(', ')}</span> : null}
                    </div>
                    <div className="text-lg font-bold text-sari-lime mt-1">{withSymbol(item.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-center"><Minus className="w-4 h-4"/></button>
                    <span className="w-12 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-center"><Plus className="w-4 h-4"/></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))}
              <div className="flex flex-wrap gap-3">
                <Link href={`/${locale}/products`} className="ad-btn ad-btn-ghost inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Continuer les achats</Link>
                <button onClick={() => clearCart()} className="ad-btn ad-btn-ghost text-red-600"><X className="w-4 h-4"/> Vider le panier</button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32 space-y-4">
                <h3 className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-2"><ClipboardList className="w-5 h-5"/> {t('summary')}</h3>
                {/* Coupon */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}><Tag className="w-3 h-3 inline mr-1"/>Coupon</label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <input className="ad-input flex-1 font-mono uppercase" placeholder="SARI10" value={couponCode} onChange={e=>setCouponCode(e.target.value)} />
                      <button onClick={handleApplyCoupon} className="ad-btn ad-btn-ghost">Appliquer</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 p-2 rounded-lg">
                      <span className="font-mono font-bold text-green-700">{appliedCoupon.code} -{appliedCoupon.type==='percent'?`${appliedCoupon.amount}%`:formatMoney(appliedCoupon.amount)}</span>
                      <button onClick={handleRemoveCoupon} className="text-xs text-red-600">Retirer</button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                </div>
                {/* Totaux */}
                <div className="space-y-2 text-sm border-t pt-4" style={{borderColor:'var(--ad-line)'}}>
                  <div className="flex justify-between"><span className="text-gray-600">Sous-total HT</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                  {totals.productDiscount>0 && <div className="flex justify-between text-green-600"><span>Remises produits</span><strong>-{formatMoney(totals.productDiscount)}</strong></div>}
                  {totals.globalDiscount>0 && <div className="flex justify-between text-green-600"><span>Remise globale</span><strong>-{formatMoney(totals.globalDiscount)}</strong></div>}
                  {totals.couponDiscount>0 && <div className="flex justify-between text-green-600"><span>Coupon {appliedCoupon?.code}</span><strong>-{formatMoney(totals.couponDiscount)}</strong></div>}
                  {totals.productShipping>0 && <div className="flex justify-between"><span>Livraison produits</span><strong>{formatMoney(totals.productShipping)}</strong></div>}
                  {totals.globalShipping>0 && <div className="flex justify-between"><span>Livraison zone {formatZoneLabel(selectedZone)}</span><strong>{formatMoney(totals.globalShipping)}</strong></div>}
                  {totals.shipping===0 && <div className="flex justify-between text-green-600"><span>Livraison</span><strong>Offerte</strong></div>}
                  {totals.taxLines.map(line=>(
                    <div key={line.id} className="flex justify-between text-xs text-gray-600">
                      <span>{line.name}{line.mode==='percent'?` ${line.rate}%`:''}{line.included?' (incluse)':''}</span>
                      <span>{formatMoney(line.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-lg font-black pt-2 border-t" style={{borderColor:'var(--ad-line)'}}><span>Total TTC</span><span style={{color:'var(--ad-accent)'}}>{formatMoney(totals.total)}</span></div>
                  <p className="text-[11px] text-gray-500">TVA détaillée, frais et remises inclus. Livraison calculée selon zone choisie à l'étape suivante.</p>
                </div>
                <button onClick={()=>setStep(2)} className="w-full btn-primary text-white py-3 font-semibold shadow-lg flex items-center justify-center gap-2 rounded-lg">Suivant : Livraison <ArrowRight className="w-5 h-5"/></button>
                <Link href={`/${locale}/products`} className="w-full ad-btn ad-btn-ghost justify-center flex">← Retour boutique</Link>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-sari-blue"/> Zone de livraison / vente</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Wilaya / Zone</span>
                    <select className="ad-select" value={selectedZone} onChange={e=>setSelectedZone(e.target.value)}>
                      {shopConfig?.saleZones.filter(z=>z.active).map(z=> (
                        <option key={z.code} value={z.code}>{z.label} {z.code} — {z.deliveryDays} {z.codAllowed?'· COD':''}</option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Frais estimés</span>
                    <div className="ad-input bg-gray-50 dark:bg-[#111] font-bold">{formatMoney(getShippingFeeForZone(selectedZone, cart.reduce((s,c)=>s+c.quantity,0), totals.subtotal - totals.discount))} {totals.shipping===0 && '(offert)'}</div>
                  </div>
                </div>
                <button onClick={()=>setShowZonesHelp(!showZonesHelp)} className="text-xs underline decoration-dotted">Voir toutes les zones disponibles</button>
                {showZonesHelp && shopConfig && (
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    {shopConfig.saleZones.map(z=> (
                      <div key={z.code} className={`p-2 rounded-lg border flex justify-between ${z.active?'bg-white dark:bg-[#111]':'bg-gray-100 opacity-50'}`} style={{borderColor:'var(--ad-line)'}}>
                        <span><strong>{z.label}</strong> <span className="font-mono">{z.code}</span> · {z.deliveryDays}</span>
                        <span className={z.active?'text-green-600':'text-red-600'}>{z.active?'Disponible':'Indisponible'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Adresse de livraison</span>
                  <textarea className="ad-textarea" rows={3} placeholder="Adresse complète, wilaya, code postal, téléphone" value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Notes / Rappels</span>
                  <textarea className="ad-textarea" rows={2} placeholder="Instructions de livraison, créneau, étage..." value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} />
                </label>
                {shopConfig?.deliveryNotes && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 p-3 rounded-lg text-xs flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"/><span>{shopConfig.deliveryNotes}</span>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 p-4 rounded-xl text-xs space-y-2">
                <div className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Conditions de vente</div>
                <div className="whitespace-pre-wrap leading-relaxed" style={{color:'var(--ad-muted)'}}>{shopConfig?.saleConditions || 'Aucune condition configurée.'}</div>
                <label className="flex items-start gap-2 pt-2 cursor-pointer">
                  <input type="checkbox" checked={saleConditionsAccepted} onChange={e=>setSaleConditionsAccepted(e.target.checked)} className="mt-0.5"/>
                  <span className="text-sm font-semibold">J'ai lu et j'accepte les conditions de vente et les zones de livraison</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={()=>setStep(1)} className="ad-btn ad-btn-ghost inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Retour panier</button>
                <button onClick={()=>setStep(3)} disabled={!saleConditionsAccepted || unavailableProducts.length>0} className="ad-btn ad-btn-primary ml-auto inline-flex items-center gap-2 disabled:opacity-50">Suivant : Paiement <ArrowRight className="w-4 h-4"/></button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32 space-y-3">
                <h4 className="font-bold flex items-center gap-2"><Package className="w-4 h-4"/> Récapitulatif</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Sous-total</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                  <div className="flex justify-between text-green-600"><span>Remises</span><strong>-{formatMoney(totals.discount)}</strong></div>
                  <div className="flex justify-between"><span>Livraison</span><strong>{totals.shipping?formatMoney(totals.shipping):'Offerte'}</strong></div>
                  <div className="flex justify-between"><span>Taxes</span><strong>{formatMoney(totals.taxTotal)}</strong></div>
                  <div className="flex justify-between font-black text-base pt-2 border-t" style={{borderColor:'var(--ad-line)'}}><span>Total</span><span>{formatMoney(totals.total)}</span></div>
                </div>
                <div className="text-[11px] text-gray-500">Zone : {formatZoneLabel(selectedZone)} · {cart.length} articles · Paiement à la livraison disponible selon zone</div>
                <button onClick={()=>setStep(1)} className="w-full ad-btn ad-btn-ghost text-sm">Modifier le panier</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-sari-blue"/> Paiement & Confirmation</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Zone</span><strong>{formatZoneLabel(selectedZone)}</strong></div>
                  <div className="flex justify-between"><span>Adresse</span><span className="text-right max-w-[60%] truncate">{deliveryAddress || '—'}</span></div>
                  <div className="flex justify-between"><span>Livraison</span><strong>{formatMoney(totals.shipping)}</strong></div>
                  <div className="flex justify-between"><span>Articles</span><span>{cart.reduce((s,c)=>s+c.quantity,0)} unités</span></div>
                </div>
                <div className="mt-4 space-y-2">
                  {cart.map((it,i)=>(
                    <div key={i} className="flex justify-between text-sm border-b py-2" style={{borderColor:'var(--ad-line)'}}>
                      <span className="truncate pr-4">{it.name} ×{it.quantity}</span>
                      <span className="font-bold">{formatMoney(parseFloat(String(it.price).replace(/[^0-9.]/g,''))*it.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button onClick={()=>setStep(2)} className="ad-btn ad-btn-ghost"><ArrowLeft className="w-4 h-4"/> Retour livraison</button>
                  <button onClick={handleCheckout} className="ad-btn ad-btn-primary ml-auto inline-flex items-center gap-2"><CreditCard className="w-5 h-5"/> Confirmer la commande</button>
                </div>
                <p className="text-[11px] text-gray-500 mt-3">En confirmant, vous acceptez les conditions de vente. Vous pourrez encore annuler un article depuis le suivi commande tant que le statut est "En attente".</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/${locale}/products`} className="ad-btn ad-btn-ghost">Continuer les achats</Link>
                <button onClick={()=>setStep(1)} className="ad-btn ad-btn-ghost">Modifier quantités</button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32">
                <h4 className="font-bold mb-3">Total à payer</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Sous-total</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                  <div className="flex justify-between text-green-600"><span>Remises</span><span>-{formatMoney(totals.discount)}</span></div>
                  <div className="flex justify-between"><span>Livraison</span><span>{formatMoney(totals.shipping)}</span></div>
                  {totals.taxLines.map(l=>(
                    <div key={l.id} className="flex justify-between text-xs text-gray-600"><span>{l.name}</span><span>{formatMoney(l.amount)}</span></div>
                  ))}
                  <div className="flex justify-between font-black text-lg pt-2 border-t" style={{borderColor:'var(--ad-line)'}}><span>Total TTC</span><span>{formatMoney(totals.total)}</span></div>
                </div>
                <div className="mt-4 p-3 bg-gray-50 dark:bg-[#111] rounded-lg text-xs flex gap-2">
                  <Shield className="w-4 h-4 text-green-600"/><span>Paiement sécurisé — vos données sont chiffrées. Zones et CGV rappelés à chaque commande.</span>
                </div>
              </div>
            </div>
          </div>
        )}
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
              <p className="text-xs text-gray-500 mt-2">Total : {formatMoney(totals.total)} · Zone : {formatZoneLabel(selectedZone)}</p>
            </div>
            {antispam && !isAuthenticated && (
              <div className="mb-4">
                <ImageCaptcha onChange={(ok) => { setCaptchaOk(ok); if (ok) setCaptchaError(''); }} />
                {captchaError && <p className="text-xs text-red-500 mt-1">{captchaError}</p>}
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
