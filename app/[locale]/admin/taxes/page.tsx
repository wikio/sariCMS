'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { loadTaxes, saveTaxes, type TaxRule } from '@/lib/shop-store';
import { useToast } from '@/components/admin/Toast';

const empty = (): TaxRule => ({ id: `t-${Date.now()}`, name: '', mode: 'percent', rate: 19, zone: 'DZ', included: false, priority: 1, active: true });

export default function TaxesPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TaxRule[]>([]);
  const [draft, setDraft] = useState<TaxRule | null>(null);
  useEffect(() => { setRows(loadTaxes()); }, []);
  const persist = (next: TaxRule[]) => { setRows(next); saveTaxes(next); showToast('Taxe enregistrée', 'success'); setDraft(null); };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Taxes</div>
          <h1 className="text-3xl font-black">Taxes</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => setDraft(empty())}><Plus className="w-4 h-4" /> Nouvelle taxe</button>
      </header>
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th>Nom</th><th>Taux</th><th>Zone</th><th>Catégorie</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="font-bold">{t.name}</td>
                <td>{t.mode === 'percent' ? `${t.rate} %` : `${t.rate} DA`}</td>
                <td>{t.zone}</td>
                <td>{t.category || 'Toutes'}</td>
                <td><span className={`ad-chip ${t.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{t.active ? 'Active' : 'Inactive'}</span></td>
                <td className="text-right">
                  <button className="ad-btn ad-btn-ghost" onClick={() => setDraft({ ...t })}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => persist(rows.filter((x) => x.id !== t.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <div className="ad-drawer" onClick={() => setDraft(null)}>
          <div className="ad-drawer-panel space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black">Règle de taxe</h3>
            <input className="ad-input" placeholder="Nom (TVA…)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="ad-select" value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as TaxRule['mode'] })}>
              <option value="percent">Pourcentage</option>
              <option value="fixed">Montant fixe</option>
            </select>
            <input className="ad-input" type="number" placeholder="Taux / montant" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })} />
            <input className="ad-input" placeholder="Zone (DZ, Alger…)" value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })} />
            <input className="ad-input" placeholder="Catégorie produit (optionnel)" value={draft.category || ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <input className="ad-input" type="number" placeholder="Priorité" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
            <button className={`ad-btn ${draft.included ? 'ad-btn-lime' : 'ad-btn-ghost'}`} onClick={() => setDraft({ ...draft, included: !draft.included })}>Incluse dans le prix : {draft.included ? 'oui' : 'non'}</button>
            <button className={`ad-btn ${draft.active ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setDraft({ ...draft, active: !draft.active })}>{draft.active ? 'Active' : 'Inactive'}</button>
            <div className="flex gap-2">
              <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
              <button className="ad-btn ad-btn-primary" onClick={() => persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows])}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
