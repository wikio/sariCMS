'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, LayoutGrid, List as ListIcon, Search, Trash2 } from 'lucide-react';
import { loadOrders, loadQuotes, saveOrders, saveQuotes, type Order, type Quote } from '@/lib/crm-store';
import { useToast } from '@/components/admin/Toast';

type Kind = 'orders' | 'quotes';

const ORDER_STATUS = [
  { value: 'pending', label: 'En attente' },
  { value: 'processing', label: 'En cours' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];

const QUOTE_STATUS = [
  { value: 'pending', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyé' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'rejected', label: 'Refusé' },
  { value: 'expired', label: 'Expiré' },
];

export default function CommerceDesk({ kind }: { kind: Kind }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Array<Order | Quote>>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [open, setOpen] = useState<Order | Quote | null>(null);
  const statuses = kind === 'orders' ? ORDER_STATUS : QUOTE_STATUS;
  const title = kind === 'orders' ? 'Commandes' : 'Devis';

  useEffect(() => {
    setRows(kind === 'orders' ? loadOrders() : loadQuotes());
  }, [kind]);

  const persist = (next: Array<Order | Quote>) => {
    setRows(next);
    if (kind === 'orders') saveOrders(next as Order[]);
    else saveQuotes(next as Quote[]);
    showToast(`${title} mises à jour`, 'success');
  };

  const shown = useMemo(() => rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (!q.trim()) return true;
    return `${r.client} ${r.email} ${r.id}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, q, status]);

  const stats = {
    total: rows.length,
    amount: rows.reduce((s, r) => s + Number(r.total || 0), 0),
    pending: rows.filter((r) => r.status === 'pending' || r.status === 'sent' || r.status === 'processing').length,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Boutique</div>
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        </div>
        <div className="flex" style={{ border: '1px solid var(--ad-line)' }}>
          <button type="button" className={`ad-btn ad-btn-icon ${view === 'list' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('list')}><ListIcon className="w-4 h-4" /></button>
          <button type="button" className={`ad-btn ad-btn-icon ${view === 'cards' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('cards')}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          [stats.total, title],
          [`${stats.amount.toLocaleString()} DA`, 'Montant'],
          [stats.pending, 'En cours'],
        ].map(([v, l]) => (
          <div key={String(l)} className="ad-card p-4">
            <div className="text-2xl font-black tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="ad-card p-3 flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
          <input className="ad-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, email, n°…" />
        </div>
        <select className="ad-select lg:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {view === 'list' ? (
        <div className="ad-card overflow-hidden">
          <table className="ad-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-sm">#{row.id}</td>
                  <td>
                    <div className="font-bold">{row.client}</div>
                    <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{row.email}</div>
                  </td>
                  <td>{row.date}</td>
                  <td className="font-black">{Number(row.total).toLocaleString()} DA</td>
                  <td>
                    <select
                      className="ad-select"
                      value={row.status}
                      onChange={(e) => persist(rows.map((r) => r.id === row.id ? { ...r, status: e.target.value } as Order : r))}
                    >
                      {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="text-right">
                    <button className="ad-btn ad-btn-ghost" onClick={() => setOpen(row)}><Eye className="w-4 h-4" /> Voir</button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => persist(rows.filter((r) => r.id !== row.id))}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>Aucun élément</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((row) => (
            <article key={row.id} className="ad-card p-4 space-y-2">
              <div className="flex justify-between">
                <span className="font-mono text-xs">#{row.id}</span>
                <span className="ad-chip ad-chip-acc">{row.status}</span>
              </div>
              <h3 className="font-black">{row.client}</h3>
              <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{row.date} · {row.items?.length || 0} article(s)</p>
              <div className="font-black" style={{ color: 'var(--ad-accent)' }}>{Number(row.total).toLocaleString()} DA</div>
              <button className="ad-btn ad-btn-ghost w-full" onClick={() => setOpen(row)}>Détail</button>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="ad-modal" onClick={() => setOpen(null)}>
          <div className="ad-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black">{title} #{open.id}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span style={{ color: 'var(--ad-muted)' }}>Client</span><div className="font-bold">{open.client}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Email</span><div className="font-bold">{open.email}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Date</span><div className="font-bold">{open.date}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Total</span><div className="font-black" style={{ color: 'var(--ad-accent)' }}>{Number(open.total).toLocaleString()} DA</div></div>
            </div>
            <div className="space-y-2">
              {(open.items || []).map((it, i) => (
                <div key={i} className="flex justify-between ad-card p-3 text-sm">
                  <div>
                    <div className="font-bold">{it.name}</div>
                    <div style={{ color: 'var(--ad-muted)' }}>{it.quantity} × {it.price.toLocaleString()} DA</div>
                  </div>
                  <div className="font-black">{(it.quantity * it.price).toLocaleString()} DA</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button className="ad-btn ad-btn-ghost" onClick={() => setOpen(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
