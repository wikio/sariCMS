'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Search } from 'lucide-react';
import { DEFAULT_SETTINGS, loadAdminSettings, saveAdminSettings, type AdminSettings } from '@/lib/admin-settings';
import { useToast } from '@/components/admin/Toast';

type TabId = 'general' | 'security' | 'quotes' | 'smtp' | 'seo' | 'database';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'general', label: 'Général' },
  { id: 'security', label: 'Sécurité' },
  { id: 'quotes', label: 'Devis' },
  { id: 'smtp', label: 'SMTP' },
  { id: 'seo', label: 'SEO' },
  { id: 'database', label: 'Base de données' },
];

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<TabId>('general');
  const [q, setQ] = useState('');

  useEffect(() => { setSettings(loadAdminSettings()); }, []);

  const setSmtp = (patch: Partial<AdminSettings['smtp']>) => setSettings({ ...settings, smtp: { ...settings.smtp, ...patch } });
  const setDb = (patch: Partial<AdminSettings['db']>) => setSettings({ ...settings, db: { ...settings.db, ...patch } });
  const setQuote = (patch: Partial<AdminSettings['quote']>) => setSettings({ ...settings, quote: { ...settings.quote, ...patch } });

  // Recherche globale : met en évidence les onglets contenant un terme.
  const matchingTabs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return TABS;
    const labels: Record<TabId, string> = {
      general: 'langue format code produit réapprovisionnement crop largeur hauteur',
      security: '2fa captcha connexion postuler double authentification sécurité accès',
      quotes: 'devis ligne validité commande pièce jointe transformer expiration',
      smtp: 'smtp hôte port utilisateur mot de passe expéditeur tls ssl email',
      seo: 'seo titre description mots-clés open graph twitter favicon canonical robots',
      database: 'base de données driver mysql postgresql mongodb json url schéma',
    };
    return TABS.filter((t) => labels[t.id].includes(needle));
  }, [q]);

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Système</div>
        <h1 className="text-3xl font-black">Paramètres</h1>
      </header>

      <div className="ad-card p-3 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
          <input
            className="ad-input ad-input-icon pl-9"
            placeholder="Rechercher un paramètre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const highlight = q.trim() && matchingTabs.some((m) => m.id === t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); }}
                className={`ad-btn ${tab === t.id ? 'ad-btn-primary' : 'ad-btn-ghost'} ${highlight && tab !== t.id ? '!border-[var(--ad-accent)]' : ''}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {q.trim() && matchingTabs.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Aucun paramètre ne correspond à « {q} ».</p>
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
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Format code produit</span>
            <input className="ad-input" value={settings.skuFormat} onChange={(e) => setSettings({ ...settings, skuFormat: e.target.value })} placeholder="PRO-{ID}" />
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

      {tab === 'quotes' && (
        <section className="ad-card p-5 space-y-4">
          <h2 className="ad-section-title">Devis &amp; demandes</h2>
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
            hint="Quand un devis passe au statut « Accepté », crée automatiquement la commande liée (statut « Transformé en commande »)."
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

      {tab === 'smtp' && (
        <section className="ad-card p-5 space-y-4">
          <h2 className="ad-section-title">SMTP avancé</h2>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Ces valeurs alimentent le connecteur mail du backend (envoi des notifications depuis le CMS). Laissez « Hôte » vide pour le mode fichier (outbox).</p>
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
