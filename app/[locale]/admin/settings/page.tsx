'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Search } from 'lucide-react';
import { DEFAULT_SETTINGS, loadAdminSettings, saveAdminSettings, type AdminSettings } from '@/lib/admin-settings';
import { previewCode, DEFAULT_TEMPLATES, type CodeKind } from '@/lib/codes';
import { testErpConnection } from '@/lib/erp';
import { useToast } from '@/components/admin/Toast';

type SectionId = 'general' | 'commerce' | 'security' | 'integrations' | 'seo';
type TabId = 'general' | 'codes' | 'quotes' | 'invoicing' | 'security' | 'smtp' | 'database' | 'seo';

interface TabDef { id: TabId; label: string }
interface SectionDef { id: SectionId; label: string; tabs: TabDef[] }

const SECTIONS: SectionDef[] = [
  { id: 'general', label: 'Général', tabs: [
    { id: 'general', label: 'Langue & produits' },
    { id: 'codes', label: 'Format des codes' },
  ] },
  { id: 'commerce', label: 'Commerce', tabs: [
    { id: 'quotes', label: 'Devis & commandes' },
    { id: 'invoicing', label: 'Facturation & ERP' },
  ] },
  { id: 'security', label: 'Sécurité', tabs: [
    { id: 'security', label: 'Accès & CAPTCHA' },
  ] },
  { id: 'integrations', label: 'Intégrations', tabs: [
    { id: 'smtp', label: 'SMTP / Email' },
    { id: 'database', label: 'Base de données' },
  ] },
  { id: 'seo', label: 'SEO', tabs: [
    { id: 'seo', label: 'Référencement' },
  ] },
];

