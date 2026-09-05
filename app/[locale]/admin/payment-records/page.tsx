'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Eye, Pencil, Trash2, XCircle } from 'lucide-react';
import {
  deletePayment, exportPaymentsCsv, loadPaymentRecords, paymentStatusLabel, paymentTypeLabel,
  rejectPayment, validatePayment, type PaymentRecord, type PaymentStatus,
} from '@/lib/payments';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import SearchField from '@/components/admin/SearchField';
import { useTranslations } from 'next-intl';
import DateText from '@/components/shared/DateText';
import { money } from '@/lib/commerce-math';

const STATUSES: Array<{ value: '' | PaymentStatus; label: string }> = [
  { value: '', label: 'Tous les statuts' },
  { value: 'validated', label: 'Validés' },
  { value: 'pending', label: 'En attente' },
  { value: 'rejected', label: 'Rejetés' },
];

export default function PaymentRecordsPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.paymentRecords');
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | PaymentStatus>('');
  const [open, setOpen] = useState<PaymentRecord | null>(null);
  const [consult, setConsult] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setRows(loadPaymentRecords());
    const handler = () => setRows(loadPaymentRecords());
    window.addEventListener('sari-payments-changed', handler);
    return () => window.removeEventListener('sari-payments-changed', handler);
  }, []);

  const shown = useMemo(() => rows.filter((p) => {
    if (status && p.status !== status) return false;
    if (q && !`${p.client} ${p.email} ${p.orderCode || ''} ${p.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, status]);

  const stats = {
    total: rows.length,
    validated: rows.filter((p) => p.status === 'validated').reduce((s, p) => s + Number(p.amount || 0), 0),
    pending: rows.filter((p) => p.status === 'pending').length,
  };

  const validate = () => {
    if (!open) return;
    if (!note.trim()) { showToast('Écrivez une note de validation', 'error'); return; }
    validatePayment(open.id, note);
    setNote('');
    setOpen(null);
    setRows(loadPaymentRecords());
    showToast('Paiement validé', 'success');
  };

  const reject = () => {
    if (!open) return;
    if (!note.trim()) { showToast('Écrivez une note de rejet', 'error'); return; }
    rejectPayment(open.id, note);
    setNote('');
    setOpen(null);
    setRows(loadPaymentRecords());
    showToast('Paiement rejeté', 'success');
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="ad-breadcrumb">E-shop / Paiements effectués</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className="ad-btn ad-btn-ghost"
          onClick={() => { exportPaymentsCsv(shown); showToast('Export CSV généré', 'success'); }}
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[[stats.total, 'Paiements'], [money(stats.validated), 'Montant validé'], [stats.pending, 'En attente']].map(([v, l]) => (
          <div key={String(l)} className="ad-card p-4">
            <div className="text-2xl font-black tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="ad-card p-3 flex flex-wrap gap-2">
        <div className="flex-1 min-w-[220px]"><SearchField value={q} onChange={setQ} placeholder="Client, email, commande…" /></div>
        <select className="ad-select sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as '' | PaymentStatus)}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="ad-card overflow-x-auto">
        <table className="ad-table min-w-[760px]">
          <thead><tr><th>{t("order")}</th><th>{t("client")}</th><th>{t("method")}</th><th>{t("card")}</th><th>{t("amount")}</th><th>Statut</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>{t("noPayments")}</td></tr>}
            {shown.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-sm">{p.orderCode || (p.orderId ? `#${p.orderId}` : '—')}</td>
                <td><div className="font-bold">{p.client}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{p.email}</div></td>
                <td>{paymentTypeLabel(p.method)}</td>
                <td className="font-mono">{p.cardMasked || '—'}</td>
                <td className="font-black whitespace-nowrap">{money(Number(p.amount))}</td>
                <td>
                  <span className={`ad-chip ${p.status === 'validated' ? 'ad-chip-ok' : p.status === 'rejected' ? 'ad-chip-mute' : 'ad-chip-warn'}`}>
                    {paymentStatusLabel(p.status)}
                  </span>
                </td>
                <td className="text-sm"><DateText value={p.date} /></td>
                <td className="text-right whitespace-nowrap">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setConsult(true); setOpen(p); setNote(''); }}><Eye className="w-4 h-4" /> Voir</button>
                  {p.status === 'pending' && (
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setConsult(false); setOpen(p); setNote(''); }}><CheckCircle2 className="w-4 h-4" /> Valider</button>
                  )}
                  <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" title="Supprimer" onClick={() => { if (confirm('Supprimer ce paiement ?')) { deletePayment(p.id); setRows(loadPaymentRecords()); showToast('Supprimé', 'success'); } }}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!open}
        title={consult ? `Paiement · ${open?.client}` : 'Valider le paiement'}
        subtitle={open ? `${open.methodName} · ${paymentStatusLabel(open.status)}` : undefined}
        onClose={() => setOpen(null)}
        width={560}
        footer={consult ? (
          <button className="ad-btn ad-btn-ghost" onClick={() => setOpen(null)}>Fermer</button>
        ) : (
          <>
            <button className="ad-btn ad-btn-danger" onClick={reject}><XCircle className="w-4 h-4" /> Rejeter</button>
            <button className="ad-btn ad-btn-primary" onClick={validate}><CheckCircle2 className="w-4 h-4" /> Valider</button>
          </>
        )}
      >
        {open && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span style={{ color: 'var(--ad-muted)' }}>{t("order")}</span><div className="font-bold font-mono">{open.orderCode || (open.orderId ? `#${open.orderId}` : '—')}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>{t("amount")}</span><div className="font-black">{money(Number(open.amount))}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>{t("client")}</span><div className="font-bold">{open.client}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>Email</span><div>{open.email}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>{t("method")}</span><div>{paymentTypeLabel(open.method)}</div></div>
              <div><span style={{ color: 'var(--ad-muted)' }}>{t("card")}</span><div className="font-mono">{open.cardMasked || '—'}</div></div>
              <div className="col-span-2"><span style={{ color: 'var(--ad-muted)' }}>Date</span><div><DateText value={open.date} /></div></div>
            </div>

            {open.note && (
              <div className="ad-card p-3 text-sm" style={{ background: 'var(--ad-surface-2)' }}>
                <span className="font-black">Note :</span> {open.note}
              </div>
            )}

            {!consult && open.status === 'pending' && (
              <label className="block space-y-1.5">
                <span className="field-label">Note de validation (obligatoire)</span>
                <textarea className="ad-textarea" rows={3} placeholder="Ex. virement reçu et rapproché le…" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
