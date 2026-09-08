// components/verification/VerificationExperience.tsx
//
// L'expérience de vérification, montée par deux routes :
//   /{locale}/verification                    — saisie manuelle (aucun QR)
//   /{locale}/verification/{code}/{hash}       — lien scanné, champs pré-remplis
//
// Le formulaire ne juge plus rien tout seul : il envoie le couple (code, clé) à
// /api/verification/check, qui interroge l'API externe configurée dans
// l'administration et traduit son code de retour via le catalogue « Codes de
// vérification ». Le captcha est vérifié côté serveur, comme à l'inscription.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, AlertCircle, AlertTriangle,
  CheckCircle, Lock, RefreshCw, Search, FileText, QrCode,
  HelpCircle, Phone, Mail, ChevronDown, ChevronUp, Scale,
  Package, Truck, Users, CreditCard, ClipboardList,
  Briefcase
} from 'lucide-react';
import { getVerificationCodes } from '@/lib/data';
import type { VerificationCode } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';

/** La forme du verdict, telle que `handleVerify` la construit — voir /api/verification/check. */
interface VerificationResult {
  status: 'valid' | 'invalid' | 'expired' | 'revoked' | 'neutral' | 'not_found' | 'captcha_error' | 'blocked' | 'error' | 'api_error';
  message?: string;
  /** Libellé du catalogue, quand l'administrateur en a défini un — remplace le titre de l'écran. */
  label?: string;
  description?: string;
  reason?: string;
  type?: string;
  issuer?: string;
  showDetails?: boolean;
  apiCode?: string;
  source?: 'api' | 'local';
  notice?: string;
}

