'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { loadPayments, savePayments, type PaymentMethod, type PaymentType } from '@/lib/shop-store';
import { useToast } from '@/components/admin/Toast';

const TYPES: Array<{ value: PaymentType; label: string }> = [
  { value: 'card-intl', label: 'Carte internationale' },
  { value: 'cib', label: 'Carte CIB' },
  { value: 'transfer', label: 'Virement' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'check', label: 'Chèque' },
  { value: 'cod', label: 'Paiement à la livraison' },
  { value: 'other', label: 'Autre' },
];

const empty = (): PaymentMethod => ({ id: `p-${Date.now()}`, name: '', type: 'transfer', active: true, fees: 0, instructions: '' });

export default function PaymentsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<PaymentMethod[]>([]);
  const [draft, setDraft] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setRows(loadPayments()); }, []);

  const persist = (next: PaymentMethod[]) => {
    setRows(next);
    savePayments(next);
    showToast('Modes de paiement enregistrés', 'success');
    setDraft(null);
  };

  const validate = (row: PaymentMethod) => {
    if (!row.name.trim()) return 'Nom obligatoire';
    if (row.type === 'transfer' && row.iban && !/^([A-Z]{2}\d{2}[A-Z0-9 ]{10,})$/i.test(row.iban.replace(/\s/g, ''))) return 'IBAN invalide';
    if (row.type === 'paypal' && row.paypalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.paypalEmail)) return 'E-mail PayPal invalide';
    return '';
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Paiements</div>
          <h1 className="text-3xl font-black">Modes de paiement</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => setDraft(empty())}><Plus className="w-4 h-4" /> Ajouter</button>
      </header>
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th>Nom</th><th>Type</th><th>Frais</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-bold">{r.name}</td>
                <td>{TYPES.find((t) => t.value === r.type)?.label}</td>
                <td>{r.fees}{r.type === 'cod' ? ' DA' : ' %'}</td>
                <td><span className={`ad-chip ${r.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{r.active ? 'Actif' : 'Inactif'}</span></td>
                <td className="text-right">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setError(''); setDraft({ ...r }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => persist(rows.filter((x) => x.id !== r.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <div className="ad-drawer" onClick={() => setDraft(null)}>
          <div className="ad-drawer-panel space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black">Configurer le paiement</h3>
            <input className="ad-input" placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="ad-select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PaymentType })}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="ad-input" type="number" placeholder="Frais" value={draft.fees} onChange={(e) => setDraft({ ...draft, fees: Number(e.target.value) })} />
            <textarea className="ad-textarea" placeholder="Instructions" value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            {draft.type === 'transfer' && (
              <>
                <input className="ad-input" placeholder="IBAN" value={draft.iban || ''} onChange={(e) => setDraft({ ...draft, iban: e.target.value.toUpperCase() })} />
                <input className="ad-input" placeholder="RIB" value={draft.rib || ''} onChange={(e) => setDraft({ ...draft, rib: e.target.value })} />
              </>
            )}
            {draft.type === 'paypal' && <input className="ad-input" placeholder="E-mail PayPal" value={draft.paypalEmail || ''} onChange={(e) => setDraft({ ...draft, paypalEmail: e.target.value })} />}
            {(draft.type === 'card-intl' || draft.type === 'cib') && <input className="ad-input" placeholder="Clé API" value={draft.apiKey || ''} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />}
            <button type="button" className={`ad-btn ${draft.active ? 'ad-btn-lime' : 'ad-btn-ghost'}`} onClick={() => setDraft({ ...draft, active: !draft.active })}>{draft.active ? 'Actif' : 'Inactif'}</button>
            {error && <p className="text-sm" style={{ color: 'var(--ad-danger)' }}>{error}</p>}
            <div className="flex gap-2">
              <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
              <button className="ad-btn ad-btn-primary" onClick={() => {
                const err = validate(draft);
                if (err) { setError(err); return; }
                persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
              }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
