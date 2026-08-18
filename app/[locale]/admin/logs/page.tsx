'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { cmsAdminFetch } from '@/lib/cms-admin';
import { unwrapList } from '@/lib/cms';

type LogRow = {
  id?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  actorId?: string;
  ip?: string;
  createdAt?: string;
};

export default function LogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [resource, setResource] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const payload = await cmsAdminFetch<unknown>('/audit-logs?limit=80&sortBy=createdAt&sortOrder=desc');
        setRows(unwrapList<LogRow>(payload));
      } catch {
        setError('Journal d’audit indisponible. Vérifiez l’API et le droit audit:read.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resources = Array.from(new Set(rows.map((r) => String(r.resource || '')).filter(Boolean)));
  const shown = useMemo(() => rows.filter((r) => {
    if (resource && r.resource !== resource) return false;
    if (!q.trim()) return true;
    return `${r.action} ${r.resource} ${r.resourceId} ${r.actorId}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, q, resource]);

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Pilotage</div>
        <h1 className="text-3xl font-black tracking-tight">Journaux</h1>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Audit immuable des actions administrateur.</p>
      </header>

      <div className="ad-card p-3 flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
          <input className="ad-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action, ressource, acteur…" />
        </div>
        <select className="ad-select lg:w-48" value={resource} onChange={(e) => setResource(e.target.value)}>
          <option value="">Toutes les ressources</option>
          {resources.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label="Journaux" /></div>
      ) : error ? (
        <div className="ad-card p-8 text-center" style={{ color: 'var(--ad-muted)' }}>{error}</div>
      ) : (
        <div className="ad-card overflow-hidden">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Ressource</th>
                <th>Cible</th>
                <th>Acteur</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={String(row.id)}>
                  <td className="text-sm whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                  <td><span className="ad-chip ad-chip-acc">{row.action}</span></td>
                  <td>{row.resource}</td>
                  <td className="font-mono text-xs">{row.resourceId || '—'}</td>
                  <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>{row.actorId || '—'}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>Aucune entrée</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