// Index de recherche : onglet → mots-clés.
const SEARCH_INDEX: Record<TabId, string> = {
  general: 'langue format produit réapprovisionnement crop largeur hauteur code sku',
  codes: 'code format devis commande facture produit numéro année',
  quotes: 'devis ligne validité commande pièce jointe transformer expiration',
  invoicing: 'facture facturation erp api clé url upload paiement',
  security: '2fa captcha connexion postuler double authentification sécurité accès',
  smtp: 'smtp hôte port utilisateur mot de passe expéditeur tls ssl email',
  database: 'base de données driver mysql postgresql mongodb json url schéma',
  seo: 'seo titre description mots-clés open graph twitter favicon canonical robots',
};

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [section, setSection] = useState<SectionId>('general');
  const [tab, setTab] = useState<TabId>('general');
  const [q, setQ] = useState('');

  useEffect(() => { setSettings(loadAdminSettings()); }, []);

  const setSmtp = (patch: Partial<AdminSettings['smtp']>) => setSettings({ ...settings, smtp: { ...settings.smtp, ...patch } });
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
      if (s.label.toLowerCase().includes(needle)) sections.add(s.id);
      for (const t of s.tabs) {
        if (t.label.toLowerCase().includes(needle) || SEARCH_INDEX[t.id].includes(needle)) {
          tabs.add(t.id);
          sections.add(s.id);
        }
      }
    }
    return { tabs, sections };
  }, [q]);

  const activeSection = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Système</div>
        <h1 className="text-3xl font-black">Paramètres</h1>
      </header>

      <div className="grid lg:grid-cols-12 gap-4">
        {/* Sous-menu */}
        <aside className="lg:col-span-3">
          <div className="ad-card p-2 space-y-1 sticky top-24">
            <div className="relative px-2 pb-2">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
              <input
                className="ad-input ad-input-icon pl-8"
                placeholder="Rechercher…"
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
                  <span>{s.label}</span>
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
              {activeSection.tabs.map((t) => {
                const on = tab === t.id;
                const hl = q.trim() && matching.tabs.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`ad-btn ${on ? 'ad-btn-primary' : 'ad-btn-ghost'} ${hl && !on ? '!border-[var(--ad-accent)]' : ''}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {q.trim() && matching.tabs.size === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--ad-muted)' }}>Aucun paramètre ne correspond à « {q} ».</p>
            )}
          </div>

          {tab === 'general' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">Général</h2>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Langue d’origine</span>
                <select className="ad-select" value={settings.defaultLocale} onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value as AdminSettings['defaultLocale'] })}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Message de réapprovisionnement</span>
                <textarea className="ad-textarea" value={settings.restockMessage || ''} onChange={(e) => setSettings({ ...settings, restockMessage: e.target.value })} />
                <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>Affiché au client si le stock est dépassé et que le produit n’est pas en « stock final ». Variables : {'{{date_reapprovisionnement}}'}, {'{{produit}}'}.</p>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Crop front largeur</span>
                  <input className="ad-input" type="number" value={settings.cropWidth} onChange={(e) => setSettings({ ...settings, cropWidth: Number(e.target.value) })} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Crop front hauteur</span>
                  <input className="ad-input" type="number" value={settings.cropHeight} onChange={(e) => setSettings({ ...settings, cropHeight: Number(e.target.value) })} />
                </label>
              </div>
            </section>
          )}

          {tab === 'codes' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">Format des codes</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                Jetons disponibles : <code>{'{ID}'}</code> = identifiant sur 5 chiffres · <code>{'{XX}'}</code> = année sur 2 chiffres.
              </p>
              {(['quote', 'order', 'invoice', 'product'] as CodeKind[]).map((kind) => (
                <label key={kind} className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--ad-muted)' }}>
                    {({ quote: 'Devis', order: 'Commande', invoice: 'Facture', product: 'Produit' })[kind]}
                    <span className="ad-chip ad-chip-acc">{previewCode(kind, settings.codes[kind])}</span>
                  </span>
                  <input className="ad-input font-mono" value={settings.codes[kind]} onChange={(e) => setCodes({ [kind]: e.target.value } as Partial<AdminSettings['codes']>)} />
                </label>
              ))}
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setCodes({ ...DEFAULT_TEMPLATES })}>
                Rétablir les formats par défaut
              </button>
            </section>
          )}

          {tab === 'quotes' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">Devis &amp; commandes</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Limite de lignes (0 = illimitée)</span>
                  <input className="ad-input" type="number" min={0} value={settings.quote.maxLines} onChange={(e) => setQuote({ maxLines: Number(e.target.value) || 0 })} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Validité d'un devis (jours)</span>
                  <input className="ad-input" type="number" min={1} value={settings.quote.validityDays} onChange={(e) => setQuote({ validityDays: Number(e.target.value) || 30 })} />
                </label>
              </div>
              <ToggleRow
                label="Transformer automatiquement en commande"
                hint="Quand un devis passe au statut « Accepté », crée automatiquement la commande liée."
                on={settings.quote.autoTransformToOrder}
                onToggle={() => setQuote({ autoTransformToOrder: !settings.quote.autoTransformToOrder })}
              />
              <ToggleRow
                label="Pièce jointe obligatoire (hors-catalogue)"
                hint="Exige une pièce jointe sur les lignes hors-catalogue lors de la demande de devis côté client."
                on={settings.quote.requireAttachment}
                onToggle={() => setQuote({ requireAttachment: !settings.quote.requireAttachment })}
              />
            </section>
          )}

          {tab === 'invoicing' && <InvoicingSection settings={settings} setErp={setErp} setInvoicing={setInvoicing} />}

          {tab === 'security' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">Sécurité &amp; accès</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Activez la double authentification pour l’admin, et les CAPTCHA image pour l’admin et la vitrine.</p>
              <ToggleRow
                label="Exiger la 2FA pour l’Admin"
                hint="Activez d’abord la 2FA de votre compte dans Profil (scan du QR code), puis ce réglage exige la double authentification à la connexion."
                on={settings.security.admin2fa}
                onToggle={() => setSettings({ ...settings, security: { ...settings.security, admin2fa: !settings.security.admin2fa } })}
              />
              <ToggleRow
                label="CAPTCHA image — Admin"
                hint="Affiche un CAPTCHA image sur la page de connexion admin."
                on={settings.security.adminCaptcha}
                onToggle={() => setSettings({ ...settings, security: { ...settings.security, adminCaptcha: !settings.security.adminCaptcha } })}
              />
              <ToggleRow
                label="CAPTCHA image — Vitrine"
                hint="Affiche un CAPTCHA image sur les formulaires du site (contact, inscription…)."
                on={settings.security.siteCaptcha}
                onToggle={() => setSettings({ ...settings, security: { ...settings.security, siteCaptcha: !settings.security.siteCaptcha } })}
              />
              <ToggleRow
                label="Connexion requise pour postuler"
                hint="Règle par défaut : si une offre est en mode « selon la configuration globale », ce réglage détermine si le candidat doit être connecté pour postuler."
                on={settings.requireAuthToApply}
                onToggle={() => setSettings({ ...settings, requireAuthToApply: !settings.requireAuthToApply })}
              />
            </section>
          )}

          {tab === 'smtp' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">SMTP avancé</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Ces valeurs alimentent le connecteur mail du backend. Laissez « Hôte » vide pour le mode fichier (outbox).</p>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Hôte" value={settings.smtp.host} onChange={(v) => setSmtp({ host: v })} />
                <Field label="Port" value={String(settings.smtp.port)} onChange={(v) => setSmtp({ port: Number(v) || 587 })} />
                <Field label="Utilisateur" value={settings.smtp.user} onChange={(v) => setSmtp({ user: v })} />
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Mot de passe</span>
                  <input className="ad-input" type="password" value={settings.smtp.pass} onChange={(e) => setSmtp({ pass: e.target.value })} />
                </label>
                <Field label="Expéditeur" value={settings.smtp.from} onChange={(v) => setSmtp({ from: v })} />
                <Field label="Reply-To" value={settings.smtp.replyTo} onChange={(v) => setSmtp({ replyTo: v })} />
              </div>
              <button type="button" className={`ad-btn ${settings.smtp.secure ? 'ad-btn-lime' : 'ad-btn-ghost'}`} onClick={() => setSmtp({ secure: !settings.smtp.secure })}>
                TLS/SSL : {settings.smtp.secure ? 'activé' : 'désactivé'}
              </button>
            </section>
          )}

          {tab === 'seo' && <SeoSection />}

          {tab === 'database' && (
            <section className="ad-card p-5 space-y-4">
              <h2 className="ad-section-title">Base de données</h2>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Driver</span>
                <select className="ad-select" value={settings.db.driver} onChange={(e) => setDb({ driver: e.target.value as AdminSettings['db']['driver'] })}>
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="json">JSON local</option>
                </select>
              </label>
              <Field label="URL de connexion" value={settings.db.url} onChange={(v) => setDb({ url: v })} />
              <Field label="Schéma" value={settings.db.schema} onChange={(v) => setDb({ schema: v })} />
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Le backend Nest utilise DATABASE_URL / DB_DRIVER. Ces champs documentent la cible et préparent le switch multi-driver.</p>
            </section>
          )}

          <button className="ad-btn ad-btn-primary" onClick={() => { saveAdminSettings(settings); showToast('Paramètres enregistrés', 'success'); }}>
            <Save className="w-4 h-4" /> Enregistrer
          </button>
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
  const { showToast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  return (
    <section className="ad-card p-5 space-y-4">
      <h2 className="ad-section-title">Facturation &amp; ERP externe</h2>
      <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
        Les factures de vente sont générées dans un ERP externe. Elles peuvent être récupérées automatiquement par API ou uploadées manuellement sur une commande confirmée et payée.
      </p>

      <ToggleRow
        label="ERP externe activé"
        hint="Autorise la liaison automatique des factures via l'API de l'ERP."
        on={settings.erp.enabled}
        onToggle={() => setErp({ enabled: !settings.erp.enabled })}
      />
      <Field label="URL de base de l'API ERP" value={settings.erp.apiUrl} onChange={(v) => setErp({ apiUrl: v })} />
      <label className="space-y-1.5 block">
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Clé d'API</span>
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
          setTestResult(res.message);
          setTesting(false);
          showToast(res.message, res.ok ? 'success' : 'error');
        }}
      >
        {testing ? 'Test…' : 'Tester la connexion ERP'}
      </button>
      {testResult && <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{testResult}</p>}

      <div className="pt-2" style={{ borderTop: '1px solid var(--ad-line)' }}>
        <ToggleRow
          label="Exiger une commande payée pour lier une facture"
          hint="Bloque la liaison de facture tant que la commande n'est pas confirmée et payée."
          on={settings.invoicing.requirePaidToInvoice}
          onToggle={() => setInvoicing({ requirePaidToInvoice: !settings.invoicing.requirePaidToInvoice })}
        />
        <ToggleRow
          label="Récupération auto de la facture"
          hint="Tente automatiquement de récupérer la facture via l'ERP dès qu'une commande est payée."
          on={settings.invoicing.autoFetchInvoice}
          onToggle={() => setInvoicing({ autoFetchInvoice: !settings.invoicing.autoFetchInvoice })}
        />
      </div>
    </section>
  );
}

function SeoSection() {
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
      <h2 className="ad-section-title">SEO vitrine</h2>
      <div className="flex gap-2">
        {['fr', 'en', 'ar'].map((loc) => (
          <button key={loc} type="button" className={`ad-btn ${locale === loc ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setLocale(loc)}>{loc.toUpperCase()}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Titre" value={seo.title} onChange={(v) => setSeo({ ...seo, title: v })} />
        <Field label="Modèle de titre" value={seo.titleTemplate} onChange={(v) => setSeo({ ...seo, titleTemplate: v })} />
        <label className="md:col-span-2 space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Description</span>
          <textarea className="ad-textarea" value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })} />
        </label>
        <Field label="Mots-clés" value={seo.keywords} onChange={(v) => setSeo({ ...seo, keywords: v })} />
        <Field label="Robots" value={seo.robots} onChange={(v) => setSeo({ ...seo, robots: v })} />
        <Field label="Titre Open Graph" value={seo.ogTitle} onChange={(v) => setSeo({ ...seo, ogTitle: v })} />
        <Field label="Description Open Graph" value={seo.ogDescription} onChange={(v) => setSeo({ ...seo, ogDescription: v })} />
        <Field label="Image OG / partage" value={seo.ogImage} onChange={(v) => setSeo({ ...seo, ogImage: v })} />
        <Field label="Twitter / X" value={seo.twitter} onChange={(v) => setSeo({ ...seo, twitter: v })} />
        <Field label="URL canonique" value={seo.canonical} onChange={(v) => setSeo({ ...seo, canonical: v })} />
        <Field label="Favicon" value={seo.favicon} onChange={(v) => setSeo({ ...seo, favicon: v })} />
        <Field label="Google Search Console" value={seo.googleSiteVerification} onChange={(v) => setSeo({ ...seo, googleSiteVerification: v })} />
      </div>
      <button type="button" className="ad-btn ad-btn-primary" onClick={async () => {
        await fetch('/api/admin/seo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, seo }) });
        showToast('Métadonnées SEO enregistrées', 'success');
      }}>Enregistrer le SEO {locale.toUpperCase()}</button>
    </section>
  );
}

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--ad-line)' }}>
      <div className="space-y-0.5">
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{hint}</div>}
      </div>
      <button type="button" onClick={onToggle} className={`ad-toggle ${on ? 'is-on' : ''}`} aria-pressed={on} role="switch">
        {on ? (
          <>
            <span className="ad-toggle-label">Activé</span>
            <span className="ad-toggle-knob" />
          </>
        ) : (
          <>
            <span className="ad-toggle-knob" />
            <span className="ad-toggle-label">Désactivé</span>
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
