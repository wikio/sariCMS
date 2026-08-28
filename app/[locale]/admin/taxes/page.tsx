'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { loadTaxes, saveTaxes, taxCompletion, type TaxRule } from '@/lib/shop-store';
import { listTaxonomy } from '@/lib/taxonomies';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import TagInput from '@/components/admin/TagInput';
import SearchField from '@/components/admin/SearchField';
import { useTranslations } from 'next-intl';

const empty = (): TaxRule => ({
  id: `t-${Date.now()}`, name: '', names: { fr: '', en: '', ar: '' }, labels: { fr: '', en: '', ar: '' },
  mode: 'percent', rate: 19, zone: 'DZ', scope: 'all', scopeValues: [], included: false, priority: 1, active: true,
});

export default function TaxesPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.taxes');
  const [rows, setRows] = useState<TaxRule[]>([]);
  const [draft, setDraft] = useState<TaxRule | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [lang, setLang] = useState('fr');
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('');
  const [active, setActive] = useState('');
  const [included, setIncluded] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const cats = listTaxonomy('products.category').map((t) => t.label);

  useEffect(() => { setRows(loadTaxes()); }, []);
  const persist = (next: TaxRule[], toast = 'Taxe enregistrée') => {
    setRows(next); saveTaxes(next); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };

  const shown = useMemo(() => rows.filter((t) => {
    if (zone && t.zone !== zone) return false;
    if (active && String(t.active) !== active) return false;
    if (included && String(t.included) !== included) return false;
    if (q && !`${t.name} ${t.zone} ${(t.scopeValues || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.priority - b.priority), [rows, q, zone, active, included]);

  const setI18n = (key: 'names' | 'labels', value: string) => {
    if (!draft) return;
    const bag = { ...(draft[key] || {}), [lang]: value };
    setDraft({ ...draft, [key]: bag, name: key === 'names' && lang === 'fr' ? value : draft.name });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Taxes</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" /> Nouvelle taxe</button>
      </header>
      <div className="ad-card p-3 space-y-3">
        <SearchField value={q} onChange={setQ} onSubmit={() => undefined} showSubmit placeholder={t("searchPlaceholder")} />
        <div className="grid sm:grid-cols-3 gap-2">
        <input className="ad-input" placeholder="Zone" value={zone} onChange={(e) => setZone(e.target.value)} />
        <select className="ad-select" value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="">Actif / inactif</option>
          <option value="true">{t("activeTax")}</option>
          <option value="false">{t("inactiveTax")}</option>
        </select>
        <select className="ad-select" value={included} onChange={(e) => setIncluded(e.target.value)}>
          <option value="">Incluse / ajoutée</option>
          <option value="true">{t("included")}</option>
          <option value="false">{t("added")}</option>
        </select>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r), 'Activées')}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r), 'Désactivées')}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)), 'Supprimées')}>Supprimer</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>{t("name", { defaultMessage: "Nom" })}</th><th>{t("rate")}</th><th>{t("zone")}</th><th>{t("target")}</th><th>i18n</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id}>
                <td><input type="checkbox" checked={selected.includes(t.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id))} /></td>
                <td className="font-bold">{t.name}</td>
                <td>{t.mode === 'percent' ? `${t.rate} %` : `${t.rate} DA`}</td>
                <td>{t.zone}</td>
                <td>{t.scope === 'all' ? 'Tous' : (t.scopeValues || []).join(', ') || t.category || '—'}</td>
                <td><span className="ad-chip ad-chip-acc">{taxCompletion(t)}%</span></td>
                <td><span className={`ad-chip ${t.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{t.active ? 'Active' : 'Inactive'}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...t }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setDraft({ ...t }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== t.id), 'Supprimée')}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.name}` : draft?.name || 'Nouvelle taxe'}
        onClose={() => setDraft(null)}
        width={560}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft?.name.trim()) return;
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <div className="flex gap-2">
              {['fr', 'en', 'ar'].map((l) => (
                <button key={l} type="button" className={`ad-btn ${lang === l ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setLang(l)}>
                  {l.toUpperCase()} <span className="ad-chip ad-chip-acc">{(draft.names?.[l] || (l === 'fr' ? draft.name : '')) ? 'ok' : '—'}</span>
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Nom ({lang.toUpperCase()})</span>
              <input className="ad-input" disabled={mode === 'consult'} value={draft.names?.[lang] || (lang === 'fr' ? draft.name : '')} onChange={(e) => setI18n('names', e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Libellé facture ({lang.toUpperCase()})</span>
              <input className="ad-input" disabled={mode === 'consult'} value={draft.labels?.[lang] || ''} onChange={(e) => setI18n('labels', e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select className="ad-select" disabled={mode === 'consult'} value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as TaxRule['mode'] })}>
                <option value="percent">Pourcentage</option>
                <option value="fixed">Montant fixe</option>
              </select>
              <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })} />
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("zone")}</span>
              <input className="ad-input" disabled={mode === 'consult'} placeholder="DZ, Alger, Oran…" value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })} />
              <p className="ad-field-hint">Pays / région / ville d’application. Plusieurs règles peuvent coexister.</p>
            </label>
            <select className="ad-select" disabled={mode === 'consult'} value={draft.scope || 'all'} onChange={(e) => setDraft({ ...draft, scope: e.target.value as TaxRule['scope'], scopeValues: [] })}>
              <option value="all">Tous les produits</option>
              <option value="category">Catégories spécifiques</option>
              <option value="product">Produits spécifiques</option>
            </select>
            {draft.scope && draft.scope !== 'all' && (
              <TagInput values={draft.scopeValues || []} onChange={(scopeValues) => setDraft({ ...draft, scopeValues })} suggestions={cats} />
            )}
            <input className="ad-input" type="number" disabled={mode === 'consult'} placeholder="Priorité" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="ad-input" type="date" disabled={mode === 'consult'} value={draft.start || ''} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <input className="ad-input" type="date" disabled={mode === 'consult'} value={draft.end || ''} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </div>
            <Toggle on={draft.included} onChange={(v) => setDraft({ ...draft, included: v })} label="Incluse dans le prix" hint="Si activé, le prix affiché au client comprend déjà cette taxe." disabled={mode === 'consult'} />
            <Toggle on={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Active" hint="Seules les taxes actives s’appliquent aux commandes et devis." disabled={mode === 'consult'} />
          </>
        )}
      </Drawer>
    </div>
  );
}
