'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List as ListIcon, MessageSquareText, Plus, Trash2, User } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { loadOrders, loadQuotes, orderRevenue } from '@/lib/crm-store';
import GeoBadge from '@/components/admin/GeoBadge';
import MessageComposer from '@/components/admin/MessageComposer';
import DateText from '@/components/shared/DateText';
import { money } from '@/lib/commerce-math';

type Person = Record<string, unknown> & {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  status?: string;
  position?: string;
  type?: string;
  notes?: string;
  ip?: string;
  country?: string;
};

export default function PeopleDesk({
  type, title, singular,
}: {
  type: 'client' | 'candidate' | 'partner';
  title: string;
  singular: string;
}) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [editing, setEditing] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageTo, setMessageTo] = useState<Person | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await cmsAdminList<Person>('users', { filter: JSON.stringify({ type }) });
      setRows(list);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Chargement impossible', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);

  const shown = useMemo(() => rows.filter((r) => {
    if (status && String(r.status || '') !== status) return false;
    if (!q.trim()) return true;
    const blob = [r.firstName, r.lastName, r.email, r.company, r.phone, r.position].join(' ').toLowerCase();
    return blob.includes(q.toLowerCase());
  }), [rows, q, status]);

  const save = async () => {
    if (!editing) return;
    if (!String(editing.email || '').trim()) {
      showToast('Email obligatoire', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...editing, type, password: editing.id ? undefined : 'ChangeMe_Sari2026!' };
      if (editing.id && editing.notes) {
        localStorage.setItem(`sari_notes_${editing.id}`, String(editing.notes));
      }
      const saved = editing.id
        ? await cmsAdminUpdate<Person>('users', String(editing.id), payload)
        : await cmsAdminCreate<Person>('users', payload);
      showToast('Fiche enregistrée', 'success');
      setEditing(null);
      await load();
      if (saved?.id) setRows((prev) => prev.some((p) => p.id === saved.id) ? prev : [saved, ...prev]);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Supprimer ce ${singular} ?`)) return;
    try {
      await cmsAdminDelete('users', id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      showToast('Supprimé', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  const nameOf = (p: Person) => [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || '—';

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>CRM</div>
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{shown.length} {singular}(s)</p>
        </div>
        <div className="flex gap-2">
          <div className="flex" style={{ border: '1px solid var(--ad-line)' }}>
            <button type="button" className={`ad-btn ad-btn-icon ${view === 'list' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('list')}><ListIcon className="w-4 h-4" /></button>
            <button type="button" className={`ad-btn ad-btn-icon ${view === 'cards' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('cards')}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button className="ad-btn ad-btn-primary" onClick={() => setEditing({ type, status: 'active', firstName: '', lastName: '', email: '' })}>
            <Plus className="w-4 h-4" /> Nouveau {singular}
          </button>
        </div>
      </header>

      <div className="ad-card p-3 space-y-3 ad-rise">
        <SearchField value={draft} onChange={setDraft} onSubmit={() => setQ(draft)} showSubmit placeholder={`Rechercher un ${singular} (nom, e-mail, société…)…`} />
        <select className="ad-select sm:w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="pending">En attente</option>
          <option value="blocked">Bloqué</option>
        </select>
      </div>

      {loading ? <div className="ad-card"><PixelGridLoader label={title} /></div> : view === 'list' ? (
        <div className="ad-card overflow-x-auto">
          <table className="ad-table min-w-[720px]">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>{type === 'candidate' ? 'Poste' : 'Société'}</th>
                <th>Pays / IP</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={String(p.id)}>
                  <td className="font-bold">{nameOf(p)}</td>
                  <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>{p.email}</td>
                  <td>{type === 'candidate' ? String(p.position || '—') : String(p.company || '—')}</td>
                  <td><GeoBadge ip={p.ip} country={p.country} /></td>
                  <td><span className="ad-chip ad-chip-acc">{String(p.status || '')}</span></td>
                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Message" onClick={() => setMessageTo(p)}><MessageSquareText className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => setEditing({ ...p, notes: p.id ? localStorage.getItem(`sari_notes_${p.id}`) || '' : '' })}>Ouvrir</button>
                    {p.id && <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => remove(String(p.id))}><Trash2 className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>Aucun {singular}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((p) => (
            <article key={String(p.id)} className="ad-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}>
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black">{nameOf(p)}</div>
                  <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{p.email}</div>
                </div>
              </div>
              <p className="text-sm">{type === 'candidate' ? p.position : p.company}</p>
              <div className="flex gap-1">
                <button className="ad-btn ad-btn-ghost" onClick={() => setEditing({ ...p })}>Éditer</button>
                <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Message" onClick={() => setMessageTo(p)}><MessageSquareText className="w-4 h-4" /></button>
                {p.id && <button className="ad-btn ad-btn-icon ad-btn-danger ml-auto" onClick={() => remove(String(p.id))}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="ad-modal" onClick={() => setEditing(null)}>
          <div className="ad-modal-card space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black">{editing.id ? `Fiche ${singular}` : `Nouveau ${singular}`}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Prénom" required value={String(editing.firstName || '')} onChange={(v) => setEditing({ ...editing, firstName: v })} />
              <Field label="Nom" required value={String(editing.lastName || '')} onChange={(v) => setEditing({ ...editing, lastName: v })} />
              <Field label="Email" required value={String(editing.email || '')} onChange={(v) => setEditing({ ...editing, email: v })} />
              <Field label="Téléphone" value={String(editing.phone || '')} onChange={(v) => setEditing({ ...editing, phone: v })} />
              {type === 'candidate'
                ? <Field label="Poste visé" value={String(editing.position || '')} onChange={(v) => setEditing({ ...editing, position: v })} />
                : <Field label="Société" value={String(editing.company || '')} onChange={(v) => setEditing({ ...editing, company: v })} />}
              <Field label="Adresse IP" value={String(editing.ip || '')} onChange={(v) => setEditing({ ...editing, ip: v })} />
              {editing.ip && (
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Pays</span>
                  <GeoBadge ip={String(editing.ip)} />
                </label>
              )}
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Statut <span className="ad-chip ad-chip-mute">Optionnel</span></span>
                <select className="ad-select" value={String(editing.status || 'active')} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">Actif</option>
                  <option value="pending">En attente</option>
                  <option value="blocked">Bloqué</option>
                </select>
              </label>
            </div>
            {type === 'client' && editing.email && (
              <ClientStats email={String(editing.email)} />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="ad-btn ad-btn-ghost" onClick={() => setEditing(null)}>Fermer</button>
              <button className="ad-btn ad-btn-primary" disabled={saving} onClick={save}>{saving ? '…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {messageTo && (
        <MessageComposer
          email={String(messageTo.email || '')}
          name={nameOf(messageTo)}
          type={type}
          onClose={() => setMessageTo(null)}
        />
      )}
    </div>
  );
}

function ClientStats({ email }: { email: string }) {
  const orders = loadOrders().filter((o) => o.email === email);
  const quotes = loadQuotes().filter((q) => q.email === email);
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const inProgress = orders.filter((o) => o.status === 'processing' || o.status === 'shipped').length;
  const totalSpent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0);
  return (
    <div className="ad-card p-3 space-y-2 text-sm ad-rise">
      <div className="font-black flex items-center justify-between">
        <span>Activité commerciale</span>
        <span className="ad-chip ad-chip-ok">{delivered} livrées</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="ad-card p-2" style={{ background: 'var(--ad-surface-2)' }}>
          <div className="text-xl font-black">{orders.length}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>Commandes</div>
        </div>
        <div className="ad-card p-2" style={{ background: 'var(--ad-surface-2)' }}>
          <div className="text-xl font-black">{quotes.length}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>Devis</div>
        </div>
        <div className="ad-card p-2" style={{ background: 'var(--ad-surface-2)' }}>
          <div className="text-xl font-black">{totalSpent.toLocaleString()}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>DA cumulés</div>
        </div>
      </div>
      <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
        {inProgress} en cours · {money(orderRevenue(orders))} livrés
      </div>
      <div className="space-y-1">
        {orders.slice(0, 4).map((o) => (
          <div key={o.id} className="flex items-center justify-between border-b border-[var(--ad-line)] pb-1">
            <span>#{o.id} <span style={{ color: 'var(--ad-muted)' }}><DateText value={o.date} dateOnly /></span></span>
            <span className={`ad-chip ${o.status === 'delivered' ? 'ad-chip-ok' : o.status === 'cancelled' ? 'ad-chip-warn' : 'ad-chip-acc'}`}>{o.status}</span>
            <span className="font-bold tabular-nums">{money(Number(o.total || 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: 'var(--ad-muted)' }}>
        {label} {required ? <span className="ad-chip ad-chip-warn">Obligatoire</span> : <span className="ad-chip ad-chip-mute">Optionnel</span>}
      </span>
      <input className="ad-input" value={value} placeholder={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
