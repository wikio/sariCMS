'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { loadMessages, saveMessages, MERGE_VARS, TRIGGERS, type NotifyMessage } from '@/lib/notify-store';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import SearchField from '@/components/admin/SearchField';

const empty = (): NotifyMessage => ({
  id: `m-${Date.now()}`, name: '', trigger: 'stock_backorder', subject: '', body: '<p></p>', active: true, locale: 'fr',
});

export default function MessagesPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<NotifyMessage[]>([]);
  const [draft, setDraft] = useState<NotifyMessage | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [q, setQ] = useState('');
  const [trigger, setTrigger] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => { setRows(loadMessages()); }, []);
  const persist = (next: NotifyMessage[], toast = 'Message enregistré') => {
    setRows(next); saveMessages(next); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };
  const shown = useMemo(() => rows.filter((m) => {
    if (trigger && m.trigger !== trigger) return false;
    if (q && !`${m.name} ${m.subject} ${m.trigger}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, trigger]);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">Configuration avancée / Messages</div>
          <h1 className="text-3xl font-black">Messages / modèles de notification</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" /> Nouveau</button>
      </header>
      <div className="ad-card p-3 grid md:grid-cols-2 gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Nom, sujet, déclencheur…" />
        <select className="ad-select" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="">Tous les déclencheurs</option>
          {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r))}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r))}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)))}>Supprimer</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>Nom</th><th>Déclencheur</th><th>Langue</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td><input type="checkbox" checked={selected.includes(m.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id))} /></td>
                <td className="font-bold">{m.name}</td>
                <td>{TRIGGERS.find((t) => t.value === m.trigger)?.label || m.trigger}</td>
                <td>{m.locale.toUpperCase()}</td>
                <td><span className={`ad-chip ${m.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{m.active ? 'Actif' : 'Inactif'}</span></td>
                <td className="text-right">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...m }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setDraft({ ...m }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== m.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.name}` : 'Modèle de message'}
        onClose={() => setDraft(null)}
        width={680}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft?.name.trim()) return;
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Nom interne" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="ad-select" disabled={mode === 'consult'} value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}>
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="ad-select" disabled={mode === 'consult'} value={draft.locale} onChange={(e) => setDraft({ ...draft, locale: e.target.value })}>
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Sujet" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            <HtmlEditor value={draft.body} onChange={(body) => setDraft({ ...draft, body })} readOnly={mode === 'consult'} mergeVars />
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Actif" disabled={mode === 'consult'} />
          </>
        )}
      </Drawer>
    </div>
  );
}
