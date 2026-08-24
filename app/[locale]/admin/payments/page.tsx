'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatIban, formatRib, isValidIban, loadPayments, savePayments, type PaymentMethod, type PaymentType } from '@/lib/shop-store';
import { normalizeOrderPaymentType } from '@/lib/payments';
import { loadOrders } from '@/lib/crm-store';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import SearchField from '@/components/admin/SearchField';
import { useTranslations } from 'next-intl';

const TYPES: Array<{ value: PaymentType; label: string }> = [
  { value: 'card-intl', label: 'Carte internationale' },
  { value: 'cib', label: 'Carte CIB / locale' },
  { value: 'transfer', label: 'Virement bancaire' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'check', label: t("check") },
  { value: 'cod', label: t("cashOnDelivery") },
  { value: 'other', label: 'Autre' },
];

const empty = (): PaymentMethod => ({ id: `p-${Date.now()}`, name: '', type: 'transfer', active: true, fees: 0, instructions: '' });

export default function PaymentsPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.payments');
  const [rows, setRows] = useState<PaymentMethod[]>([]);
  const [draft, setDraft] = useState<PaymentMethod | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [ordersByType, setOrdersByType] = useState<PaymentMethod | null>(null);

  useEffect(() => { setRows(loadPayments()); }, []);

  const ordersFor = useMemo(() => {
    if (!ordersByType) return [];
    return loadOrders().filter((o) => normalizeOrderPaymentType(o.payment) === ordersByType.type);
  }, [ordersByType]);

  const persist = (next: PaymentMethod[], toast = 'Modes de paiement enregistrés') => {
    setRows(next); savePayments(next); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };

  const validate = (row: PaymentMethod) => {
    if (!row.name.trim()) return 'Nom obligatoire';
    if (row.type === 'transfer' && row.iban && !isValidIban(row.iban)) return 'IBAN invalide (2 lettres pays + 2 chiffres + BBAN)';
    if (row.type === 'paypal' && row.paypalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.paypalEmail)) return 'E-mail PayPal invalide';
    return '';
  };

  const shown = rows.filter((r) => !q || `${r.name} ${r.type}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Paiements</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setError(''); setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" /> Ajouter</button>
      </header>
      <div className="ad-card p-3"><SearchField value={q} onChange={setQ} placeholder="Nom, type…" /></div>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r), 'Activés')}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r), 'Désactivés')}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)), 'Supprimés')}>Supprimer</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>{t("name", { defaultMessage: "Nom" })}</th><th>{t("type", { defaultMessage: "Type" })}</th><th>{t("fees")}</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} /></td>
                <td className="font-bold">{r.name}</td>
                <td>{TYPES.find((t) => t.value === r.type)?.label}</td>
                <td>{r.fees}{r.type === 'cod' ? ' DA' : ' %'}</td>
                <td><span className={`ad-chip ${r.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{r.active ? 'Actif' : 'Inactif'}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button className="ad-btn ad-btn-ghost" title="Commandes par ce type" onClick={() => setOrdersByType(r)}><ListOrdered className="w-4 h-4" /> {ordersFor.length > 0 ? '' : 'Commandes'}</button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...r }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setError(''); setMode('edit'); setDraft({ ...r }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== r.id), 'Supprimé')}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.name}` : 'Configurer le paiement'}
        onClose={() => setDraft(null)}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft) return;
              const err = validate(draft);
              if (err) { setError(err); return; }
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("name", { defaultMessage: "Nom" })}</span>
              <input className="ad-input" disabled={mode === 'consult'} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("type", { defaultMessage: "Type" })}</span>
              <select className="ad-select" disabled={mode === 'consult'} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PaymentType })}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("fees")}</span>
              <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.fees} onChange={(e) => setDraft({ ...draft, fees: Number(e.target.value) })} />
              <p className="ad-field-hint">{draft.type === 'cod' ? 'Montant forfaitaire en DA ajouté à la commande.' : 'Pourcentage de commission appliqué au paiement.'}</p>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("clientInstructions")}</span>
              <textarea className="ad-textarea" disabled={mode === 'consult'} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </label>
            {draft.type === 'transfer' && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>IBAN</span>
                  <input className="ad-input font-mono" disabled={mode === 'consult'} value={draft.iban || ''} onChange={(e) => setDraft({ ...draft, iban: formatIban(e.target.value) })} placeholder="DZ58 0000 …" />
                  <p className="ad-field-hint">Format IBAN : 2 lettres pays + 2 chiffres + BBAN.</p>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>RIB</span>
                  <input className="ad-input font-mono" disabled={mode === 'consult'} value={draft.rib || ''} onChange={(e) => setDraft({ ...draft, rib: formatRib(e.target.value) })} placeholder="007 99999 …" />
                </label>
                <input className="ad-input" disabled={mode === 'consult'} placeholder="Titulaire du compte" value={draft.account || ''} onChange={(e) => setDraft({ ...draft, account: e.target.value })} />
              </>
            )}
            {draft.type === 'paypal' && (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>E-mail PayPal</span>
                <input className="ad-input" type="email" disabled={mode === 'consult'} value={draft.paypalEmail || ''} onChange={(e) => setDraft({ ...draft, paypalEmail: e.target.value })} />
              </label>
            )}
            {(draft.type === 'card-intl' || draft.type === 'cib') && (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Clé API</span>
                <input className="ad-input font-mono" type="password" disabled={mode === 'consult'} value={draft.apiKey || ''} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />
                <p className="ad-field-hint">Masquée à l’affichage. Ne jamais coller une clé de production dans un ticket.</p>
              </label>
            )}
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Actif" hint="Un mode inactif n’apparaît plus au checkout." disabled={mode === 'consult'} />
            {error && <p className="text-sm" style={{ color: 'var(--ad-danger)' }}>{error}</p>}
          </>
        )}
      </Drawer>

      <Drawer
        open={!!ordersByType}
        title={`Commandes · ${ordersByType?.name || ''}`}
        subtitle={`${ordersFor.length} commande(s) réglée(s) par ce mode`}
        onClose={() => setOrdersByType(null)}
        width={680}
        footer={<button className="ad-btn ad-btn-ghost" onClick={() => setOrdersByType(null)}>Fermer</button>}
      >
        {ordersFor.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--ad-muted)' }}>Aucune commande pour ce mode de paiement.</div>
        ) : (
          <table className="ad-table">
            <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead>
            <tbody>
              {ordersFor.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-sm">{o.code || `#${o.id}`}</td>
                  <td><div className="font-bold">{o.client}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{o.email}</div></td>
                  <td>{o.date}</td>
                  <td className="font-black whitespace-nowrap">{Number(o.total).toLocaleString()} DA</td>
                  <td><span className="ad-chip ad-chip-acc">{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Drawer>
    </div>
  );
}
