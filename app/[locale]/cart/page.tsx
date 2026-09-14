// app/[locale]/cart/page.tsx — Tunnel convivial 3 étapes (animé, quantités visibles, TVA/remise par article, hors DZ, pays/adresse/tel/email + CGV + captcha configurable)
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Shield, CheckCircle, LogIn, FileText, ArrowLeft, ArrowRight, MapPin, Truck, Tag, AlertTriangle, Info, Package, ClipboardList, X, Globe, Mail, Phone, Home, Flag, BadgePercent, Receipt, Sparkles, ArrowUpCircle, ShieldCheck, Building2, ScrollText, Gift } from 'lucide-react';
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

const COUNTRIES = [
  { code: 'DZ', label: 'Algérie', flag: '🇩🇿', zones: ['DZ-16','DZ-31','DZ-25','DZ-09','DZ-15','DZ-06','DZ-ALL'] },
  { code: 'TN', label: 'Tunisie', flag: '🇹🇳', zones: ['INT-TN','INT-WORLD'] },
  { code: 'MA', label: 'Maroc', flag: '🇲🇦', zones: ['INT-MA','INT-WORLD'] },
  { code: 'FR', label: 'France', flag: '🇫🇷', zones: ['INT-FR','INT-EU','INT-WORLD'] },
  { code: 'EU', label: 'Europe', flag: '🇪🇺', zones: ['INT-EU','INT-WORLD'] },
  { code: 'WORLD', label: 'International (monde)', flag: '🌍', zones: ['INT-WORLD'] },
];

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

  // Champs livraison enrichis
  const [country, setCountry] = useState('DZ');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [saleConditionsAccepted, setSaleConditionsAccepted] = useState(false);
  const [showZonesHelp, setShowZonesHelp] = useState(false);
  const [showCgv, setShowCgv] = useState(true);
  const [errors, setErrors] = useState<Record<string,string>>({});

  useEffect(() => {
    setTaxes(loadTaxes());
    const cfg = loadShopConfig();
    setShopConfig(cfg);
    const active = cfg.saleZones.find(z => z.active);
    if (active) setSelectedZone(active.code);
    const handler = () => setShopConfig(loadShopConfig());
    window.addEventListener('sari-shop-config-changed', handler);
    return () => window.removeEventListener('sari-shop-config-changed', handler);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setCustomerName((user as any).name || '');
      setCustomerEmail((user as any).email || '');
      setCustomerPhone((user as any).phone || '');
      setCustomerCompany((user as any).company || '');
    }
  }, [isAuthenticated, user]);

  // Zones filtrées selon pays (hors DZ)
  const availableZones = useMemo(() => {
    if (!shopConfig) return [];
    const c = COUNTRIES.find(x=>x.code===country);
    if (!c) return shopConfig.saleZones.filter(z=>z.active);
    if (country==='DZ') return shopConfig.saleZones.filter(z=>z.code.startsWith('DZ-') && z.active);
    // hors DZ : propose INT-* correspondants + WORLD
    return shopConfig.saleZones.filter(z => c.zones.includes(z.code) && z.active);
  }, [shopConfig, country]);

  useEffect(() => {
    // si pays change et zone actuelle non compatible, bascule vers première dispo
    if (availableZones.length && !availableZones.find(z=>z.code===selectedZone)) {
      setSelectedZone(availableZones[0].code);
    }
  }, [availableZones, selectedZone]);

  const antispam = loadAdminSettings().security?.siteCaptcha !== false;
  const antispamRequired = antispam && !isAuthenticated;

  const unavailableProducts = useMemo(() => {
    if (!shopConfig || !selectedZone) return [];
    return cart.filter(item => {
      const zones = (item as any).zones as string[] | undefined;
      if (Array.isArray(zones) && zones.length > 0) {
        return !zones.includes(selectedZone) && !zones.includes('ALL') && !zones.includes('DZ-ALL') && !zones.includes('INT-WORLD');
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

  const totalQty = cart.reduce((s,c)=>s+c.quantity,0);

  const validateStep2 = (): boolean => {
    const e: Record<string,string> = {};
    if (!country) e.country = 'Pays requis';
    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 8) e.address = 'Adresse complète requise (≥8 caractères)';
    if (!customerPhone.trim()) e.phone = 'Téléphone requis';
    else if (!/^\+?[0-9\s\-()]{8,20}$/.test(customerPhone.trim())) e.phone = 'Téléphone invalide';
    if (!customerEmail.trim()) e.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) e.email = 'Email invalide';
    if (!customerName.trim() && !isAuthenticated) e.name = 'Nom requis';
    if (!selectedZone) e.zone = 'Zone requise';
    if (!saleConditionsAccepted) e.cgv = 'Veuillez accepter les conditions de vente';
    if (antispamRequired && !captchaOk) e.captcha = 'Validation captcha requise';
    if (unavailableProducts.length>0) e.zone = `Certains articles non livrables en ${formatZoneLabel(selectedZone)}`;
    setErrors(e);
    return Object.keys(e).length===0;
  };

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

  const createOrderAndRedirect = (options: { isQuote?: boolean } = {}) => {
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
      customerName: isAuthenticated ? (user as any)?.name || customerName : customerName,
      customerEmail: isAuthenticated ? (user as any)?.email || customerEmail : customerEmail,
      customerPhone,
      customerCompany,
      customerType: isAuthenticated ? (user as any)?.type || 'guest' : 'guest',
      isGuest: !isAuthenticated,
      isQuote: options.isQuote || false,
      status: (options.isQuote ? 'quote_requested' : 'pending') as Order['status'],
      saleZone: selectedZone,
      deliveryZone: selectedZone,
      country,
      deliveryAddress,
      notes: customerNotes,
      saleConditionsAccepted,
      coupon: appliedCoupon?.code,
    };
    return addOrder(orderData);
  };

  const goToPayment = (orderId: number | string) => {
    setRedirecting(true);
    // Garder le panier jusqu'à confirmation finale — on sauvegarde en localStorage pour restauration si l'utilisateur revient
    try { localStorage.setItem('sari_pending_cart', JSON.stringify(cart)); } catch {}
    router.push(`/${locale}/payment/${orderId}`);
    // Ne pas vider immédiatement : le panier sera vidé après paiement confirmé ou après 30min
  };

  const antispamPasse = () => {
    if (!antispamRequired) return true;
    if (captchaOk) return true;
    setCaptchaError(t('captchaRequired'));
    return false;
  };

  const handleCheckout = () => {
    if (cart.length === 0 || redirecting) return;
    if (!validateStep2()) {
      setStep(2);
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
      if (!validateStep2()) { setShowCheckoutModal(false); setStep(2); return; }
      const order = createOrderAndRedirect();
      setShowCheckoutModal(false);
      goToPayment(order.id);
    } else if (option === 'quote') {
      if (!validateStep2()) { setShowCheckoutModal(false); setStep(2); return; }
      createOrderAndRedirect({ isQuote: true });
      setShowCheckoutModal(false);
      setOrderSubmitted(true);
      clearCart();
      setTimeout(() => { setOrderSubmitted(false); router.push(`/${locale}`); }, 3000);
    }
  };

  // Petits helpers d'affichage TVA/remise par article
  const lineTvaInfo = (it: any) => {
    const rate = it.vatRate ?? it.taxRate;
    if (rate==null || rate==='' ) return null;
    return `${rate}%${it.vatIncluded?' incl.':''}`;
  };
  const lineDiscountInfo = (it: any) => {
    if (it.discountValue==null && it.discount==null) return null;
    const v = it.discountValue ?? it.discount;
    const tp = it.discountType || (it.discount ? 'percent' : 'percent');
    return `${v}${tp==='fixed'?' DA':'%'}`;
  };

  if (orderSubmitted) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-[#111] dark:to-[#0a0a0a]">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-2xl text-center rounded-2xl animate-in fade-in zoom-in">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><CheckCircle className="w-10 h-10 text-green-500" /></div>
            <h1 className="text-3xl font-black text-sari-dark dark:text-white mb-4">{t('quoteSent')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">{t('quoteSentDesc')}</p>
            <Link href={`/${locale}`} className="btn-primary text-white px-8 py-3 font-bold inline-flex items-center gap-2 rounded-full shadow-lg hover:scale-105 transition"><Sparkles className="w-5 h-5"/> {t('backHome')}</Link>
          </div>
        </div>
      </div>
    );
  }
  if (redirecting) {
    return (
      <div className="pt-40 pb-24 min-h-screen bg-gray-50 dark:bg-[#111111]">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl text-center rounded-2xl">
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
      <div className="pt-40 pb-24 min-h-screen bg-gradient-to-b from-blue-50/60 to-white dark:from-[#111] dark:to-[#0a0a0a]">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-2xl text-center rounded-2xl">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-emerald-100 dark:from-blue-900/30 dark:to-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6"><ShoppingCart className="w-12 h-12 text-gray-400" /></div>
            <h1 className="text-3xl font-black text-sari-dark dark:text-white mb-4">{t('empty')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">{t('emptyDesc')}</p>
            <Link href={`/${locale}/products`} className="btn-primary text-white px-8 py-3 font-bold inline-flex gap-2 rounded-full shadow-lg hover:scale-105 transition"><Package className="w-5 h-5"/> {t('browseProducts')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const Stepper = () => (
    <div className="flex items-center justify-center gap-1 md:gap-2 mb-8 flex-wrap">
      {[
        { n: 1, label: 'Panier', icon: ShoppingCart, desc: `${totalQty} articles` },
        { n: 2, label: 'Livraison', icon: Truck, desc: country==='DZ'?'Algérie + hors DZ':'International' },
        { n: 3, label: 'Paiement', icon: CreditCard, desc: 'Confirmation' },
      ].map((s, i) => {
        const Icon = s.icon;
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-1 md:gap-2">
            {i > 0 && <div className={`hidden md:block w-10 h-1 rounded-full transition-all ${done ? 'bg-gradient-to-r from-emerald-400 to-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            <button onClick={() => setStep(s.n as Step)} className={`flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 rounded-full text-sm font-black transition-all shadow-sm hover:scale-[1.02] ${active ? 'bg-gradient-to-r from-sari-blue to-blue-600 text-white shadow-xl scale-105' : done ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-500'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${active ? 'bg-white/20' : done ? 'bg-white/20' : 'bg-gray-100 dark:bg-[#222]'}`}><Icon className="w-4 h-4" /></span>
              <span className="hidden sm:block text-left"><span className="block leading-none">{s.n}. {s.label}</span><span className="text-[10px] opacity-70 font-normal">{s.desc}</span></span>
              <span className="sm:hidden">{s.label}</span>
              {done && <CheckCircle className="w-4 h-4 hidden md:block" />}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="pt-28 pb-24 min-h-screen bg-gradient-to-b from-blue-50/40 via-white to-white dark:from-[#0f1115] dark:via-[#0a0a0a] dark:to-[#0a0a0a]">
      <div className="container mx-auto px-4 md:px-6">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('products'), href: '/products' }, { label: t('cart') }]} />
        <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-sari-dark dark:text-white flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sari-blue to-blue-700 text-white flex items-center justify-center shadow-lg"><ShoppingCart className="w-6 h-6" /></span>
            {t('title')} <span className="text-base font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"> {totalQty} article{totalQty>1?'s':''} · {cart.length} réf.</span>
          </h1>
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 bg-white dark:bg-[#1a1a1a] px-4 py-2 rounded-full border shadow-sm"><Info className="w-4 h-4 text-sari-blue"/> Tunnel 3 étapes — retour arrière à tout moment</div>
        </div>

        <Stepper />

        {unavailableProducts.length > 0 && (
          <div className="max-w-5xl mx-auto mb-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-orange-400 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
            <span className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5" /></span>
            <div className="text-sm">
              <div className="font-black text-orange-800 dark:text-orange-200">Zone non livrable pour certains articles</div>
              <div className="text-gray-700 dark:text-gray-300">En {formatZoneLabel(selectedZone)} : {unavailableProducts.map(p=>p.name).join(', ')} — choisissez une autre zone ou retirez ces articles. <span className="font-bold">Hors Algérie disponible si activé en Config. boutique.</span></div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-4">
              {(() => {
                // Grouper par catégorie pour lisibilité
                const grouped = cart.reduce((acc:any, cur:any)=>{ const k=cur.category||'Autres'; (acc[k]=acc[k]||[]).push(cur); return acc; }, {} as any);
                const flat: any[] = [];
                Object.entries(grouped).forEach(([cat, items]: any)=>{ flat.push({__header:cat}); flat.push(...items); });
                return flat.map((item:any, index:number)=>{
                if (item.__header) return <div key={`h-${item.__header}`} className="flex items-center gap-2 mt-4 mb-1"><span className="px-3 py-1 rounded-full bg-sari-dark text-white text-xs font-black">{item.__header}</span><span className="flex-1 h-px bg-gray-200 dark:bg-gray-800"/><span className="text-xs font-bold opacity-60">{grouped[item.__header].length} réf.</span></div>;
                const it: any = item;
                const qty = it.quantity;
                const unit = parseFloat(String(it.price).replace(/[^0-9.]/g,''))||0;
                const disc = lineDiscountInfo(it);
                const tva = lineTvaInfo(it);
                const tvaRate = it.vatRate ?? it.taxRate;
                const sub = unit*qty;
                const discAmt = it.discountType==='fixed' ? (Number(it.discountValue||0)*qty) : (sub * (Number(it.discountValue||it.discount||0)/100));
                const net = sub - discAmt;
                const tvaAmt = tvaRate ? net*(tvaRate/100) : 0;
                return (
                  <div key={index} className="group bg-white dark:bg-[#1a1a1a] p-4 md:p-5 border border-gray-200 dark:border-gray-800 shadow-lg hover:shadow-2xl rounded-2xl flex gap-4 items-start transition-all hover:scale-[1.005] animate-in fade-in slide-in-from-bottom-2" style={{animationDelay: `${index*40}ms`}}>
                    <div className="relative shrink-0">
                      <img src={item.image} alt={item.name} className="w-24 h-24 md:w-28 md:h-28 object-cover rounded-xl border" />
                      <span className="absolute -top-2 -right-2 bg-gradient-to-br from-sari-blue to-blue-700 text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#1a1a1a]">×{qty}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-base md:text-lg text-sari-dark dark:text-white leading-tight line-clamp-2 flex items-center gap-2">{(item as any).name.split(' (')[0]} {(item as any).optionSummary && <span className="text-sm font-bold px-2.5 py-1 rounded-full bg-sari-lime text-sari-dark">{(item as any).optionSummary}</span>} <Sparkles className="w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 transition"/></h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-1.5 mt-2">{item.category && <span className="px-3 py-1 rounded-full bg-sari-blue/10 text-sari-blue font-bold text-xs">{item.category}</span>} {it.sku && <span className="font-mono px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 text-xs font-bold">SKU {it.sku}</span>} {(it as any).variantKey && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1"><Package className="w-3 h-3"/> Variante</span>} {it.zones?.length?<span className="px-2.5 py-1 rounded-full bg-gray-50 border flex items-center gap-1 text-xs"><Flag className="w-3 h-3"/>{it.zones.join(', ')}</span>:<span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1 text-xs font-bold"><Globe className="w-3 h-3"/>Toutes zones</span>}</div>
                      {/* Grille prix / TVA / remise */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                        <div className="bg-gray-50 dark:bg-[#111] p-2 rounded-xl border">
                          <div className="text-xs uppercase font-black tracking-widest opacity-60 flex items-center gap-1"><Tag className="w-3 h-3"/> Prix unit.</div>
                          <div className="font-black text-sm">{withSymbol(unit)}</div>
                          <div className="text-sm opacity-70">Qté <strong>{qty}</strong> → {formatMoney(sub)}</div>
                        </div>
                        <div className={`p-2 rounded-xl border ${it.discountValue?'bg-green-50 dark:bg-green-900/20 border-green-200':'bg-gray-50 dark:bg-[#111] opacity-60'}`}>
                          <div className="text-xs uppercase font-black tracking-widest flex items-center gap-1"><Gift className="w-3 h-3"/> Remise</div>
                          <div className="font-black text-sm flex items-center gap-1">{disc ? <><BadgePercent className="w-3.5 h-3.5 text-green-600"/>{disc}</> : '—'}</div>
                          <div className="text-[11px] text-green-700 font-bold">{discAmt ? `-${formatMoney(discAmt)}` : 'Aucune'}</div>
                        </div>
                        <div className={`p-2 rounded-xl border ${tva?'bg-blue-50 dark:bg-blue-900/20 border-blue-200':'bg-gray-50 dark:bg-[#111] opacity-60'}`}>
                          <div className="text-xs uppercase font-black tracking-widest flex items-center gap-1"><Receipt className="w-3 h-3"/> TVA</div>
                          <div className="font-black text-sm">{tva || '—'}</div>
                          <div className="text-[11px]">{tvaAmt? formatMoney(tvaAmt) : '0 DA'}</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl border border-amber-200">
                          <div className="text-xs uppercase font-black tracking-widest flex items-center gap-1"><Truck className="w-3 h-3"/> Livraison</div>
                          <div className="font-black text-sm">{it.shippingFee ? `${it.shippingFee} DA ${it.shippingType==='per_qty'?'×Qté':it.shippingType==='free'?'offerte':''}` : 'Incluse'}</div>
                          <div className="text-[11px] opacity-70">{item.category}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-sm"><span className="opacity-60">Sous-total article</span> <strong className="ml-2 text-base">{formatMoney(net + (it.vatIncluded?0:tvaAmt))}</strong></div>
                        <div className="hidden md:flex items-center gap-1 text-[11px] bg-gray-100 dark:bg-[#222] px-2 py-1 rounded-full"><Package className="w-3 h-3"/> Poids {it.weight? `${it.weight} kg`:'—'}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#111] p-1 rounded-full border shadow-inner">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, (item as any).variantKey)} className="w-9 h-9 rounded-full bg-white dark:bg-[#1a1a1a] border-2 border-gray-200 hover:border-sari-blue hover:bg-sari-blue/10 flex items-center justify-center shadow hover:scale-105 transition"><Minus className="w-4 h-4"/></button>
                        <span className="w-12 text-center font-black text-lg">{qty}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, (item as any).variantKey)} className="w-9 h-9 rounded-full bg-sari-blue text-white hover:bg-blue-700 flex items-center justify-center shadow hover:scale-105 transition"><Plus className="w-4 h-4"/></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id, (item as any).variantKey)} className="w-9 h-9 rounded-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center shadow transition border-2 border-red-100" title="Retirer cette variante"><Trash2 className="w-4 h-4" /></button>
                      <span className="text-xs font-black tracking-widest opacity-50">QTE</span>
                    </div>
                  </div>
                );
                });
              })()}
              <div className="flex flex-wrap gap-3">
                <Link href={`/${locale}/products`} className="px-5 py-3 bg-white border-2 border-gray-200 rounded-full font-bold hover:border-sari-blue hover:text-sari-blue transition flex items-center gap-2 shadow-sm"><ArrowLeft className="w-4 h-4"/> Continuer les achats</Link>
                <button onClick={() => { if(confirm('Vider tout le panier ?')) clearCart(); }} className="px-5 py-3 border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 bg-white dark:bg-[#1a1a1a] rounded-full font-bold flex items-center gap-2 shadow-sm hover:shadow transition text-sm"><Trash2 className="w-4 h-4"/> Vider le panier</button>
                <span className="ml-auto text-sm bg-white dark:bg-[#1a1a1a] border px-3 py-2 rounded-full shadow-sm flex items-center gap-2"><ClipboardList className="w-4 h-4"/> {totalQty} unités au total</span>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl sticky top-28 space-y-4">
                <h3 className="text-xl font-black text-sari-dark dark:text-white flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-blue-600 text-white flex items-center justify-center"><ClipboardList className="w-5 h-5"/></span> {t('summary')}</h3>
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Tag className="w-3.5 h-3.5"/> Coupon</label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue pointer-events-none"/>
                        <input className="w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base font-mono uppercase focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition placeholder:text-gray-400 border-gray-200 dark:border-gray-700" placeholder="SARI10" value={couponCode} onChange={e=>setCouponCode(e.target.value)} />
                      </div>
                      <button onClick={handleApplyCoupon} className="px-6 py-3.5 bg-sari-blue text-white rounded-2xl font-black hover:bg-[#138ab0] transition shadow">Appliquer</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 p-3 rounded-xl">
                      <span className="font-mono font-black text-green-700 flex items-center gap-2"><Gift className="w-4 h-4"/>{appliedCoupon.code} -{appliedCoupon.type==='percent'?`${appliedCoupon.amount}%`:formatMoney(appliedCoupon.amount)}</span>
                      <button onClick={handleRemoveCoupon} className="text-xs font-bold text-red-600 hover:underline">Retirer</button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg">{couponError}</p>}
                </div>
                <div className="space-y-2 text-sm border-t pt-4" className="border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between"><span className="text-gray-600">Sous-total HT</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                  {totals.productDiscount>0 && <div className="flex justify-between text-emerald-600"><span className="flex items-center gap-1"><Gift className="w-3 h-3"/> Remises produits</span><strong>-{formatMoney(totals.productDiscount)}</strong></div>}
                  {totals.globalDiscount>0 && <div className="flex justify-between text-emerald-600"><span>Remise globale</span><strong>-{formatMoney(totals.globalDiscount)}</strong></div>}
                  {totals.couponDiscount>0 && <div className="flex justify-between text-emerald-600"><span>Coupon {appliedCoupon?.code}</span><strong>-{formatMoney(totals.couponDiscount)}</strong></div>}
                  {totals.productShipping>0 && <div className="flex justify-between"><span className="flex items-center gap-1"><Truck className="w-3 h-3"/> Livraison produits</span><strong>{formatMoney(totals.productShipping)}</strong></div>}
                  {totals.globalShipping>0 && <div className="flex justify-between"><span>Livraison {formatZoneLabel(selectedZone)}</span><strong>{formatMoney(totals.globalShipping)}</strong></div>}
                  {totals.shipping===0 && <div className="flex justify-between text-emerald-600 font-bold"><span className="flex items-center gap-1"><ArrowUpCircle className="w-3 h-3"/> Livraison</span><strong>Offerte 🎉</strong></div>}
                  {totals.taxLines.map(line=>(
                    <div key={line.id} className="flex justify-between text-xs text-gray-600 bg-gray-50 dark:bg-[#111] p-1.5 rounded-lg">
                      <span>{line.name}{line.mode==='percent'?` ${line.rate}%`:''}{line.included?' (incluse)':''}</span>
                      <span className="font-bold">{formatMoney(line.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-lg font-black pt-3 border-t" className="border-gray-200 dark:border-gray-700"><span>Total TTC</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600">{formatMoney(totals.total)}</span></div>
                  <p className="text-sm text-gray-600 flex gap-1"><Info className="w-3 h-3 mt-0.5"/> TVA détaillée par article incluse. Livraison recalculée selon pays/zone à l'étape suivante. Hors Algérie disponible.</p>
                </div>
                <button onClick={()=>setStep(2)} className="w-full bg-gradient-to-r from-sari-blue to-blue-700 text-white py-3.5 font-black shadow-xl flex items-center justify-center gap-2 rounded-full hover:scale-[1.02] transition"><Truck className="w-5 h-5"/> Suivant : Livraison <ArrowRight className="w-5 h-5"/></button>
                <Link href={`/${locale}/products`} className="w-full px-5 py-3 bg-white border-2 border-gray-200 rounded-full font-bold hover:border-sari-blue hover:text-sari-blue transition flex items-center justify-center gap-2">← Retour boutique</Link>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl space-y-5">
                <h3 className="font-black text-xl flex items-center gap-3 text-sari-dark dark:text-white"><span className="w-10 h-10 rounded-xl bg-sari-blue text-white flex items-center justify-center shadow"><MapPin className="w-5 h-5"/></span> Livraison — <span className="text-sari-blue">Algérie & hors Algérie</span></h3>
                {!isAuthenticated && (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-gradient-to-r from-sari-blue/10 to-sari-lime/10 border-2 border-sari-blue/20 p-4 rounded-2xl">
                    <div className="flex gap-3">
                      <span className="w-10 h-10 rounded-full bg-sari-blue text-white flex items-center justify-center shrink-0"><LogIn className="w-5 h-5"/></span>
                      <div>
                        <div className="font-black text-sari-dark dark:text-white">Gagnez du temps — connectez-vous</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Récupérez automatiquement nom, email, téléphone et adresse enregistrés.</div>
                      </div>
                    </div>
                    <button onClick={()=>{ localStorage.setItem('sari_pending_cart', JSON.stringify(cart)); router.push(`/${locale}/connexion?source=panier`); }} className="px-6 py-3 bg-sari-blue hover:bg-[#138ab0] text-white rounded-full font-black shadow-lg flex items-center gap-2 whitespace-nowrap transition"><LogIn className="w-4 h-4"/> Se connecter</button>
                  </div>
                )}
                {isAuthenticated && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 p-3 rounded-2xl flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200"><CheckCircle className="w-5 h-5"/> Connecté en tant que <strong>{(user as any)?.name}</strong> — vos infos sont pré-remplies, modifiables.</div>
                )}
                <div className="grid md:grid-cols-3 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Globe className="w-3 h-3"/> Pays</span>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue pointer-events-none"/>
                      <select className={`w-full pl-10 pr-10 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base font-medium focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition appearance-none ${errors.country?'border-red-300':'border-gray-200 dark:border-gray-700'}`} value={country} onChange={e=>{setCountry(e.target.value); setErrors({...errors, country: ''})}}>
                      {COUNTRIES.map(c=> <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                      </select>
                    </div>
                    {errors.country && <p className="text-xs text-red-600">{errors.country}</p>}
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><MapPin className="w-3 h-3"/> Zone / Wilaya</span>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue pointer-events-none"/>
                      <select className={`w-full pl-10 pr-10 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base font-medium focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition appearance-none ${errors.zone?'border-red-300':'border-gray-200 dark:border-gray-700'}`} value={selectedZone} onChange={e=>{setSelectedZone(e.target.value); setErrors({...errors, zone:''})}}>
                      {availableZones.length ? availableZones.map(z=> (
                        <option key={z.code} value={z.code}>{z.label} {z.code} — {z.deliveryDays} {z.codAllowed?'· COD':''}</option>
                      )) : <option value="">Aucune zone active pour ce pays</option>}
                      </select>
                    </div>
                    {errors.zone && <p className="text-xs text-red-600">{errors.zone}</p>}
                  </label>
                </div>
                <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 p-3 rounded-xl">
                  <Truck className="w-4 h-4 text-blue-600 shrink-0"/><span>Frais estimés : <strong>{formatMoney(getShippingFeeForZone(selectedZone, cart.reduce((s,c)=>s+c.quantity,0), totals.subtotal - totals.discount))} {totals.shipping===0 && '(offert)'}</strong> — {country==='DZ' ? 'Algérie' : 'Hors Algérie (international)'} · {formatZoneLabel(selectedZone)}</span>
                  <button onClick={()=>setShowZonesHelp(!showZonesHelp)} className="ml-auto text-xs underline decoration-dotted whitespace-nowrap">{showZonesHelp?'Masquer':'Voir zones'}</button>
                </div>
                {showZonesHelp && shopConfig && (
                  <div className="grid md:grid-cols-2 gap-2 text-xs max-h-64 overflow-auto p-1">
                    {shopConfig.saleZones.map(z=> (
                      <div key={z.code} className={`p-2.5 rounded-xl border flex justify-between items-center ${z.active?'bg-white dark:bg-[#111]':'bg-gray-100 opacity-50'}`} className="border-gray-200 dark:border-gray-700">
                        <span><strong>{z.label}</strong> <span className="font-mono text-[11px]">{z.code}</span> · {z.deliveryDays}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${z.active?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{z.active?'Disponible':'Indisponible'}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Building2 className="w-3 h-3"/> Nom complet *</span>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue pointer-events-none"/>
                      <input className={`w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition placeholder:text-gray-400 ${errors.name?'border-red-300':'border-gray-200 dark:border-gray-700'}`} placeholder="Nom et prénom" value={customerName} onChange={e=>{setCustomerName(e.target.value); setErrors({...errors, name:''})}} />
                    </div>
                    {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Home className="w-3 h-3"/> Société (optionnel)</span>
                    <div className="relative">
                      <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue/60 pointer-events-none"/>
                      <input className="w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition placeholder:text-gray-400 border-gray-200 dark:border-gray-700" placeholder="Société (optionnel)" value={customerCompany} onChange={e=>setCustomerCompany(e.target.value)} />
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Phone className="w-3 h-3"/> Téléphone *</span>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue pointer-events-none"/>
                      <input className={`w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base font-medium focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition placeholder:text-gray-400 ${errors.phone?'border-red-300':'border-gray-200 dark:border-gray-700'}`} placeholder="+213 5xx xxx xxx" value={customerPhone} onChange={e=>{ const v=e.target.value.replace(/[^0-9+\s\-()]/g,''); setCustomerPhone(v); setErrors({...errors, phone:''})}} inputMode="tel" />
                    </div>
                    {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Mail className="w-3 h-3"/> Email *</span>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sari-blue pointer-events-none"/>
                      <input className={`w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition placeholder:text-gray-400 ${errors.email?'border-red-300':'border-gray-200 dark:border-gray-700'}`} placeholder="vous@exemple.com" value={customerEmail} onChange={e=>{setCustomerEmail(e.target.value); setErrors({...errors, email:''})}} inputMode="email" />
                    </div>
                    {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                  </label>
                </div>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Home className="w-3 h-3"/> Adresse complète *</span>
                  <div className="relative">
                    <Home className="absolute left-3.5 top-4 w-5 h-5 text-sari-blue pointer-events-none"/>
                    <textarea className={`w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition placeholder:text-gray-400 min-h-[110px] ${errors.address?'border-red-300':'border-gray-200 dark:border-gray-700'}`} rows={4} placeholder={country==='DZ'?"Adresse, wilaya, commune, code postal":"Adresse, ville, code postal, pays"} value={deliveryAddress} onChange={e=>{setDeliveryAddress(e.target.value); setErrors({...errors, address:''})}} />
                  </div>
                  {errors.address && <p className="text-xs text-red-600">{errors.address}</p>}
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-black uppercase tracking-widest flex items-center gap-1" className="text-gray-500"><Info className="w-3 h-3"/> Notes / Rappels</span>
                  <textarea className={`w-full px-4 py-3 border-2 rounded-2xl bg-white dark:bg-[#1a1a1a] text-base focus:border-sari-blue focus:ring-4 focus:ring-sari-blue/10 outline-none transition min-h-[140px] ${errors.notes?'border-red-300': 'border-gray-200 dark:border-gray-700'}`} rows={5} placeholder="Instructions de livraison, créneau, étage, précisions douane si hors Algérie..." value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} />
                </label>

                {shopConfig?.deliveryNotes && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 p-3 rounded-xl text-xs flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"/><span>{shopConfig.deliveryNotes}</span>
                  </div>
                )}

                {/* Captcha configurable */}
                {antispamRequired && (
                  <div className={`p-4 rounded-xl border ${errors.captcha?'border-red-400 bg-red-50':'bg-amber-50 dark:bg-amber-900/20 border-amber-200'}`}>
                    <div className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4"/> Vérification anti-robot *</div>
                    <ImageCaptcha onChange={(ok)=>{setCaptchaOk(ok); if(ok) setErrors({...errors, captcha:''})}} />
                    {errors.captcha && <p className="text-xs text-red-600 mt-2">{errors.captcha}</p>}
                    <p className="text-sm opacity-70 mt-1">Captcha configurable dans Admin → Paramètres → Sécurité (siteCaptcha).</p>
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-2xl border-2 space-y-2 ${errors.cgv?'border-red-400 bg-red-50':'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300'}`}>
                <button type="button" onClick={()=>setShowCgv(!showCgv)} className="w-full flex items-center justify-between font-black text-sm"><span className="flex items-center gap-2"><ScrollText className="w-4 h-4"/> Conditions de vente *</span><span className="text-xs underline">{showCgv?'Masquer':'Afficher'}</span></button>
                {showCgv && <div className="whitespace-pre-wrap leading-relaxed text-sm bg-white dark:bg-[#111] p-4 rounded-xl border-2 border-amber-200 max-h-56 overflow-auto text-sari-dark dark:text-gray-200">{shopConfig?.saleConditions || 'Aucune condition configurée.'}</div>}
                <label className={`flex items-start gap-2 pt-2 cursor-pointer p-2 rounded-xl ${saleConditionsAccepted?'bg-green-100 border border-green-300':'bg-white border'}`}>
                  <input type="checkbox" checked={saleConditionsAccepted} onChange={e=>{setSaleConditionsAccepted(e.target.checked); setErrors({...errors, cgv:''})}} className="mt-0.5 w-4 h-4 accent-sari-blue"/>
                  <span className="text-sm font-bold">J'ai lu et j'accepte les conditions de vente et les zones de livraison (Algérie & hors Algérie)</span>
                </label>
                {errors.cgv && <p className="text-xs text-red-600 font-bold">{errors.cgv}</p>}
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={()=>setStep(1)} className="ad-btn ad-btn-ghost rounded-full inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Retour panier</button>
                <button onClick={()=>{ if(validateStep2()) setStep(3); }} className="ad-btn bg-gradient-to-r from-sari-blue to-blue-700 text-white rounded-full ml-auto inline-flex items-center gap-2 px-6 py-3 font-black shadow-lg hover:scale-105 transition">Suivant : Paiement <ArrowRight className="w-4 h-4"/></button>
              </div>
            </div>
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl sticky top-28 space-y-3">
                <h4 className="font-black flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center"><Package className="w-4 h-4"/></span> Récapitulatif</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="opacity-60">Sous-total</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                  <div className="flex justify-between text-emerald-600"><span>Remises</span><strong>-{formatMoney(totals.discount)}</strong></div>
                  <div className="flex justify-between"><span>Livraison</span><strong>{totals.shipping?formatMoney(totals.shipping):'Offerte'}</strong></div>
                  <div className="flex justify-between"><span>Taxes (TVA par article incluse)</span><strong>{formatMoney(totals.taxTotal)}</strong></div>
                  <div className="flex justify-between font-black text-base pt-2 border-t" className="border-gray-200 dark:border-gray-700"><span>Total</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600">{formatMoney(totals.total)}</span></div>
                </div>
                <div className="text-sm bg-gray-50 dark:bg-[#111] p-3 rounded-xl border">
                  <div className="font-bold flex items-center gap-1"><Flag className="w-3 h-3"/> {COUNTRIES.find(c=>c.code===country)?.flag} {COUNTRIES.find(c=>c.code===country)?.label} · {formatZoneLabel(selectedZone)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{cart.map((it,i)=><span key={i} className="px-2 py-0.5 rounded-full bg-white dark:bg-[#1a1a1a] border text-[11px] font-bold">×{(it as any).quantity} {(it as any).name.slice(0,12)}</span>)}</div>
                </div>
                <button onClick={()=>setStep(1)} className="w-full ad-btn ad-btn-ghost text-sm rounded-full">Modifier quantités</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 text-white flex items-center justify-center"><CreditCard className="w-5 h-5"/></span> Paiement & Confirmation</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 dark:bg-[#111] p-3 rounded-xl border"><div className="text-sm uppercase font-black opacity-60">Pays / Zone</div><div className="font-black">{COUNTRIES.find(c=>c.code===country)?.flag} {COUNTRIES.find(c=>c.code===country)?.label} · {formatZoneLabel(selectedZone)}</div></div>
                  <div className="bg-gray-50 dark:bg-[#111] p-3 rounded-xl border"><div className="text-sm uppercase font-black opacity-60">Client</div><div className="font-bold truncate">{customerName || '—'} · {customerEmail}</div><div className="text-xs opacity-60">{customerPhone} {customerCompany && `· ${customerCompany}`}</div></div>
                  <div className="bg-gray-50 dark:bg-[#111] p-3 rounded-xl border md:col-span-2"><div className="text-sm uppercase font-black opacity-60">Adresse</div><div className="font-medium">{deliveryAddress || '—'}</div></div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 flex justify-between items-center"><span className="text-xs font-bold">Livraison</span><strong>{formatMoney(totals.shipping)}</strong></div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200 flex justify-between items-center"><span className="text-xs font-bold">Articles</span><span className="font-black">{totalQty} unités · {cart.length} réf.</span></div>
                </div>
                <div className="mt-6">
                  <div className="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Package className="w-3 h-3"/> Détail articles — quantités visibles</div>
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {cart.map((it,i)=>{
                      const anyIt:any=it;
                      const qty=anyIt.quantity;
                      const unit=parseFloat(String(anyIt.price).replace(/[^0-9.]/g,''))||0;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm border p-3 rounded-xl bg-gray-50 dark:bg-[#111] hover:bg-white dark:hover:bg-[#1a1a1a] transition">
                          <img src={anyIt.image} alt={anyIt.name} className="w-12 h-12 rounded-lg object-cover border"/>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{anyIt.name}</div>
                            <div className="text-xs opacity-60 flex flex-wrap gap-1"><span className="bg-white dark:bg-[#1a1a1a] px-2 py-0.5 rounded-full border font-mono">Qté ×{qty}</span> {anyIt.vatRate && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">TVA {anyIt.vatRate}%</span>} {anyIt.discountValue && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">-{anyIt.discountValue}{anyIt.discountType==='fixed'?'DZD':'%'}</span>}</div>
                          </div>
                          <span className="font-black">{formatMoney(unit*qty)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {antispamRequired && !captchaOk && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600"/> Merci de valider le captcha à l'étape Livraison (configurable dans Admin → Paramètres).</div>
                )}
                <div className="mt-6 flex flex-wrap gap-2">
                  <button onClick={()=>setStep(2)} className="ad-btn ad-btn-ghost rounded-full"><ArrowLeft className="w-4 h-4"/> Retour livraison</button>
                  <button onClick={handleCheckout} className="ad-btn bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-full ml-auto inline-flex items-center gap-2 px-8 py-3 font-black shadow-xl hover:scale-105 transition"><ShieldCheck className="w-5 h-5"/> Confirmer la commande</button>
                </div>
                <p className="text-sm text-gray-600 mt-3 bg-gray-50 dark:bg-[#111] p-3 rounded-xl border">En confirmant, vous acceptez les conditions de vente. Conditions affichées et validées à l'étape précédente. Vous pourrez encore annuler un article depuis le suivi commande tant que le statut est « En attente ». Livraison hors Algérie selon zone et frais indiqués.</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/${locale}/products`} className="ad-btn ad-btn-ghost rounded-full">Continuer les achats</Link>
                <button onClick={()=>setStep(1)} className="ad-btn ad-btn-ghost rounded-full">Modifier quantités</button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-b from-white to-gray-50 dark:from-[#1a1a1a] dark:to-[#111] p-6 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl sticky top-28">
                <h4 className="font-black mb-3 flex items-center gap-2"><Receipt className="w-5 h-5 text-sari-blue"/> Total à payer</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Sous-total</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                  {totals.productDiscount>0 && <div className="flex justify-between text-emerald-600"><span>Remises produits</span><span>-{formatMoney(totals.productDiscount)}</span></div>}
                  {totals.globalDiscount>0 && <div className="flex justify-between text-emerald-600"><span>Remise globale</span><span>-{formatMoney(totals.globalDiscount)}</span></div>}
                  {totals.couponDiscount>0 && <div className="flex justify-between text-emerald-600"><span>Coupon {appliedCoupon?.code}</span><span>-{formatMoney(totals.couponDiscount)}</span></div>}
                  <div className="flex justify-between"><span>Livraison ({country})</span><span>{formatMoney(totals.shipping)}</span></div>
                  {totals.taxLines.map(l=>(
                    <div key={l.id} className="flex justify-between text-xs text-gray-600 bg-white dark:bg-[#111] p-2 rounded-lg border"><span>{l.name}</span><span className="font-bold">{formatMoney(l.amount)}</span></div>
                  ))}
                  <div className="flex justify-between font-black text-lg pt-2 border-t" className="border-gray-200 dark:border-gray-700"><span>Total TTC</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600">{formatMoney(totals.total)}</span></div>
                  <div className="text-sm text-gray-600 text-center">{totalQty} unités · TVA par article détaillée · hors DZ inclus</div>
                </div>
                <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl text-xs flex gap-2 border border-green-200">
                  <Shield className="w-4 h-4 text-green-600 shrink-0"/><span>Paiement sécurisé — zones Algérie & hors Algérie, CGV vérifiées, captcha {antispamRequired?'activé':'désactivé'} (configurable).</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl max-w-md w-full animate-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-sari-blue to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><ShoppingCart className="w-8 h-8 text-white" /></div>
              <h2 className="text-2xl font-black text-sari-dark dark:text-white mb-2">{t('checkoutOptions')}</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('checkoutOptionsDesc')}</p>
              <p className="text-xs bg-gray-100 dark:bg-[#111] p-2 rounded-full mt-3 inline-block">Total : {formatMoney(totals.total)} · {COUNTRIES.find(c=>c.code===country)?.flag} {formatZoneLabel(selectedZone)} · {totalQty} unités</p>
              <div className="text-xs mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-left"><div className="font-bold">{customerName} · {customerEmail}</div><div className="opacity-70">{customerPhone} · {deliveryAddress.slice(0,40)}</div></div>
            </div>
            {antispamRequired && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl">
                <ImageCaptcha onChange={(ok) => { setCaptchaOk(ok); if (ok) setCaptchaError(''); }} />
                {captchaError && <p className="text-xs text-red-600 mt-1 bg-white dark:bg-[#111] p-2 rounded-lg">{captchaError}</p>}
              </div>
            )}
            <div className="space-y-3">
              <button onClick={() => handleCheckoutOption('login')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-sari-blue hover:shadow-lg transition-all rounded-2xl text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sari-blue/10 rounded-xl flex items-center justify-center group-hover:bg-sari-blue transition-colors"><LogIn className="w-5 h-5 text-sari-blue group-hover:text-white" /></div>
                  <div className="flex-1"><div className="font-black text-sari-dark dark:text-white">{t('optionLogin')}</div><div className="text-xs text-gray-500 dark:text-gray-400">{t('optionLoginDesc')}</div></div>
                </div>
              </button>
              <button onClick={() => handleCheckoutOption('pay')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:shadow-lg transition-all rounded-2xl text-left group bg-gradient-to-r from-white to-emerald-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors"><CreditCard className="w-5 h-5 text-emerald-600 group-hover:text-white" /></div>
                  <div className="flex-1"><div className="font-black text-sari-dark dark:text-white">{t('optionPay')}</div><div className="text-xs text-gray-500 dark:text-gray-400">{t('optionPayDesc')}</div></div>
                </div>
              </button>
              <button onClick={() => handleCheckoutOption('quote')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 transition-all rounded-2xl text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors"><FileText className="w-5 h-5 text-purple-500 group-hover:text-white" /></div>
                  <div className="flex-1"><div className="font-black text-sari-dark dark:text-white">{t('optionQuote')}</div><div className="text-xs text-gray-500 dark:text-gray-400">{t('optionQuoteDesc')}</div></div>
                </div>
              </button>
            </div>
            <button onClick={() => setShowCheckoutModal(false)} className="w-full mt-4 py-2 text-gray-500 hover:text-sari-dark dark:hover:text-white text-sm flex items-center justify-center gap-2 rounded-full hover:bg-gray-100"><span className="text-lg">×</span> {t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
