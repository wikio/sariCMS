'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { docStatus, restoreDocBackup, syncDoc, type DocSource } from '@/lib/settings-doc';
import { useDocRefresh } from '@/lib/use-settings-doc';
import { Eye, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { defaultPaymentMethods, formatIban, formatRib, isValidIban, loadPayments, savePayments, type PaymentMethod, type PaymentType } from '@/lib/shop-store';
import { normalizeOrderPaymentType } from '@/lib/payments';
import { loadOrders } from '@/lib/crm-store';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import SearchField from '@/components/admin/SearchField';
import { useTranslations } from 'next-intl';
import DateText from '@/components/shared/DateText';
import { money } from '@/lib/commerce-math';
import { useCurrency } from '@/lib/use-currency';

const TYPES: Array<{ value: PaymentType; labelKey: string }> = [
  { value: 'card-intl', labelKey: 'typeIntlCard' },
  { value: 'cib', labelKey: 'typeCib' },
  { value: 'transfer', labelKey: 'typeTransfer' },
  { value: 'paypal', labelKey: 'typePaypal' },
  { value: 'check', labelKey: 'typeCheck' },
  { value: 'cod', labelKey: 'typeCod' },
  { value: 'other', labelKey: 'typeOther' },
];

const empty = (): PaymentMethod => ({ id: `p-${Date.now()}`, name: '', type: 'transfer', active: true, fees: 0, instructions: '' });

export default function PaymentsPage() {
  const { symbol } = useCurrency();
  const { showToast } = useToast();
  const t = useTranslations('admin.payments');
  const [rows, setRows] = useState<PaymentMethod[]>([]);
  const [draft, setDraft] = useState<PaymentMethod | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [ordersByType, setOrdersByType] = useState<PaymentMethod | null>(null);
  const [origin, setOrigin] = useState<{ source: DocSource; rows: number; backupRows: number } | null>(null);

  // « Vide » ne veut pas dire une seule chose : un document jamais enregistré, un
  // document enregistré vide et une base muette se ressemblent à l'œil et se
  // réparent différemment. L'écran pose donc la question à la base, et l'affiche.
  const reloadOrigin = useCallback(
    () => docStatus('payments').then(setOrigin).catch(() => setOrigin(null)),
    [],
  );

  useEffect(() => {
    setRows(loadPayments());
    void reloadOrigin();
  }, [reloadOrigin]);
  // Le cache est lu au montage, l'amorçage arrive après : sans cette seconde
  // lecture, un poste neuf affiche une liste vide pendant que la base est pleine.
  useDocRefresh('payments', () => {
    setRows(loadPayments());
    void reloadOrigin();
  });

  const ordersFor = useMemo(() => {
    if (!ordersByType) return [];
    return loadOrders().filter((o) => normalizeOrderPaymentType(o.payment) === ordersByType.type);
  }, [ordersByType]);

  const persist = (next: PaymentMethod[], toast = t("saved")) => {
    setRows(next); savePayments(next); syncDoc('payments'); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };

  const validate = (row: PaymentMethod) => {
    if (!row.name.trim()) return t("name")+" "+t("required", {defaultMessage: "obligatoire"});
    if (row.type === 'transfer' && row.iban && !isValidIban(row.iban)) return t("iban")+" invalide (2 lettres pays + 2 chiffres + BBAN)";
    if (row.type === 'paypal' && row.paypalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.paypalEmail)) return "E-mail PayPal invalide";
    return '';
  };

  const shown = rows.filter((r) => !q || `${r.name} ${r.type}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">{t("breadcrumb")}</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setError(''); setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" />{t("add")}</button>
      </header>
      {origin && (
        <div className="ad-card p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm flex-1 min-w-[16rem]" style={{ color: 'var(--ad-muted)' }}>
            {origin.source === 'db' && origin.rows > 0 &&
              t('originDb', { defaultMessage: '{n} mode(s) lu(s) de la base — document `doc_payments`, partagé par tous les postes.', n: origin.rows })}
            {origin.source === 'db' && origin.rows === 0 &&
              t('originDbEmpty', {
                defaultMessage:
                  'La base contient le document `doc_payments` et il est vide : quelqu’un l’a enregistré vide, et c’est maintenant la liste de tout le monde. Repartez des valeurs livrées, ou rendez la copie locale de ce poste.',
              })}
            {origin.source === 'default' &&
              t('originNever', {
                defaultMessage:
                  'Jamais enregistré en base : ce que vous voyez ici est la liste par défaut de ce navigateur, elle n’est partagée avec personne. Un enregistrement la met en base.',
              })}
            {origin.source === 'na' &&
              t('originNa', { defaultMessage: 'La base n’a pas répondu (API muette ou droit `payments:read` manquant) : le poste affiche son cache local.' })}
          </p>
          {origin.source !== 'db' || origin.rows === 0 ? (
            <button
              className="ad-btn ad-btn-ghost"
              onClick={() => {
                persist(defaultPaymentMethods(), t('defaultsSaved', { defaultMessage: 'Valeurs livrées rechargées et envoyées en base' }));
                // `syncDoc` n'est pas attendu : le macaron se recalcule une seconde
                // après, et une réponse en retard ne coûte qu'un rafraîchissement.
                setTimeout(() => void reloadOrigin(), 1000);
              }}
            >
              <ListOrdered className="w-4 h-4" /> {t('useDefaults', { defaultMessage: 'Repartir des valeurs livrées' })}
            </button>
          ) : null}
          {origin.source === 'default' && origin.rows === 0 ? (
            <button
              className="ad-btn ad-btn-primary"
              onClick={() => {
                savePayments(rows);
                syncDoc('payments');
                setTimeout(() => void reloadOrigin(), 1000);
                showToast(t('pushed', { defaultMessage: 'Liste envoyée en base' }), 'success');
              }}
            >
              {t('pushNow', { defaultMessage: 'Enregistrer en base' })}
            </button>
          ) : null}
          {origin.backupRows > 0 ? (
            <button
              className="ad-btn ad-btn-ghost"
              onClick={() => {
                if (restoreDocBackup('payments')) {
                  setRows(loadPayments());
                  showToast(t('backupRestored', { defaultMessage: 'Copie locale rendue ({n} ligne(s))', n: origin.backupRows }), 'success');
                  setTimeout(() => void reloadOrigin(), 1000);
                } else {
                  showToast(t('backupEmpty', { defaultMessage: 'Aucune copie locale exploitable sur ce poste.' }), 'warning');
                }
              }}
            >
              {t('useBackup', { defaultMessage: 'Rendre la copie locale ({n})', n: origin.backupRows })}
            </button>
          ) : null}
        </div>
      )}
      <div className="ad-card p-3"><SearchField value={q} onChange={setQ} placeholder={t("searchPlaceholder")} /></div>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r), t("active"))}>{t("active")}</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r), t("inactive"))}>{t("inactive")}</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)), t("deleted"))}>{t("delete")}</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>{t("name", { defaultMessage: "Nom" })}</th><th>{t("type", { defaultMessage: "Type" })}</th><th>{t("fees")}</th><th>{t("status")}</th><th></th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} /></td>
                <td className="font-bold">{r.name}</td>
                <td>{t(TYPES.find((x) => x.value === r.type)?.labelKey || "typeOther")}</td>
                <td>{r.fees}{r.type === 'cod' ? ` ${symbol}` : ' %'}</td>
                <td><span className={`ad-chip ${r.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{r.active ? t("active") : t("inactive")}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button className="ad-btn ad-btn-ghost" title={t("ordersByType")} onClick={() => setOrdersByType(r)}><ListOrdered className="w-4 h-4" /> {ordersFor.length > 0 ? '' : t("ordersByType")}</button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...r }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setError(''); setMode('edit'); setDraft({ ...r }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== r.id), t("deleted"))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `${t("consult")} · ${draft?.name}` : t("title")}
        onClose={() => setDraft(null)}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>{t("close")}</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>{t("cancel")}</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft) return;
              const err = validate(draft);
              if (err) { setError(err); return; }
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
            }}>{t("save")}</button>
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
                {TYPES.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
              </select>
              <p className="ad-field-hint">
                {t('typesAreCode', {
                  defaultMessage:
                    'La liste des types (virement, CIB, carte, PayPal, chèque, livraison) est fixée par le code, pas par la base : chaque type pilote un comportement — IBAN pour le virement, e-mail pour PayPal, frais en dinars pour la livraison. Un mode neuf se crée ici, sur n’importe lequel de ces types.',
                })}
              </p>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("fees")}</span>
              <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.fees} onChange={(e) => setDraft({ ...draft, fees: Number(e.target.value) })} />
              <p className="ad-field-hint">{draft.type === 'cod' ? t("feeHintCod") : t("feeHintPercent")}</p>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("clientInstructions")}</span>
              <textarea className="ad-textarea" disabled={mode === 'consult'} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </label>
            {draft.type === 'transfer' && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("iban")}</span>
                  <input className="ad-input font-mono" disabled={mode === 'consult'} value={draft.iban || ''} onChange={(e) => setDraft({ ...draft, iban: formatIban(e.target.value) })} placeholder="DZ58 0000 …" />
                  <p className="ad-field-hint">{t("ibanHint")}</p>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("rib")}</span>
                  <input className="ad-input font-mono" disabled={mode === 'consult'} value={draft.rib || ''} onChange={(e) => setDraft({ ...draft, rib: formatRib(e.target.value) })} placeholder="007 99999 …" />
                </label>
                <input className="ad-input" disabled={mode === 'consult'} placeholder={t("accountHolder")} value={draft.account || ''} onChange={(e) => setDraft({ ...draft, account: e.target.value })} />
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
                <p className="ad-field-hint">{t("apiKeyHint", {defaultMessage: "Masquée à l’affichage. Ne jamais coller une clé de production dans un ticket."})}</p>
              </label>
            )}
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label={t("active")} hint={t("inactiveHint", {defaultMessage: "Un mode inactif n’apparaît plus au checkout."})} disabled={mode === 'consult'} />
            {error && <p className="text-sm" style={{ color: 'var(--ad-danger)' }}>{error}</p>}
          </>
        )}
      </Drawer>

      <Drawer
        open={!!ordersByType}
        title={t("ordersForPayment", {name: ordersByType?.name || ''})}
        subtitle={`${ordersFor.length} commande(s) réglée(s) par ce mode`}
        onClose={() => setOrdersByType(null)}
        width={680}
        footer={<button className="ad-btn ad-btn-ghost" onClick={() => setOrdersByType(null)}>{t("close")}</button>}
      >
        {ordersFor.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--ad-muted)' }}>{t("noOrdersForPayment")}</div>
        ) : (
          <table className="ad-table">
            <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total</th><th>{t("status")}</th></tr></thead>
            <tbody>
              {ordersFor.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-sm">{o.code || `#${o.id}`}</td>
                  <td><div className="font-bold">{o.client}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{o.email}</div></td>
                  <td><DateText value={o.date} dateOnly /></td>
                  <td className="font-black whitespace-nowrap">{money(Number(o.total))}</td>
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
