'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Eye, History, LayoutGrid, List as ListIcon, MessageSquareText, Plus, Reply, Trash2 } from 'lucide-react';
import { loadOrders, loadQuotes, saveOrders, saveQuotes, type Order, type Quote, type CommerceItem } from '@/lib/crm-store';
import { loadCoupons, loadTaxes } from '@/lib/shop-store';
import { loadAdminSettings } from '@/lib/admin-settings';
import { computeTotals, money } from '@/lib/commerce-math';
import { useToast } from '@/components/admin/Toast';
import SearchField from '@/components/admin/SearchField';
import Drawer from '@/components/admin/Drawer';
import GeoBadge from '@/components/admin/GeoBadge';
import MessageComposer from '@/components/admin/MessageComposer';
import QuoteResponseComposer from '@/components/admin/QuoteResponseComposer';

type Kind = 'orders' | 'quotes';
type Row = (Order | Quote) & { history?: Array<{ status: string; at: string; note?: string }>; phone?: string; company?: string; coupon?: string; quoteId?: number; orderId?: number; zone?: string; ip?: string; address?: string };

const ORDER_STATUS = [
  { value: 'pending', label: 'En attente' },
  { value: 'processing', label: 'Préparation' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];
const QUOTE_STATUS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'submitted', label: 'Soumis' },
  { value: 'processing', label: 'En cours de traitement' },
  { value: 'replied', label: 'Répondu' },
  { value: 'revision', label: 'Révision demandée' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'rejected', label: 'Refusé' },
  { value: 'transformed', label: 'Transformé en commande' },
  { value: 'expired', label: 'Expiré' },
  { value: 'cancelled', label: 'Annulé' },
];

