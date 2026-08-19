'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { DEFAULT_SETTINGS, loadAdminSettings, saveAdminSettings, type AdminSettings } from '@/lib/admin-settings';
import { useToast } from '@/components/admin/Toast';

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  useEffect(() => { setSettings(loadAdminSettings()); }, []);

  const setSmtp = (patch: Partial<AdminSettings['smtp']>) => setSettings({ ...settings, smtp: { ...settings.smtp, ...patch } });
  const setDb = (patch: Partial<AdminSettings['db']>) => setSettings({ ...settings, db: { ...settings.db, ...patch } });

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Système</div>
        <h1 className="text-3xl font-black">Paramètres</h1>
      </header>

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

      <section className="ad-card p-5 space-y-4">
        <h2 className="ad-section-title">SMTP avancé</h2>
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
        <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Ces valeurs sont stockées pour le connecteur mail. Le backend lit SMTP_* au prochain déploiement.</p>
      </section>

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

      <button className="ad-btn ad-btn-primary" onClick={() => { saveAdminSettings(settings); showToast('Paramètres enregistrés', 'success'); }}>
        <Save className="w-4 h-4" /> Enregistrer
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
