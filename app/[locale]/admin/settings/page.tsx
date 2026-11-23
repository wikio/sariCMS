'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { FolderOpen, Image as ImageIcon, Save, Search, Sparkles, Upload } from 'lucide-react';
import { DEFAULT_SETTINGS, loadAdminSettings, saveAdminSettings, type AdminSettings } from '@/lib/admin-settings';
import { useDocRefresh } from '@/lib/use-settings-doc';
import { hydrateSiteLogo, saveSiteLogo } from '@/lib/site-contact';
import { previewCode, DEFAULT_TEMPLATES, type CodeKind } from '@/lib/codes';
import VerificationSettingsSection from '@/components/admin/VerificationSettingsSection';
import SmtpSection from '@/components/admin/SmtpSection';
import ContactTriageSettings from '@/components/admin/ContactTriageSettings';
import MailCenterSection from '@/components/admin/MailCenterSection';
import MaintenanceSection from '@/components/admin/MaintenanceSection';
import DemoDataSection from '@/components/admin/DemoDataSection';
import BrandSection from '@/components/admin/BrandSection';
import PlaceholderSettingsSection from '@/components/admin/PlaceholderSettingsSection';
import { testErpConnection } from '@/lib/erp';
import { useToast } from '@/components/admin/Toast';
import GedPicker from '@/components/admin/GedPicker';
import DateFormatPicker from '@/components/admin/DateFormatPicker';
import { notifyDateSettingsChanged } from '@/lib/use-date-format';

type SectionId = 'general' | 'commerce' | 'security' | 'integrations' | 'emails' | 'seo';
type TabId = 'general' | 'dates' | 'products' | 'codes' | 'quotes' | 'invoicing' | 'security' | 'smtp' | 'database' | 'maintenance' | 'verification' | 'mail' | 'contactTriage' | 'seo' | 'brand' | 'demo' | 'placeholder';

interface TabDef { id: TabId; labelKey: string }
interface SectionDef { id: SectionId; labelKey: string; tabs: TabDef[] }

const SECTIONS: SectionDef[] = [
  { id: 'general', labelKey: 'general', tabs: [
    { id: 'brand', labelKey: 'brand' },
    { id: 'general', labelKey: 'identityLanguage' },
    { id: 'placeholder', labelKey: 'placeholder' },
    { id: 'dates', labelKey: 'dates' },
  ] },
  { id: 'commerce', labelKey: 'commerce', tabs: [
    { id: 'products', labelKey: 'products' },
    { id: 'codes', labelKey: 'codes' },
    { id: 'quotes', labelKey: 'quotes' },
    { id: 'invoicing', labelKey: 'invoicing' },
  ] },
  { id: 'security', labelKey: 'security', tabs: [
    { id: 'security', labelKey: 'accessCaptcha' },
  ] },
  { id: 'integrations', labelKey: 'integrations', tabs: [
    { id: 'smtp', labelKey: 'smtp' },
    { id: 'verification', labelKey: 'verification' },
    { id: 'database', labelKey: 'database' },
    { id: 'maintenance', labelKey: 'maintenance' },
    { id: 'demo', labelKey: 'demo' },
  ] },
  { id: 'emails', labelKey: 'emails', tabs: [
    { id: 'mail', labelKey: 'mail' },
    { id: 'contactTriage', labelKey: 'contactTriage' },
  ] },
  { id: 'seo', labelKey: 'seoSection', tabs: [
    { id: 'seo', labelKey: 'seo' },
  ] },
];

