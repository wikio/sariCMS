'use client';

import { useEffect, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { couponStatus, generateCouponCode, loadCoupons, saveCoupons, type Coupon } from '@/lib/shop-store';
import { useToast } from '@/components/admin/Toast';

const empty = (): Coupon => ({
  id: `c-${Date.now()}`, code: generateCouponCode(), type: 'percent', amount: 10,
  start: new Date().toISOString().slice(0, 10), end: '', used: 0, scope: 'all', scopeValues: [],
  stackable: false, active: true, revenue: 0,
});

export default function CouponsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [draft, setDraft] = useState<Coupon | null>(null);

  useEffect(() => { setRows(loadCoupons()); }, []);
  const persist = (next: Coupon[]) => { setRows(next); saveCoupons(next); showToast('Coupon enregistré', 'success'); setDraft(null); };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Coupons</div>
          <h1 className="text-3xl font-black">Coupons / codes promo</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => setDraft(empty())}><Plus className="w-4 h-4" /> Nouveau</button>
      </header>
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th>Code</th><th>Réduction</th><th>Usages</th><th>CA</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const st = couponStatus(c);
              return (
                <tr key={c.id}>
                  <td className="font-mono font-bold">{c.code}</td>
                  <td>{c.type === 'percent' ? `${c.amount} %` : `${c.amount} DA`}</td>
                  <td>{c.used}/{c.limitGlobal || '∞'}</td>
                  <td>{c.revenue.toLocaleString()} DA</td>
                  <td><span className={`ad-chip ${st === 'actif' ? 'ad-chip-ok' : st === 'à venir' ? 'ad-chip-warn' : 'ad-chip-mute'}`}>{st}</span></td>
                  <td className="text-right">
                    <button className="ad-btn ad-btn-ghost" onClick={() => setDraft({ ...c })}><Pencil className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => persist([{ ...c, id: `c-${Date.now()}`, code: generateCouponCode(), used: 0 }, ...rows])}><Copy className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== c.id))}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {draft && (
        <div className="ad-drawer" onClick={() => setDraft(null)}>
          <div className="ad-drawer-panel space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black">Coupon</h3>
            <div className="flex gap-2">
              <input className="ad-input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
              <button className="ad-btn ad-btn-ghost" onClick={() => setDraft({ ...draft, code: generateCouponCode() })}>Auto</button>
            </div>
            <select className="ad-select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Coupon['type'] })}>
              <option value="percent">Pourcentage</option>
              <option value="fixed">Montant fixe</option>
            </select>
            <input className="ad-input" type="number" placeholder="Valeur" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
            <input className="ad-input" type="number" placeholder="Plafond (si %)" value={draft.maxDiscount || ''} onChange={(e) => setDraft({ ...draft, maxDiscount: Number(e.target.value) })} />
            <input className="ad-input" type="number" placeholder="Minimum de commande" value={draft.minOrder || ''} onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="ad-input" type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <input className="ad-input" type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </div>
            <input className="ad-input" type="number" placeholder="Limite globale" value={draft.limitGlobal || ''} onChange={(e) => setDraft({ ...draft, limitGlobal: Number(e.target.value) })} />
            <input className="ad-input" type="number" placeholder="Limite / client" value={draft.limitPerClient || ''} onChange={(e) => setDraft({ ...draft, limitPerClient: Number(e.target.value) })} />
            <select className="ad-select" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Coupon['scope'] })}>
              <option value="all">Tous les produits</option>
              <option value="category">Catégories</option>
              <option value="product">Produits</option>
            </select>
            <input className="ad-input" placeholder="Cibles (séparées par virgule)" value={draft.scopeValues.join(', ')} onChange={(e) => setDraft({ ...draft, scopeValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            <button className={`ad-btn ${draft.stackable ? 'ad-btn-lime' : 'ad-btn-ghost'}`} onClick={() => setDraft({ ...draft, stackable: !draft.stackable })}>Cumulable : {draft.stackable ? 'oui' : 'non'}</button>
            <button className={`ad-btn ${draft.active ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setDraft({ ...draft, active: !draft.active })}>{draft.active ? 'Actif' : 'Inactif'}</button>
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