export default function VerificationExperience({
  initialCode = '',
  initialHash = '',
  fromQr = false,
}: {
  /** Pré-remplissage du champ « Code du document » (extrait de l'URL). */
  initialCode?: string;
  /** Pré-remplissage de la « Clé de vérification » — le `hash` du lien court. */
  initialHash?: string;
  /** Le couple arrive d'un lien de QR : on le signale et on vise le captcha. */
  fromQr?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('pages.verification');

  const [code, setCode] = useState(initialCode);
  const [key, setKey] = useState(initialHash);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Le captcha est émis par le serveur (`/api/verification/captcha`) : la page ne
  // voit qu'un identifiant et une image, jamais le code attendu. Un jeton ne sert
  // qu'une fois — chaque envoi, réussi ou non, en réclame un nouveau.
  const [captcha, setCaptcha] = useState<{ id: string; imageUrl: string; expiresIn: number } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaAttempts, setCaptchaAttempts] = useState(0);
  const [captchaBlocked, setCaptchaBlocked] = useState(false);
  const captchaInputRef = useRef<HTMLInputElement>(null);

  // Le mode du service — API externe activée, ou registre local de démonstration.
  const [mode, setMode] = useState<{ enabled: boolean; fallbackToLocal: boolean } | null>(null);

  const [verificationCodes, setVerificationCodes] = useState<VerificationCode[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getVerificationCodes(locale).then((codes) => { if (!cancelled) setVerificationCodes(codes); });
    return () => { cancelled = true; };
  }, [locale]);

  const refreshCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/verification/captcha', { cache: 'no-store' });
      setCaptcha(await res.json());
      setCaptchaAnswer('');
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshCaptcha();
      try {
        const r = await fetch('/api/verification/status', { cache: 'no-store' });
        const status = await r.json();
        if (!cancelled) setMode(status);
      } catch {
        // Pas de mode connu : l'écran reste en assume-démo, sans badge.
      }
    })();
    return () => { cancelled = true; };
  }, [refreshCaptcha]);

  // Le QR du bandeau latéral reflète la saisie en cours : scanner montre ce qu'on
  // vérifie. Il ne peut être construit qu'après le montage — `window.location.origin`
  // n'existe pas au rendu serveur — et l'écrire dans un état relancerait tout le
  // rendu à chaque frappe : on pose l'`src` sur l'image, directement.
  const qrImgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = qrImgRef.current;
    if (!img) return;
    const c = code.trim() || 'SARI-FAC24-00001';
    const k = key.trim() || 'CTdxXe6ZdFVzWQ==';
    const target = `${window.location.origin}/${locale}/verification/${encodeURIComponent(c)}/${encodeURIComponent(k)}`;
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(target)}`;
    img.style.opacity = '1';
  }, [locale, code, key]);

  // Scroll vers les résultats
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        // Le composant a pu être démonté pendant le délai : on revérifie.
        const node = resultRef.current;
        if (!node) return;
        const headerOffset = 120;
        const elementPosition = node.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }, 300);
    }
  }, [result]);

  // Un QR amené le couple tout fait : le seul geste qui reste est le captcha.
  useEffect(() => {
    if (!fromQr) return;
    const id = window.setTimeout(() => captchaInputRef.current?.focus(), 350);
    return () => window.clearTimeout(id);
  }, [fromQr]);

  const lockOut = () => {
    setCaptchaBlocked(true);
    setTimeout(() => {
      setCaptchaBlocked(false);
      setCaptchaAttempts(0);
      refreshCaptcha();
    }, 300000); // 5 minutes
  };

  const bumpCaptchaAttempt = () => {
    const attempts = captchaAttempts + 1;
    setCaptchaAttempts(attempts);
    if (attempts >= 5) lockOut();
  };

  // Vérification : une seule question au serveur, toutes les gardes avant lui.
  const handleVerify = async () => {
    if (captchaBlocked || isVerifying) return;

    const inputCode = code.trim();
    const inputKey = key.trim();
    // Un lien peut n'amener que le code (certains QR ne portent pas la clé,
    // elle se lit au bas du document) : c'est le champ manquant qu'on réclame,
    // pas un message d'erreur générique.
    if (!inputCode || !inputKey) {
      setResult({
        status: 'error',
        message: !inputCode && !inputKey
          ? t('results.errorMessage')
          : !inputCode
            ? t('form.codeMissing')
            : t('form.keyMissing')
      });
      return;
    }
    if (!captcha || !captchaAnswer.trim()) {
      setResult({
        status: 'captcha_error',
        message: t('results.captchaMessage')
      });
      bumpCaptchaAttempt();
      return;
    }

    setIsVerifying(true);
    setResult(null);
    try {
      const res = await fetch('/api/verification/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inputCode,
          key: inputKey,
          captchaId: captcha.id,
          captchaAnswer: captchaAnswer.trim(),
          locale,
        }),
      });
      interface CheckResponse {
        ok?: boolean;
        source?: 'api' | 'local';
        notice?: string;
        outcome?: { code?: string; semantic?: string; label?: string; description?: string; showDetails?: boolean };
        document?: { type?: string; issuer?: string; message?: string };
        error?: string;
        code?: string;
      }
      const data = (await res.json().catch(() => null)) as CheckResponse | null;

      if (res.ok && data && data.ok) {
        const outcome = data.outcome || {};
        const doc = data.document || {};
        const semantic: string = outcome.semantic || 'valid';
        const statusBySemantic: Record<string, VerificationResult['status']> = {
          valid: 'valid', forged: 'invalid', expired: 'expired', revoked: 'revoked',
        };
        const status: VerificationResult['status'] = statusBySemantic[semantic] || 'neutral';
        const fallbackMessage: Record<string, string> = {
          valid: t('results.valid.message'),
          expired: t('results.expired.message'),
          revoked: t('results.revoked.message'),
          invalid: t('results.invalid.message'),
          neutral: `Code ${outcome.code ?? ''}`.trim(),
        };
        setResult({
          status,
          label: outcome.label || undefined,
          message: outcome.label || fallbackMessage[status],
          description: outcome.description || undefined,
          reason: doc.message || undefined,
          type: doc.type,
          issuer: doc.issuer,
          showDetails: outcome.showDetails !== false,
          apiCode: outcome.code,
          source: data.source,
          notice: data.notice,
        });
      } else {
        const err = (data || {}) as { error?: string; code?: string };
        if (err.code === 'CAPTCHA') {
          setResult({ status: 'captcha_error', message: err.error || t('results.captchaMessage') });
          bumpCaptchaAttempt();
        } else if (err.code === 'TROP_DE_TENTATIVES') {
          setResult({ status: 'blocked', message: err.error || t('results.blockedMessage') });
          lockOut();
        } else if (err.code === 'INTROUVABLE') {
          setResult({ status: 'not_found', message: err.error || t('results.notFound.message') });
        } else if (err.code === 'FORMAT_CODE' || err.code === 'FORMAT_KEY' || err.code === 'PARAMETRES') {
          setResult({ status: 'error', message: err.error || t('results.errorMessage') });
        } else {
          setResult({ status: 'api_error', message: err.error || t('results.apiError.message') });
        }
      }
    } catch {
      // Réseautique ou serveur intermédiaire muet : le couple n'a pas été jugé.
      setResult({ status: 'api_error', message: t('results.apiError.message') });
    } finally {
      setIsVerifying(false);
      refreshCaptcha();
    }
  };

  const resetVerification = () => {
    setCode('');
    setKey('');
    setResult(null);
    setCaptchaAttempts(0);
    refreshCaptcha();
  };

  // Sous chaque résultat : d'où vient la réponse et quel code brut l'API a renvoyé.
  const renderMeta = (r: VerificationResult) => {
    if (!r || (!r.apiCode && !r.notice && !r.source)) return null;
    // Sous un feu vert, pas de récépissé : le code renvoyé et la source de la
    // réponse sont un détail de conducteurs. Sauf le repli local — lui, justement,
    // doit rester visible de tous.
    if (r.status === 'valid' && !r.notice) return null;
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {r.apiCode ? (
          <span>{t('results.meta.code')} <span className="font-mono font-bold text-sari-dark dark:text-white">{r.apiCode}</span></span>
        ) : null}
        {r.source ? <span>{r.source === 'api' ? t('results.meta.api') : t('results.meta.local')}</span> : null}
        {r.notice === 'api_injoignable' ? (
          <span className="font-semibold text-orange-600 dark:text-orange-400">{t('results.meta.apiUnreachable')}</span>
        ) : null}
      </div>
    );
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'facture_achat': 'Facture d\'achat',
      'facture_vente': 'Facture de vente',
      'bon_commande_achat': 'Bon de commande d\'achat',
      'bon_commande_vente': 'Bon de commande de vente',
      'bon_livraison': 'Bon de livraison',
      'bon_reception': 'Bon de réception',
      'devis_vente': 'Devis de vente',
      'devis_achat': 'Devis d\'achat',
      'produit': 'Certificat produit',
      'certificat_conformite': 'Certificat de conformité',
      'client': 'Fiche client',
      'fournisseur': 'Fiche fournisseur',
      'inventaire': 'Inventaire',
      'nif': 'NIF',
      'nis': 'NIS',
      'nai': 'NAI',
      'g50': 'G50',
      'charge': 'Charge',
      'revenue': 'Revenu',
      'mission': 'Mission',
      'catalogue': 'Catalogue',
      'document': 'Document',
      'rapport': 'Rapport',
      'lettre': 'Lettre',
      'modele': 'Modèle',
      'fiscalite': 'Fiscalité',
      'entree_stock': 'Entrée de stock',
      'sortie_stock': 'Sortie de stock',
      'consultation': 'Consultation',
      'importation': 'Importation',
      'exportation': 'Exportation',
      'employe': 'Fiche employé',
      'administration': 'Administration',
      'registre_commerce': 'Registre de commerce',
      'proces_verbal': 'Procès Verbal',
      'template': 'Template',
      'banque': 'Document bancaire',
      'garantie': 'Certificat de garantie'
    };
    return labels[type] || 'Document';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      'facture_achat': FileText,
      'facture_vente': FileText,
      'bon_commande_achat': CreditCard,
      'bon_commande_vente': CreditCard,
      'bon_livraison': Truck,
      'bon_reception': Package,
      'devis_vente': FileText,
      'devis_achat': FileText,
      'produit': Package,
      'certificat_conformite': ShieldCheck,
      'client': Users,
      'fournisseur': Truck,
      'inventaire': ClipboardList,
      'nif': FileText,
      'nis': FileText,
      'nai': FileText,
      'g50': FileText,
      'charge': CreditCard,
      'revenue': FileText,
      'mission': Briefcase,
      'catalogue': FileText,
      'document': FileText,
      'rapport': FileText,
      'lettre': Mail,
      'modele': FileText,
      'fiscalite': FileText,
      'entree_stock': Package,
      'sortie_stock': Package,
      'consultation': FileText,
      'importation': Truck,
      'exportation': Truck,
      'employe': Users,
      'administration': FileText,
      'registre_commerce': FileText,
      'proces_verbal': FileText,
      'template': FileText,
      'banque': CreditCard,
      'garantie': ShieldCheck
    };
    return icons[type] || FileText;
  };

  // FAQ depuis le JSON
  const faqQuestions = (t.raw('sidebar.faq.questions') || []) as { q: string; a: string }[];

  return (
    <div className="pt-32 pb-24 min-h-screen page-enter bg-gray-50 dark:bg-[#111111]">
      {/* Header parallaxe */}
      <div
        className="relative h-[400px] md:h-[500px] overflow-hidden border-b border-gray-200 dark:border-gray-800"
      >
        <img
          src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920"
          alt="Vérification"
          className="w-full h-full object-cover parallax-slow"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/1920x600?text=Verification'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/70 to-transparent"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
          <div className="max-w-4xl">
            <Breadcrumb items={[
              { label: t('breadcrumbHome'), href: '/' },
              { label: t('breadcrumbVerification') }
            ]} />
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-12 h-12 text-sari-lime" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {t('title')}
              </h1>
            </div>
            <p className="text-xl text-gray-200 max-w-2xl">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        {/* Grid principal */}
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-8">
            {/* Section Comment vérifier */}
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-8 md:p-12">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-sari-blue flex items-center justify-center flex-shrink-0 rounded-lg">
                  <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
                    {t('howToVerify.title')}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('howToVerify.desc')}{' '}
                    <strong className="text-sari-blue">{t('howToVerify.format')}</strong>{' '}
                    {t('howToVerify.andKey')}
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                {((t.raw('howToVerify.steps') || []) as { number?: number; title?: string; desc?: string }[]).map((step, i) => (
                  <div key={i} className="text-center">
                    <div className="w-16 h-16 bg-sari-blue/10 flex items-center justify-center mx-auto mb-4 rounded-full">
                      <span className="text-2xl font-bold text-sari-blue">{step.number || (i + 1)}</span>
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold text-sari-dark dark:text-white mb-4">
                  {t('howToVerify.verifiableTypes')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {(t.raw('howToVerify.types') || []).map((type: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-sari-lime flex-shrink-0" />
                      <span>{type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Formulaire de vérification */}
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-sari-lime flex items-center justify-center rounded-lg">
                  <ShieldCheck className="w-6 h-6 text-sari-dark" />
                </div>
                <h2 className="text-2xl font-bold text-sari-dark dark:text-white">
                  {t('form.title')}
                </h2>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 uppercase tracking-wider">
                    {t('form.codeLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={t('form.codePlaceholder')}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none transition-colors font-mono rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 uppercase tracking-wider">
                    {t('form.keyLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={t('form.keyPlaceholder')}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none transition-colors font-mono rounded-lg"
                    required
                  />
                </div>
                {/* Le lien scanné a tout amené sauf la preuve d'humanité. */}
                {(initialCode || initialHash) && (
                  <div className="mb-6 flex items-start gap-2 text-sm bg-sari-blue/10 border border-sari-blue/40 text-sari-blue px-4 py-3 rounded-lg">
                    <QrCode className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{t('prefilled')}</span>
                  </div>
                )}
                {/* CAPTCHA — émis par le serveur, vérifié par le serveur */}
                <div className="bg-gray-100 dark:bg-[#111111] border-2 border-sari-blue p-6 rounded-lg">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label htmlFor="verification-captcha" className="text-sm font-bold text-sari-dark dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-sari-blue" />
                      {t('form.captchaLabel')} <span className="text-red-500">*</span>
                    </label>
                    {mode && (
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${mode.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                        title={mode.enabled ? t('mode.apiHelp') : t('mode.demoHelp')}
                      >
                        {mode.enabled ? t('mode.api') : t('mode.demo')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-stretch gap-3">
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      title={t('form.newCaptcha')}
                      disabled={captchaBlocked}
                      className="shrink-0 bg-white rounded-md border-2 border-gray-200 dark:border-gray-700 p-1 hover:border-sari-blue transition-colors overflow-hidden"
                    >
                      {captcha ? (
                        <img src={captcha.imageUrl} alt="CAPTCHA" width={200} height={68} className="max-w-none" />
                      ) : (
                        <span className="inline-block w-[200px] h-[68px] bg-gray-100 animate-pulse rounded" />
                      )}
                    </button>
                    <input
                      id="verification-captcha"
                      ref={captchaInputRef}
                      type="text"
                      autoComplete="off"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerify(); } }}
                      placeholder={t('form.captchaPlaceholder')}
                      disabled={captchaBlocked}
                      className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none transition-colors font-mono text-lg uppercase tracking-[0.3em] text-center rounded-lg"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {captchaBlocked ? t('results.blockedMessage') : t('form.captchaHelp')}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isVerifying || captchaBlocked}
                    className="flex-1 btn-primary text-white px-8 py-4 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-lg"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        {t('form.verifying')}
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        {t('form.verify')}
                      </>
                    )}
                  </button>
                  {(code || key || result) && (
                    <button
                      type="button"
                      onClick={resetVerification}
                      className="px-6 py-4 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:border-sari-blue transition-colors flex items-center gap-2 rounded-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t('form.reset')}
                    </button>
                  )}
                </div>
              </form>
              {/* Codes de démonstration — que tant que le registre local répond */}
              {(!mode || !mode.enabled || mode.fallbackToLocal) && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-bold text-sari-dark dark:text-white mb-3">
                  {t('form.demoCodes')}
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                  {verificationCodes.slice(0, 6).map((v, i) => (
                    <button
                      key={i}
                      onClick={() => { setCode(v.code); setKey(v.key); setResult(null); window.setTimeout(() => captchaInputRef.current?.focus(), 50); }}
                      className="text-left p-3 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-gray-800 hover:border-sari-blue transition-colors rounded-lg"
                    >
                      <div className="font-mono text-sm text-sari-blue font-bold">{v.code}</div>
                      <div className="font-mono text-xs text-gray-500 truncate">{v.key}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {getTypeLabel(v.type)}
                        {v.status === 'invalid' && <span className="text-red-500 font-bold ml-2">⚠ FALSIFIÉ</span>}
                        {v.status === 'revoked' && <span className="text-orange-500 font-bold ml-2">🚫 RÉVOQUÉ</span>}
                        {v.status === 'expired' && <span className="text-yellow-600 font-bold ml-2">⏰ EXPIRÉ</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>

            {/* RÉSULTATS */}
            <div ref={resultRef}>
              {result && (
                <div className="animate-fade-in-up">
                  {/* ✅ DOCUMENT VALIDE */}
                  {result.status === 'valid' && (
                    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-green-500 flex items-center justify-center flex-shrink-0 rounded-full">
                          <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-1">
                            ✅ {result.label || t('results.valid.title')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                      {result.showDetails && (
                      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 p-4 rounded-lg mt-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">{t('results.valid.type')}</span>
                            <div className="font-semibold text-sari-dark dark:text-white flex items-center gap-2">
                              {(() => {
                                const Icon = getTypeIcon(result.type || '');
                                return <Icon className="w-4 h-4 text-sari-blue" />;
                              })()}
                              {getTypeLabel(result.type || '')}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">{t('results.valid.issuer')}</span>
                            <div className="font-semibold text-sari-dark dark:text-white">{result.issuer}</div>
                          </div>
                        </div>
                      </div>
                      )}
                      {result.description && (
                        <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded mt-6">
                          <p className="text-sm text-green-800 dark:text-green-300">{result.description}</p>
                        </div>
                      )}
                      {renderMeta(result)}
                    </div>
                  )}

                  {/* ⚠️ DOCUMENT EXPIRÉ */}
                  {result.status === 'expired' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-yellow-500 flex items-center justify-center flex-shrink-0 rounded-full">
                          <AlertTriangle className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-1">
                            ⚠️ {result.label || t('results.expired.title')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                      <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          {t('results.expired.desc')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 🚫 DOCUMENT RÉVOQUÉ */}
                  {result.status === 'revoked' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-orange-500 flex items-center justify-center flex-shrink-0 rounded-full">
                          <ShieldX className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-orange-700 dark:text-orange-400 mb-1">
                            🚫 {result.label || t('results.revoked.title')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                      {result.reason && (
                        <div className="bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-500 p-4 mb-4 rounded">
                          <p className="text-sm text-orange-800 dark:text-orange-300">
                            <strong>{t('results.revoked.reason')}</strong> {result.reason}
                          </p>
                        </div>
                      )}
                      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 p-4 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-300">
                          ⚠️ {t('results.revoked.warning')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 🚨 DOCUMENT INVALIDE / FALSIFIÉ */}
                  {result.status === 'invalid' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-4 border-red-600 shadow-2xl p-8 rounded-xl">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-red-600 flex items-center justify-center flex-shrink-0 animate-pulse rounded-full">
                          <ShieldAlert className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-1">
                            🚨 {result.label || t('results.invalid.title')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                      {result.reason && (
                        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600 p-4 mb-4 rounded">
                          <p className="text-sm text-red-800 dark:text-red-300">
                            <strong>{t('results.invalid.reported')}</strong> {result.reason}
                          </p>
                        </div>
                      )}
                      <div className="bg-sari-dark text-white p-4 rounded-lg">
                        <p className="text-sm text-gray-300">
                          ⚖️ <strong>{t('results.invalid.legal')}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ❌ DOCUMENT NON TROUVÉ */}
                  {result.status === 'not_found' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-4 border-red-600 shadow-2xl p-8 rounded-xl">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-red-600 flex items-center justify-center flex-shrink-0 animate-pulse rounded-full">
                          <AlertCircle className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-1">
                            ❌ {t('results.notFound.title')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 p-4 mb-4 rounded-lg">
                        <h4 className="font-bold text-sari-dark dark:text-white mb-2">
                          {t('results.notFound.actions')}
                        </h4>
                        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                          {(t.raw('results.notFound.steps') || []).map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                      <div className="bg-sari-dark text-white p-4 rounded-lg">
                        <p className="text-sm text-gray-300">
                          ⚖️ <strong>{t('results.notFound.legal')}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ⚠️ ERREUR CAPTCHA */}
                  {result.status === 'captcha_error' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-500 flex items-center justify-center flex-shrink-0 rounded-full">
                          <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                            {t('results.captchaError')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🚫 BLOQUÉ */}
                  {result.status === 'blocked' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-4 border-red-600 shadow-2xl p-8 rounded-xl">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-600 flex items-center justify-center flex-shrink-0 rounded-full">
                          <Lock className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                            {t('results.blocked')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ❌ ERREUR DE SAISIE */}
                  {result.status === 'error' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-500 flex items-center justify-center flex-shrink-0 rounded-full">
                          <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                            {t('results.error')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {result.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* ℹ️ CODE PERSONNALISÉ — toute valeur du catalogue hors des quatre historiques */}
                  {result.status === 'neutral' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-sari-blue shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-sari-blue flex items-center justify-center flex-shrink-0 rounded-full">
                          <Shield className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-sari-dark dark:text-white mb-1">
                            {result.message}
                          </h3>
                          {result.description && (
                            <p className="text-gray-600 dark:text-gray-400">{result.description}</p>
                          )}
                        </div>
                      </div>
                      {result.showDetails && (result.type || result.issuer) && (
                        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {result.type && (
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">{t('results.valid.type')}</span>
                                <div className="font-semibold text-sari-dark dark:text-white">{result.type}</div>
                              </div>
                            )}
                            {result.issuer && (
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">{t('results.valid.issuer')}</span>
                                <div className="font-semibold text-sari-dark dark:text-white">{result.issuer}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {renderMeta(result)}
                    </div>
                  )}

                  {/* 🔌 SERVICE DE VÉRIFICATION INDISPONIBLE */}
                  {result.status === 'api_error' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 shadow-xl p-8 rounded-xl">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-500 flex items-center justify-center flex-shrink-0 rounded-full">
                          <AlertTriangle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                            {t('results.apiError.title')}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            {result.message}
                          </p>
                          <button
                            type="button"
                            onClick={handleVerify}
                            disabled={captchaBlocked || !captcha}
                            className="inline-flex items-center gap-2 bg-sari-blue text-white px-5 py-2.5 font-semibold hover:bg-sari-dark transition-colors rounded-lg disabled:opacity-50"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {t('results.apiError.retry')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              {/* Scan QR Code */}
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-sari-blue flex items-center justify-center rounded-lg">
                    <QrCode className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-sari-dark dark:text-white">
                    {t('sidebar.qrCode.title')}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('sidebar.qrCode.desc')}
                </p>
                <div className="bg-gray-100 dark:bg-[#111111] border border-gray-200 dark:border-gray-800 p-4 text-center rounded-lg">
                  <div className="w-32 h-32 bg-white p-2 mx-auto mb-3 border-2 border-sari-blue rounded">
                    <img
                      ref={qrImgRef}
                      alt="QR Code"
                      className="w-full h-full transition-opacity duration-300"
                      style={{ opacity: 0 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('sidebar.qrCode.example')}
                  </p>
                </div>
              </div>

              {/* FAQ */}
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-6 rounded-xl">
                <h3 className="text-lg font-bold text-sari-dark dark:text-white mb-4 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-sari-blue" />
                  {t('sidebar.faq.title')}
                </h3>
                <div className="space-y-2">
                  {Array.isArray(faqQuestions) && faqQuestions.map((faq, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-sm font-semibold text-sari-dark dark:text-white pr-2">
                          {faq.q}
                        </span>
                        {openFaq === i ? (
                          <ChevronUp className="w-4 h-4 text-sari-blue flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-sari-blue flex-shrink-0" />
                        )}
                      </button>
                      {openFaq === i && (
                        <div className="p-3 pt-0 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Support */}
              <div className="bg-sari-blue text-white p-6 rounded-xl">
                <div className="w-12 h-12 bg-white/20 flex items-center justify-center mb-4 rounded-lg">
                  <Phone className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">
                  {t('sidebar.support.title')}
                </h3>
                <p className="text-blue-100 text-sm mb-4">
                  {t('sidebar.support.desc')}
                </p>
                <Link
                  href={`/${locale}/contact`}
                  className="bg-white text-sari-blue px-6 py-3 font-semibold inline-flex items-center gap-2 hover:bg-sari-lime transition-colors rounded-lg"
                >
                  <Mail className="w-4 h-4" />
                  {t('sidebar.support.cta')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Mentions Légales */}
        <div className="mt-16 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl p-8 md:p-12 rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-sari-dark flex items-center justify-center rounded-lg">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-sari-dark dark:text-white">
              {t('legal.title')}
            </h2>
          </div>
          <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
            <p className="mb-4">
              {t('legal.intro')}{' '}
              <strong className="text-sari-blue">{t('legal.format')}</strong>{' '}
              {t('legal.andKey')}
            </p>
            <h3 className="text-xl font-bold text-sari-dark dark:text-white mt-6 mb-3">
              {t('legal.formatTitle')}
            </h3>
            <p className="mb-4">
              {t('legal.formatDesc')}{' '}
              <strong>{t('legal.prefix')}</strong>{' '}
              {t('legal.prefixDesc')}{' '}
              <strong>{t('legal.type')}</strong>{' '}
              {t('legal.typeDesc')}{' '}
              <strong>{t('legal.year')}</strong>{' '}
              {t('legal.yearDesc')}{' '}
              <strong>{t('legal.sequence')}</strong>{' '}
              {t('legal.sequenceDesc')}
            </p>
            <h3 className="text-xl font-bold text-sari-dark dark:text-white mt-6 mb-3">
              {t('legal.legalValueTitle')}
            </h3>
            <p className="mb-4">
              {t('legal.legalValueDesc')}
            </p>
            <h3 className="text-xl font-bold text-sari-dark dark:text-white mt-6 mb-3">
              {t('legal.antiCounterfeitTitle')}
            </h3>
            <p className="mb-4">
              {t('legal.antiCounterfeitDesc')}
            </p>
            <h3 className="text-xl font-bold text-sari-dark dark:text-white mt-6 mb-3">
              {t('legal.dataProtectionTitle')}
            </h3>
            <p className="mb-4">
              {t('legal.dataProtectionDesc')}{' '}
              <strong>{t('legal.law')}</strong>{' '}
              {t('legal.lawDesc')}
            </p>
            <div className="bg-sari-blue/5 border-l-4 border-sari-blue p-4 mt-6 rounded">
              <p className="text-sm mb-0">
                <strong>⚠️ {t('legal.warning')}</strong>{' '}
                {t('legal.warningDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}