export default function CommerceDesk({ kind }: { kind: Kind }) {
  const locale = useLocale();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [open, setOpen] = useState<Row | null>(null);
  const [consult, setConsult] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [messageTo, setMessageTo] = useState<Row | null>(null);
  const [respondTo, setRespondTo] = useState<Row | null>(null);
  const statuses = kind === 'orders' ? ORDER_STATUS : QUOTE_STATUS;
  const title = kind === 'orders' ? 'Commandes' : 'Devis';
  const taxes = loadTaxes();
  const coupons = loadCoupons();

  useEffect(() => {
    const loaded = (kind === 'orders' ? loadOrders() : loadQuotes()) as Row[];
    if (kind === 'quotes') {
      // Expiration automatique : les devis encore actifs au-delà de leur validité passent en « Expiré ».
      const settings = loadAdminSettings();
      const today = Date.now();
      const ACTIVE = ['submitted', 'processing', 'replied', 'revision', 'pending', 'sent', 'draft'];
      const expired = loaded.map((r) => {
        const st = String(r.status);
        if (!ACTIVE.includes(st) || !r.date) return r;
        const days = (today - new Date(r.date).getTime()) / 86400000;
        if (days > settings.quote.validityDays) {
          return {
            ...r,
            status: 'expired' as never,
            history: [...(r.history || []), { status: 'expired', at: new Date().toISOString(), note: 'Expiré automatiquement' }],
          };
        }
        return r;
      });
      setRows(expired);
      saveQuotes(expired as Quote[]);
    } else {
      setRows(loaded);
    }
  }, [kind]);

  const persist = (next: Row[]) => {
    setRows(next);
    if (kind === 'orders') saveOrders(next as Order[]);
    else saveQuotes(next as Quote[]);
  };

  const saveOpen = (next: Row) => {
    const totals = computeTotals(next.items || [], taxes, coupons.find((c) => c.code === next.coupon), { zone: next.zone });
    const withTotal = { ...next, total: Math.round(totals.total) };
    persist(rows.map((r) => r.id === next.id ? withTotal : r));
    setOpen(withTotal);
    showToast(`${title} enregistré(e)`, 'success');
  };

  const setStatusOf = (id: number, nextStatus: string) => {
    const quoteSettings = loadAdminSettings().quote;
    let orderId: number | undefined;
    let effectiveStatus = nextStatus;
    if (kind === 'quotes' && nextStatus === 'accepted' && quoteSettings.autoTransformToOrder) {
      const quote = rows.find((r) => r.id === id);
      if (quote) {
        const created = convertToOrder(quote);
        orderId = created.id;
        effectiveStatus = 'transformed';
      }
    }
    const next = rows.map((r) => r.id === id ? {
      ...r,
      status: effectiveStatus as never,
      ...(orderId ? { orderId } : {}),
      history: [...(r.history || []), { status: effectiveStatus, at: new Date().toISOString(), note }],
    } : r);
    persist(next);
    const updated = next.find((r) => r.id === id);
    if (updated) setOpen(updated);
    setNote('');
    showToast(orderId ? `Devis accepté → commande #${orderId} créée` : 'Statut mis à jour', 'success');
  };

  const convertToOrder = (quote: Row): Order => {
    const all = loadOrders();
    const newOrder: Order = {
      id: (all.length ? Math.max(...all.map((o) => Number(o.id) || 0)) : 1000) + 1,
      client: quote.client,
      email: quote.email,
      phone: quote.phone,
      company: quote.company,
      date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      total: Number(quote.total) || 0,
      items: (quote.items || []).map((it) => ({ ...it })),
      address: quote.address,
      zone: quote.zone,
      ip: quote.ip,
      quoteId: quote.id,
    };
    saveOrders([newOrder, ...all]);
    return newOrder;
  };

  const shown = useMemo(() => rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (!q.trim()) return true;
    return `${r.client} ${r.email} ${r.id} ${r.company || ''}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, q, status]);

  const related = open ? rows.filter((r) => r.email === open.email && r.id !== open.id) : [];
  const orders = kind === 'quotes' ? loadOrders() : [];
  const quotes = kind === 'orders' ? loadQuotes() : [];
  const linkedQuote = open && 'quoteId' in open && open.quoteId ? quotes.find((qte) => qte.id === open.quoteId) : undefined;
  const linkedOrder = open && 'orderId' in open && open.orderId ? orders.find((ord) => ord.id === open.orderId) : undefined;
  const totals = open ? computeTotals(open.items || [], taxes, coupons.find((c) => c.code === open.coupon), { zone: open.zone }) : null;
  const stats = {
    total: rows.length,
    amount: rows.reduce((s, r) => s + Number(r.total || 0), 0),
    pending: rows.filter((r) => r.status === 'pending' || r.status === 'sent' || r.status === 'processing').length,
  };

  const patchItem = (i: number, patch: Partial<CommerceItem>) => {
    if (!open) return;
    const items = (open.items || []).map((it, idx) => idx === i ? { ...it, ...patch } : it);
    setOpen({ ...open, items });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>E-shop</div>
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        </div>
        <div className="flex" style={{ border: '1px solid var(--ad-line)' }}>
          <button type="button" className={`ad-btn ad-btn-icon ${view === 'list' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('list')}><ListIcon className="w-4 h-4" /></button>
          <button type="button" className={`ad-btn ad-btn-icon ${view === 'cards' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('cards')}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[[stats.total, title], [`${stats.amount.toLocaleString()} DA`, 'Montant'], [stats.pending, 'En cours']].map(([v, l]) => (
          <div key={String(l)} className="ad-card p-4">
            <div className="text-2xl font-black tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="ad-card p-3 space-y-3">
        <SearchField value={draft} onChange={setDraft} onSubmit={() => setQ(draft)} showSubmit placeholder="Rechercher un client, e-mail ou n°…" />
        <select className="ad-select sm:w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {view === 'list' ? (
        <div className="ad-card overflow-x-auto">
          <table className="ad-table">
            <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Pays / IP</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-sm">#{row.id}</td>
                  <td><div className="font-bold">{row.client}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{row.email}</div></td>
                  <td>{row.date}</td>
                  <td className="font-black whitespace-nowrap">{Number(row.total).toLocaleString()} DA</td>
                  <td><GeoBadge ip={row.ip} /></td>
                  <td><span className={`ad-chip ${row.status === 'delivered' || row.status === 'accepted' ? 'ad-chip-ok' : row.status === 'cancelled' || row.status === 'rejected' ? 'ad-chip-mute' : 'ad-chip-warn'}`}>{row.status}</span></td>
                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Message au client" onClick={() => setMessageTo(row)}><MessageSquareText className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setConsult(true); setOpen(row); }}><Eye className="w-4 h-4" /> Voir</button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setConsult(false); setOpen(row); }}>Éditer</button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" title="Supprimer" onClick={() => persist(rows.filter((r) => r.id !== row.id))}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((row) => (
            <article key={row.id} className="ad-card p-4 space-y-2">
              <div className="flex justify-between"><span className="font-mono text-xs">#{row.id}</span><span className="ad-chip ad-chip-acc">{row.status}</span></div>
              <h3 className="font-black">{row.client}</h3>
              <div className="font-black" style={{ color: 'var(--ad-accent)' }}>{Number(row.total).toLocaleString()} DA</div>
              <div className="flex gap-2">
                <button className="ad-btn ad-btn-ghost flex-1" onClick={() => { setConsult(true); setOpen(row); }}>Consulter</button>
                <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Message au client" onClick={() => setMessageTo(row)}><MessageSquareText className="w-4 h-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Drawer
        open={!!open}
        title={`${title} #${open?.id || ''}`}
        subtitle={open?.client}
        onClose={() => { setOpen(null); setHistoryOpen(false); }}
        width={720}
        footer={consult ? (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => open && setMessageTo(open)}><MessageSquareText className="w-4 h-4" /> Message</button>
            <button className="ad-btn ad-btn-ghost" onClick={() => setOpen(null)}>Fermer</button>
            <button className="ad-btn ad-btn-primary" onClick={() => setConsult(false)}>Éditer</button>
          </>
        ) : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => open && setMessageTo(open)}><MessageSquareText className="w-4 h-4" /> Message</button>
            {kind === 'quotes' && (
              <button className="ad-btn ad-btn-ghost" onClick={() => open && setRespondTo(open)}><Reply className="w-4 h-4" /> Répondre au devis</button>
            )}
            <button className="ad-btn ad-btn-ghost" onClick={() => setOpen(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => open && saveOpen(open)}>Enregistrer</button>
          </>
        )}
      >
        {open && totals && (
          <>
            <div className="flex flex-wrap gap-1">
              {statuses.map((s, i) => (
                <button key={s.value} type="button" disabled={consult} className={`ad-btn ${open.status === s.value ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setStatusOf(open.id, s.value)}>
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>
            {!consult && (
              <label className="block space-y-1.5">
                <span className="field-label">Commentaire d'étape</span>
                <input className="ad-input" placeholder="Indication : note visible dans l'historique lors du changement de statut…" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span style={{ color: 'var(--ad-muted)' }}>Client</span><div className="font-bold">{open.client}</div></div>
              <div>
                <span style={{ color: 'var(--ad-muted)' }}>Fiche client</span>
                <div><Link className="underline" href={`/${locale}/admin/clients`}>{open.email}</Link></div>
              </div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Téléphone</span><div>{open.phone || '—'}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Société</span><div>{open.company || '—'}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Date</span><div className="font-bold">{open.date}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Paiement</span><div>{('payment' in open && open.payment) || '—'}</div></div>
              <div className="col-span-2"><span style={{ color: 'var(--ad-muted)' }}>Adresse</span><div>{open.address || '—'}</div></div>
              <div className="col-span-2">
                <span style={{ color: 'var(--ad-muted)' }}>Pays / IP</span>
                <div><GeoBadge ip={open.ip} /></div>
              </div>
            </div>

            {kind === 'quotes' && (
              <div className="ad-card p-3 space-y-1 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--ad-accent) 35%, var(--ad-line))' }}>
                <div className="font-black flex items-center gap-2" style={{ color: 'var(--ad-accent)' }}>Conversion du devis</div>
                {linkedOrder ? (
                  <div>
                    Abouti à la commande{' '}
                    <button className="underline font-bold" onClick={() => { setOpen(null); window.location.href = `/${locale}/admin/orders`; }}>
                      #{linkedOrder.id} · {linkedOrder.status} · {Number(linkedOrder.total).toLocaleString()} DA
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div style={{ color: 'var(--ad-muted)' }}>Aucune commande liée à ce devis.</div>
                    {!consult && open.status === 'accepted' && (
                      <button className="ad-btn ad-btn-ghost" onClick={() => {
                        const created = convertToOrder(open);
                        const next = rows.map((r) => r.id === open.id ? {
                          ...r,
                          orderId: created.id,
                          status: 'transformed' as never,
                          history: [...(r.history || []), { status: 'transformed', at: new Date().toISOString(), note: `Transformé en commande #${created.id}` }],
                        } as Row : r);
                        persist(next);
                        const updated = next.find((r) => r.id === open.id);
                        if (updated) setOpen(updated);
                        showToast(`Commande #${created.id} créée`, 'success');
                      }}>Convertir en commande</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {linkedQuote && (
              <div className="ad-origin">Devis d’origine : <button className="underline font-bold" onClick={() => { window.location.href = `/${locale}/admin/quotes`; }}>#{linkedQuote.id} · {linkedQuote.status} · {linkedQuote.total.toLocaleString()} DA</button></div>
            )}

            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setHistoryOpen((v) => !v)}>
              <History className="w-4 h-4" /> Autres {title.toLowerCase()} du client ({related.length})
            </button>
            {historyOpen && (
              <ul className="text-sm space-y-1 ad-card p-3">
                {related.length === 0 && <li style={{ color: 'var(--ad-muted)' }}>Aucun autre document.</li>}
                {related.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <button className="underline" onClick={() => setOpen(r)}>#{r.id} · {r.date} · {r.status}</button>
                    <strong>{Number(r.total).toLocaleString()} DA</strong>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="ad-section-title">Lignes</h3>
            {!consult && (
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                Indication : renseignez le nom de l'article, la quantité vendue, le prix unitaire HT et, le cas échéant, une remise en %.
              </p>
            )}
            <div className="space-y-2">
              {(open.items || []).map((it, i) => (
                <div key={i} className="ad-card p-3 grid grid-cols-12 gap-2 items-end text-sm">
                  <div className="col-span-4">
                    <label className="block">
                      <span className="field-label">Article</span>
                      {consult
                        ? <div className="font-bold pt-1.5">{it.name}</div>
                        : <input className="ad-input" placeholder="Nom de l'article…" value={it.name} onChange={(e) => patchItem(i, { name: e.target.value })} />}
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="block">
                      <span className="field-label">Quantité</span>
                      {consult
                        ? <div className="pt-1.5">× {it.quantity}</div>
                        : <input className="ad-input" type="number" min={1} placeholder="Qté" value={it.quantity} onChange={(e) => patchItem(i, { quantity: Number(e.target.value) })} />}
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="block">
                      <span className="field-label">Prix unit. HT (DA)</span>
                      {consult
                        ? <div className="pt-1.5">{it.price.toLocaleString()}</div>
                        : <input className="ad-input" type="number" min={0} placeholder="Prix HT" value={it.price} onChange={(e) => patchItem(i, { price: Number(e.target.value) })} />}
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="block">
                      <span className="field-label">Remise %</span>
                      {consult
                        ? <div className="pt-1.5">-{it.discount || 0}%</div>
                        : <input className="ad-input" type="number" min={0} max={100} placeholder="0" value={it.discount || 0} onChange={(e) => patchItem(i, { discount: Number(e.target.value) })} />}
                    </label>
                  </div>
                  <div className="col-span-1 font-black text-right pb-1.5" title="Total de la ligne (remise déduite)">{((it.quantity * it.price) * (1 - (it.discount || 0) / 100)).toLocaleString()}</div>
                  {!consult && <button className="ad-btn ad-btn-icon ad-btn-danger col-span-1" title="Supprimer la ligne" onClick={() => setOpen({ ...open, items: (open.items || []).filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
              {!consult && (
                <button className="ad-btn ad-btn-ghost" onClick={() => setOpen({ ...open, items: [...(open.items || []), { id: Date.now(), name: '', quantity: 1, price: 0 }] })}>
                  <Plus className="w-4 h-4" /> Ajouter une ligne
                </button>
              )}
            </div>

            {!consult && (
              <label className="block space-y-1.5">
                <span className="field-label">Code promo / Coupon</span>
                <input className="ad-input font-mono" placeholder="Ex. SARI10 (facultatif)" value={open.coupon || ''} onChange={(e) => setOpen({ ...open, coupon: e.target.value.toUpperCase() })} />
              </label>
            )}

            <div className="ad-card p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Sous-total HT</span><strong>{money(totals.subtotal)}</strong></div>
              <div className="flex justify-between"><span>Remise {open.coupon ? `(${open.coupon})` : ''}</span><strong>- {money(totals.discount)}</strong></div>
              {totals.taxLines.map((t) => (
                <div key={t.id} className="flex justify-between" style={{ color: 'var(--ad-muted)' }}>
                  <span>{t.name} {t.included ? '(incluse)' : ''} {t.mode === 'percent' ? `${t.rate}%` : ''}</span>
                  <span>{money(t.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between"><span>Total taxes</span><strong>{money(totals.taxTotal)}</strong></div>
              <div className="flex justify-between text-base pt-2" style={{ borderTop: '1px solid var(--ad-line)' }}>
                <span className="font-black">Total TTC</span>
                <span className="font-black" style={{ color: 'var(--ad-accent)' }}>{money(totals.total)}</span>
              </div>
            </div>
          </>
        )}
      </Drawer>

      {messageTo && (
        <MessageComposer
          email={messageTo.email}
          name={messageTo.client}
          type="client"
          subject={
            kind === 'quotes'
              ? `Votre devis ${('reference' in messageTo && messageTo.reference) || `#${messageTo.id}`}`
              : `Votre commande #${messageTo.id}`
          }
          context={
            kind === 'quotes'
              ? { kind: 'quote', id: messageTo.id, ref: ('reference' in messageTo && messageTo.reference) || undefined }
              : { kind: 'order', id: messageTo.id }
          }
          onClose={() => setMessageTo(null)}
        />
      )}

      {respondTo && (
        <QuoteResponseComposer
          quote={respondTo as Quote}
          onClose={() => setRespondTo(null)}
          onSave={(response) => {
            const next = rows.map((r) => (r.id === respondTo.id ? ({
              ...r,
              response,
              status: 'replied',
              history: [...(r.history || []), { status: 'replied', at: new Date().toISOString(), note: 'Réponse au devis envoyée' }],
            } as Row) : r));
            persist(next);
            const updated = next.find((r) => r.id === respondTo.id);
            if (updated) setOpen(updated);
            setRespondTo(null);
            showToast('Réponse au devis envoyée', 'success');
          }}
        />
      )}
    </div>
  );
}