export default function AdminSettingsPage() {
  const t = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();
  const locale = useLocale();
  const params = useSearchParams();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [section, setSection] = useState<SectionId>('general');
  const [tab, setTab] = useState<TabId>('general');
  const [q, setQ] = useState('');

  // Lien profond `?tab=<onglet>` : l'accueil envoie vers « Import & jeu de
  // démonstration », qu'il ne fallait plus chercher dans les six sections. Un
  // onglet inconnu est ignoré plutôt qu'ouvert — atterrir sur une section vide
  // serait plus déroutant que rester sur « Général ».
  useEffect(() => {
    const wanted = params?.get('tab') as TabId | null;
    if (!wanted) return;
    const owner = SECTIONS.find((sec) => sec.tabs.some((tb) => tb.id === wanted));
    if (!owner) return;
    setSection(owner.id);
    setTab(wanted);
  }, [params]);

  useEffect(() => { setSettings(loadAdminSettings()); }, []);
  // Idem : les réglages partagés descendent de la base juste après ce montage.
  useDocRefresh('admin', () => setSettings(loadAdminSettings()));

  // Le logo de vitrine se lit dans `ContactInfo`, pas dans le cache du poste :
  // c'est la seule valeur que le rendu serveur de l'en-tête applique, donc la
  // seule que voit un visiteur. Un poste qui en avait saisi un avant cette
  // bascule le voit monté en base plutôt qu'écrasé par la valeur vide.
  useEffect(() => {
    let alive = true;
    hydrateSiteLogo(locale)
      .then(({ logo }) => {
        if (!alive) return;
        setSettings((prev) => (prev.siteLogo === logo ? prev : { ...prev, siteLogo: logo }));
      })
      .catch(() => { /* hors ligne : le cache local reste affiché */ });
    return () => { alive = false; };
  }, [locale]);

  const setDb = (patch: Partial<AdminSettings['db']>) => setSettings({ ...settings, db: { ...settings.db, ...patch } });
  const setQuote = (patch: Partial<AdminSettings['quote']>) => setSettings({ ...settings, quote: { ...settings.quote, ...patch } });
  const setCodes = (patch: Partial<AdminSettings['codes']>) => setSettings({ ...settings, codes: { ...settings.codes, ...patch } });
  const setErp = (patch: Partial<AdminSettings['erp']>) => setSettings({ ...settings, erp: { ...settings.erp, ...patch } });
  const setInvoicing = (patch: Partial<AdminSettings['invoicing']>) => setSettings({ ...settings, invoicing: { ...settings.invoicing, ...patch } });

  const selectSection = (id: SectionId) => {
    setSection(id);
    setTab(SECTIONS.find((s) => s.id === id)?.tabs[0].id || 'general');
  };

  // Recherche globale : met en évidence les onglets (et leur section) correspondants.
  const matching = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return { tabs: new Set<TabId>(), sections: new Set<SectionId>() };
    const tabs = new Set<TabId>();
    const sections = new Set<SectionId>();
    for (const s of SECTIONS) {
      if (t(s.labelKey).toLowerCase().includes(needle)) sections.add(s.id);
      for (const tab of s.tabs) {
        if (t(tab.labelKey).toLowerCase().includes(needle) || t(`search_${tab.id}`).toLowerCase().includes(needle)) {
          tabs.add(tab.id);
          sections.add(s.id);
        }
      }
    }
    return { tabs, sections };
  }, [q, t]);

  const activeSection = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>{t('system')}</div>
        <h1 className="text-3xl font-black">{t('title')}</h1>
      </header>

      <div className="grid lg:grid-cols-12 gap-4">
        {/* Sous-menu */}
        <aside className="lg:col-span-3">
          <div className="ad-card p-2 space-y-1 sticky top-24">
            <div className="relative px-2 pb-2">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
              <input
                className="ad-input ad-input-icon pl-8"
                placeholder={t('search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {SECTIONS.map((s) => {
              const on = section === s.id;
              const hl = q.trim() && matching.sections.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSection(s.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between ${on ? 'font-bold' : ''}`}
                  style={{ background: on ? 'color-mix(in srgb, var(--ad-accent) 14%, transparent)' : undefined, borderRadius: 8 }}
                >
                  <span>{t(s.labelKey)}</span>
                  {hl && !on && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ad-accent)' }} />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Onglets + contenu */}
        <div className="lg:col-span-9 space-y-4">
          <div className="ad-card p-3">
            <div className="flex flex-wrap gap-1">
              {activeSection.tabs.map((item) => {
                const on = tab === item.id;
                const hl = q.trim() && matching.tabs.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`ad-btn ${on ? 'ad-btn-primary' : 'ad-btn-ghost'} ${hl && !on ? '!border-[var(--ad-accent)]' : ''}`}
                  >
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
            {q.trim() && matching.tabs.size === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--ad-muted)' }}>{t('noMatches', { query: q })}</p>
            )}
          </div>

          {tab === 'general' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('identityLanguage')}</h2>
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('siteLogo')}</span>
                <SiteLogoField
                  value={settings.siteLogo || ''}
                  onChange={(v) => {
                    setSettings({ ...settings, siteLogo: v });
                    // Le cache local donne le retour visuel immédiat à l'opérateur ;
                    // la base, elle, est ce que le visiteur recevra au prochain rendu.
                    saveSiteLogo(locale, v)
                      .then(() => showToast(t('logoSaved'), 'success'))
                      .catch(() => showToast(t('logoError'), 'error'));
                  }}
                />
                <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                  {t('logoHint')}
                </p>
              </div>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('defaultLanguage')}</span>
                <select className="ad-select" value={settings.defaultLocale} onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value as AdminSettings['defaultLocale'] })}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
            </section>
          )}

          {tab === 'dates' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('dates')}</h2>
              <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                {t('datesHint')}
              </p>

              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('displayFormat')}
                </span>
                <DateFormatPicker
                  value={settings.dates.format}
                  onChange={(v) => setSettings({ ...settings, dates: { ...settings.dates, format: v } })}
                />
              </div>

              <ToggleRow
                label={t('showTime')}
                hint={t('showTimeHint')}
                on={settings.dates.showTime}
                onToggle={() => setSettings({ ...settings, dates: { ...settings.dates, showTime: !settings.dates.showTime } })}
              />
            </section>
          )}

          {tab === 'products' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('products')}</h2>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('restock')}</span>
                <textarea className="ad-textarea" value={settings.restockMessage || ''} onChange={(e) => setSettings({ ...settings, restockMessage: e.target.value })} />
                <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('restockHint', { date: '{{date_reapprovisionnement}}', product: '{{produit}}' })}</p>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('cropWidth')}</span>
                  <input className="ad-input" type="number" value={settings.cropWidth} onChange={(e) => setSettings({ ...settings, cropWidth: Number(e.target.value) })} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('cropHeight')}</span>
                  <input className="ad-input" type="number" value={settings.cropHeight} onChange={(e) => setSettings({ ...settings, cropHeight: Number(e.target.value) })} />
                </label>
              </div>
            </section>
          )}

          {tab === 'codes' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('codes')}</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                {t('codeTokens', { id: '{ID}', year: '{XX}' })}
              </p>
              {(['quote', 'order', 'invoice', 'product'] as CodeKind[]).map((kind) => (
                <label key={kind} className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--ad-muted)' }}>
                    {t(`code_${kind}`)}
                    <span className="ad-chip ad-chip-acc">{previewCode(kind, settings.codes[kind])}</span>
                  </span>
                  <input className="ad-input font-mono" value={settings.codes[kind]} onChange={(e) => setCodes({ [kind]: e.target.value } as Partial<AdminSettings['codes']>)} />
                </label>
              ))}
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setCodes({ ...DEFAULT_TEMPLATES })}>
                {t('resetFormats')}
              </button>
            </section>
          )}

          {tab === 'quotes' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('quotes')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('lineLimit')}</span>
                  <input className="ad-input" type="number" min={0} value={settings.quote.maxLines} onChange={(e) => setQuote({ maxLines: Number(e.target.value) || 0 })} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('validDays')}</span>
                  <input className="ad-input" type="number" min={1} value={settings.quote.validityDays} onChange={(e) => setQuote({ validityDays: Number(e.target.value) || 30 })} />
                </label>
              </div>
              <ToggleRow
                label={t('convert')}
                hint={t('convertHint')}
                on={settings.quote.autoTransformToOrder}
                onToggle={() => setQuote({ autoTransformToOrder: !settings.quote.autoTransformToOrder })}
              />
              <ToggleRow
                label={t('attachment')}
                hint={t('attachmentHint')}
                on={settings.quote.requireAttachment}
                onToggle={() => setQuote({ requireAttachment: !settings.quote.requireAttachment })}
              />
            </section>
          )}

          {tab === 'invoicing' && <InvoicingSection settings={settings} setErp={setErp} setInvoicing={setInvoicing} />}

          {tab === 'security' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('securityTitle')}</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('securityHint')}</p>
              <ToggleRow
                label={t('admin2fa')}
                hint={t('admin2faHint')}
                on={settings.security.admin2fa}
                onToggle={() => setSettings({ ...settings, security: { ...settings.security, admin2fa: !settings.security.admin2fa } })}
              />
              <ToggleRow
                label={t('adminCaptcha')}
                hint={t('adminCaptchaHint')}
                on={settings.security.adminCaptcha}
                onToggle={() => setSettings({ ...settings, security: { ...settings.security, adminCaptcha: !settings.security.adminCaptcha } })}
              />
              <ToggleRow
                label={t('siteCaptcha')}
                hint={t('siteCaptchaHint')}
                on={settings.security.siteCaptcha}
                onToggle={() => setSettings({ ...settings, security: { ...settings.security, siteCaptcha: !settings.security.siteCaptcha } })}
              />
              <ToggleRow
                label={t('loginToApply')}
                hint={t('loginToApplyHint')}
                on={settings.requireAuthToApply}
                onToggle={() => setSettings({ ...settings, requireAuthToApply: !settings.requireAuthToApply })}
              />
            </section>
          )}

          {/*
            SMTP a sa propre section : c'est le seul onglet dont les réglages
            doivent atteindre le serveur d'API. L'ancien formulaire écrivait dans
            le `localStorage`, donc jamais jusqu'au transport — voir
            `components/admin/SmtpSection.tsx`.
          */}
          {tab === 'smtp' && <SmtpSection />}

          {tab === 'verification' && <VerificationSettingsSection />}

          {tab === 'mail' && <MailCenterSection />}
          {tab === 'contactTriage' && <ContactTriageSettings />}

          {tab === 'seo' && <SeoSection />}

          {tab === 'maintenance' && <MaintenanceSection />}

          {tab === 'demo' && <DemoDataSection />}

          {tab === 'brand' && <BrandSection />}

          {tab === 'placeholder' && <PlaceholderSettingsSection />}

          {tab === 'database' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">{t('database')}</h2>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('driver')}</span>
                <select className="ad-select" value={settings.db.driver} onChange={(e) => setDb({ driver: e.target.value as AdminSettings['db']['driver'] })}>
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="json">{t('jsonLocal')}</option>
                </select>
              </label>
              <Field label={t('dbUrl')} value={settings.db.url} onChange={(v) => setDb({ url: v })} />
              <Field label={t('schema')} value={settings.db.schema} onChange={(v) => setDb({ schema: v })} />
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('dbHint')}</p>
            </section>
          )}

          {tab !== 'placeholder' && (
            <button className="ad-btn ad-btn-primary" onClick={() => { saveAdminSettings(settings); notifyDateSettingsChanged(); showToast(t('saved'), 'success'); }}>
              <Save className="w-4 h-4" /> {tc('save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ Facturation & ERP ============================ */

function InvoicingSection({ settings, setErp, setInvoicing }: {
  settings: AdminSettings;
  setErp: (p: Partial<AdminSettings['erp']>) => void;
  setInvoicing: (p: Partial<AdminSettings['invoicing']>) => void;
}) {
  const t = useTranslations('admin.settings');
  const { showToast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  return (
    <section className="ad-card p-5 space-y-4">
      <h2 className="ad-section-title">{t('erpTitle')}</h2>
      <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
        {t('erpHint')}
      </p>

      <ToggleRow
        label={t('erpEnabled')}
        hint={t('erpEnabledHint')}
        on={settings.erp.enabled}
        onToggle={() => setErp({ enabled: !settings.erp.enabled })}
      />
      <Field label={t('erpUrl')} value={settings.erp.apiUrl} onChange={(v) => setErp({ apiUrl: v })} />
      <label className="space-y-1.5 block">
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('apiKey')}</span>
        <input className="ad-input font-mono" type="password" value={settings.erp.apiKey} onChange={(e) => setErp({ apiKey: e.target.value })} />
      </label>
      <button
        type="button"
        className="ad-btn ad-btn-ghost"
        disabled={testing}
        onClick={async () => {
          setTesting(true); setTestResult(null);
          // Applique temporairement la config avant le test.
          saveAdminSettings(settings);
          const res = await testErpConnection();
          const message = t(res.messageKey, { status: res.status ?? '' });
          setTestResult(message);
          setTesting(false);
          showToast(message, res.ok ? 'success' : 'error');
        }}
      >
        {testing ? t('testing') : t('testErp')}
      </button>
      {testResult && <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{testResult}</p>}

      <div className="pt-2" style={{ borderTop: '1px solid var(--ad-line)' }}>
        <ToggleRow
          label={t('requirePaid')}
          hint={t('requirePaidHint')}
          on={settings.invoicing.requirePaidToInvoice}
          onToggle={() => setInvoicing({ requirePaidToInvoice: !settings.invoicing.requirePaidToInvoice })}
        />
        <ToggleRow
          label={t('autoInvoice')}
          hint={t('autoInvoiceHint')}
          on={settings.invoicing.autoFetchInvoice}
          onToggle={() => setInvoicing({ autoFetchInvoice: !settings.invoicing.autoFetchInvoice })}
        />
      </div>
    </section>
  );
}

function SeoSection() {
  const t = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();
  const [locale, setLocale] = useState('fr');
  const [seo, setSeo] = useState({
    title: '', titleTemplate: '', description: '', keywords: '',
    ogTitle: '', ogDescription: '', ogImage: '', twitter: '',
    canonical: '', robots: 'index, follow', googleSiteVerification: '', favicon: '',
  });

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/seo?locale=${locale}`);
      const json = await res.json();
      if (json.seo) setSeo((prev) => ({ ...prev, ...json.seo }));
    })();
  }, [locale]);

  return (
    <section className="ad-card p-5 space-y-4">
      <h2 className="ad-section-title">{t('seoTitle')}</h2>
      <div className="flex gap-2">
        {['fr', 'en', 'ar'].map((loc) => (
          <button key={loc} type="button" className={`ad-btn ${locale === loc ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setLocale(loc)}>{loc.toUpperCase()}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label={tc('title')} value={seo.title} onChange={(v) => setSeo({ ...seo, title: v })} />
        <Field label={t('seoTemplate')} value={seo.titleTemplate} onChange={(v) => setSeo({ ...seo, titleTemplate: v })} />
        <label className="md:col-span-2 space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{tc('description')}</span>
          <textarea className="ad-textarea" value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })} />
        </label>
        <Field label={t('keywords')} value={seo.keywords} onChange={(v) => setSeo({ ...seo, keywords: v })} />
        <Field label={t('robots')} value={seo.robots} onChange={(v) => setSeo({ ...seo, robots: v })} />
        <Field label={t('ogTitle')} value={seo.ogTitle} onChange={(v) => setSeo({ ...seo, ogTitle: v })} />
        <Field label={t('ogDescription')} value={seo.ogDescription} onChange={(v) => setSeo({ ...seo, ogDescription: v })} />
        <Field label={t('ogImage')} value={seo.ogImage} onChange={(v) => setSeo({ ...seo, ogImage: v })} />
        <Field label="Twitter / X" value={seo.twitter} onChange={(v) => setSeo({ ...seo, twitter: v })} />
        <Field label={t('canonical')} value={seo.canonical} onChange={(v) => setSeo({ ...seo, canonical: v })} />
        <Field label={t('favicon')} value={seo.favicon} onChange={(v) => setSeo({ ...seo, favicon: v })} />
        <Field label="Google Search Console" value={seo.googleSiteVerification} onChange={(v) => setSeo({ ...seo, googleSiteVerification: v })} />
      </div>
      <button type="button" className="ad-btn ad-btn-primary" onClick={async () => {
        await fetch('/api/admin/seo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, seo }) });
        showToast(t('seoSaved'), 'success');
      }}>{t('saveSeo', { language: locale.toUpperCase() })}</button>
    </section>
  );
}

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  const t = useTranslations('admin.settings');
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--ad-line)' }}>
      <div className="space-y-0.5">
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{hint}</div>}
      </div>
      <button type="button" onClick={onToggle} className={`ad-toggle ${on ? 'is-on' : ''}`} aria-pressed={on} role="switch">
        {on ? (
          <>
            <span className="ad-toggle-label">{t('enabled')}</span>
            <span className="ad-toggle-knob" />
          </>
        ) : (
          <>
            <span className="ad-toggle-knob" />
            <span className="ad-toggle-label">{t('disabled')}</span>
          </>
        )}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{label}</span>
      <input className="ad-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SiteLogoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();
  const locale = useLocale();
  const [ged, setGed] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('module', 'logo');
      body.append('label', file.name);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const json = await res.json();
      if (json.url) onChange(json.url);
      else showToast(json.error || t('uploadError'), 'error');
    } catch {
      showToast(t('uploadError'), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div
          className="w-24 h-24 shrink-0 flex items-center justify-center rounded-lg border border-dashed overflow-hidden"
          style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={t('siteLogo')} className="max-w-full max-h-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <ImageIcon className="w-8 h-8" style={{ color: 'var(--ad-muted)' }} />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input className="ad-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('logoPlaceholder')} />
          <div className="flex flex-wrap gap-2">
            <label className="ad-btn ad-btn-ghost cursor-pointer">
              <Upload className="w-4 h-4" /> {uploading ? t('uploading') : tc('upload')}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
            </label>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setGed(true)}>
              <FolderOpen className="w-4 h-4" /> {t('media')}
            </button>
            <Link href={`/${locale}/admin/media/studio`} className="ad-btn ad-btn-ghost">
              <Sparkles className="w-4 h-4" /> {t('createLogo')}
            </Link>
            {value && (
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange('')}>
                {t('remove')}
              </button>
            )}
          </div>
        </div>
      </div>
      {ged && <GedPicker accept="image/*" onClose={() => setGed(false)} onPick={(url) => { onChange(url); setGed(false); }} />}
    </div>
  );
}
