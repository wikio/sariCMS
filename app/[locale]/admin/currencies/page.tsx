'use client';

import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { loadCurrencies, saveCurrencies, type Currency } from '@/lib/currencies';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';

const empty = (): Currency => ({ id: `cur-${Date.now()}`, code: '', symbol: '', name: '', rate: 1, active: true });

export default function CurrenciesPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Currency[]>([]);
  const [draft, setDraft] = useState<Currency | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => { setRows(loadCurrencies()); }, []);
  const persist = (next: Currency[], toast = 'Devises enregistrées') => {
    setRows(next); saveCurrencies(next); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">Configuration avancée / Devises</div>
          <h1 className="text-3xl font-black">Devises</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Code, symbole, nom et taux de change par rapport au dinar (DZD = 1).</p>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" /> Ajouter</button>
      </header>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r))}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r))}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)))}>Supprimer</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>Code</th><th>Symbole</th><th>Nom</th><th>Taux / DZD</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} /></td>
                <td className="font-mono font-bold">{c.code}</td>
                <td>{c.symbol}</td>
                <td>{c.name}</td>
                <td>{c.rate}</td>
                <td><span className={`ad-chip ${c.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                <td className="text-right">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...c }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setDraft({ ...c }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== c.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.code}` : 'Devise'}
        onClose={() => setDraft(null)}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft?.code.trim()) return;
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? { ...draft, code: draft.code.toUpperCase() } : r) : [{ ...draft, code: draft.code.toUpperCase() }, ...rows]);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <input className="ad-input font-mono" disabled={mode === 'consult'} placeholder="Code ISO (EUR)" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Symbole (€)" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Taux vers DZD</span>
              <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })} />
              <p className="ad-field-hint">1 unité de cette devise = ce nombre de dinars.</p>
            </label>
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Active" disabled={mode === 'consult'} />
          </>
        )}
      </Drawer>
    </div>
  );
}
