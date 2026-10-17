'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import SearchField from '@/components/admin/SearchField';
import ProcessFlow from '@/components/admin/ProcessFlow';
import { DEMO_APPLICATIONS, DEMO_FLAG } from '@/lib/demo-seed';

type AppRow = {
  id: number;
  candidate: string;
  email: string;
  phone: string;
  jobTitle: string;
  status: string;
  date: string;
  experience: string;
  motivation: string;
  history?: Array<{ status: string; at: string; note?: string }>;
};

const STEPS = [
  { value: 'new', label: 'Nouvelle' },
  { value: 'reviewed', label: 'Examinée' },
  { value: 'interview', label: 'Entretien' },
  { value: 'accepted', label: 'Acceptée' },
  { value: 'rejected', label: 'Refusée' },
];

const SEED: AppRow[] = DEMO_APPLICATIONS;

export default function AdminApplicationsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<AppRow[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<AppRow | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('sari_applications');
    if (stored && !localStorage.getItem(DEMO_FLAG)) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= SEED.length) { setRows(parsed); return; }
      } catch { /* */ }
    }
    if (stored && localStorage.getItem(DEMO_FLAG)) {
      try { setRows(JSON.parse(stored)); return; } catch { /* */ }
    }
    setRows(SEED);
    localStorage.setItem('sari_applications', JSON.stringify(SEED));
  }, []);

  const persist = (next: AppRow[]) => {
    setRows(next);
    localStorage.setItem('sari_applications', JSON.stringify(next));
  };

  const shown = useMemo(() => rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (!q.trim()) return true;
    return `${r.candidate} ${r.jobTitle} ${r.email}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, q, status]);

  const historyOf = (name: string) => rows.filter((r) => r.candidate === name);

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>RH</div>
        <h1 className="text-3xl font-black">Candidatures</h1>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STEPS.map((s) => (
          <div key={s.value} className="ad-card p-3">
            <div className="text-2xl font-black">{rows.filter((r) => r.status === s.value).length}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="ad-card p-3 flex flex-col lg:flex-row gap-2">
        <SearchField className="flex-1" value={q} onChange={setQ} placeholder="Candidat, poste…" />
        <select className="ad-select lg:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th>Candidat</th><th>Poste</th><th>Date</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="font-bold">{row.candidate}<div className="text-xs font-normal" style={{ color: 'var(--ad-muted)' }}>{row.email}</div></td>
                <td>{row.jobTitle}</td>
                <td>{row.date}</td>
                <td><span className="ad-chip ad-chip-acc">{row.status}</span></td>
                <td className="text-right">
                  <button className="ad-btn ad-btn-ghost" onClick={() => setOpen(row)}><Eye className="w-4 h-4" /> Voir</button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => persist(rows.filter((r) => r.id !== row.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="ad-modal" onClick={() => setOpen(null)}>
          <div className="ad-modal-card space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black">{open.candidate}</h2>
            <p className="text-sm">{open.jobTitle} · {open.experience}</p>
            <p className="text-sm">{open.motivation}</p>
            <ProcessFlow
              current={open.status}
              steps={STEPS.map((s) => ({
                id: s.value,
                label: s.label,
                done: STEPS.findIndex((x) => x.value === open.status) > STEPS.findIndex((x) => x.value === s.value),
              }))}
            />
            <div className="flex flex-wrap gap-1">
              {STEPS.map((s) => (
                <button key={s.value} className={`ad-btn ${open.status === s.value ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => {
                  const next = rows.map((r) => r.id === open.id ? { ...r, status: s.value, history: [...(r.history || []), { status: s.value, at: new Date().toISOString(), note }] } : r);
                  persist(next);
                  setOpen(next.find((r) => r.id === open.id) || null);
                  setNote('');
                  showToast('Étape mise à jour', 'success');
                }}>{s.label}</button>
              ))}
            </div>
            <input className="ad-input" placeholder="Commentaire RH…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="text-sm">
              <div className="font-black mb-1">Historique du candidat</div>
              {historyOf(open.candidate).map((h) => <div key={h.id}>{h.date} · {h.jobTitle} · {h.status}</div>)}
            </div>
            <div className="flex justify-end"><button className="ad-btn ad-btn-ghost" onClick={() => setOpen(null)}>Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
