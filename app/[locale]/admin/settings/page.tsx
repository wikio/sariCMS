'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { DEFAULT_SETTINGS, loadAdminSettings, saveAdminSettings, type AdminSettings } from '@/lib/admin-settings';
import { useToast } from '@/components/admin/Toast';

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  useEffect(() => { setSettings(loadAdminSettings()); }, []);

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Système</div>
        <h1 className="text-3xl font-black">Paramètres</h1>
      </header>
      <section className="ad-card p-5 space-y-4 max-w-2xl">
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Langue par défaut</span>
          <select className="ad-select" value={settings.defaultLocale} onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value as AdminSettings['defaultLocale'] })}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Format code produit</span>
          <input className="ad-input" value={settings.skuFormat} onChange={(e) => setSettings({ ...settings, skuFormat: e.target.value })} placeholder="PRO-{ID}" />
          <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{'{ID}'} = numéro sur 5 chiffres. Exemple : PRO-00042</p>
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
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Le recadrage s’applique uniquement à l’affichage vitrine. Le fichier GED reste intact.</p>
        <button className="ad-btn ad-btn-primary" onClick={() => { saveAdminSettings(settings); showToast('Paramètres enregistrés', 'success'); }}>
          <Save className="w-4 h-4" /> Enregistrer
        </button>
      </section>
    </div>
  );
}
