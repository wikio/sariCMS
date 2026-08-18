'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminDelete, cmsAdminList } from '@/lib/cms-admin';
import type { CmsModule } from '@/lib/cms-modules';
import { CmsError } from '@/lib/cms';

export default function CmsList({ mod }: { mod: CmsModule }) {
  const locale = useLocale();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const query: Record<string, string> = {
        filter: JSON.stringify({ locale, ...(mod.filter || {}) }),
      };
      setRows(await cmsAdminList(mod.resource, query));
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Chargement impossible', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mod.key, locale]);

  const shown = useMemo(() => {
    return rows.filter((row) => {
      for (const [k, v] of Object.entries(filters)) {
        if (v && String(row[k] ?? '') !== v) return false;
      }
      if (!q.trim()) return true;
      const blob = mod.searchKeys.map((k) => String(row[k] ?? '')).join(' ').toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [rows, filters, q, mod.searchKeys]);

  const remove = async (id: string) => {
    if (!confirm('Envoyer en corbeille ?')) return;
    try {
      await cmsAdminDelete(mod.resource, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      showToast('En corbeille', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  const Icon = mod.icon;

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            <Icon className="w-3.5 h-3.5" /> Consultation
          </div>
          <h1 className="text-3xl font-black tracking-tight">{mod.label}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{shown.length} fiche(s) · lecture seule</p>
        </div>
        <Link href={`/${locale}/admin/${mod.path}/new`} className="ad-btn ad-btn-primary">
          <Plus className="w-4 h-4" /> Nouveau {mod.singular}
        </Link>
      </header>

      <div className="ad-card p-3 ad-rise ad-rise-2 pixel-frame">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
            <input className="ad-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Rechercher un ${mod.singular}…`} />
          </div>
          {mod.filterKeys.map((f) => (
            <select key={f.key} className="ad-select lg:w-40" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
              <option value="">{f.label}</option>
              {(f.options || Array.from(new Set(rows.map((r) => String(r[f.key] || '')).filter(Boolean)))).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label={mod.label} /></div>
      ) : (
        <ListCanvas mod={mod} rows={shown} locale={locale} onDelete={remove} />
      )}
    </div>
  );
}

function ListCanvas({
  mod, rows, locale, onDelete,
}: {
  mod: CmsModule;
  rows: Record<string, unknown>[];
  locale: string;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <div className="ad-card p-12 text-center pixel-frame" style={{ color: 'var(--ad-muted)' }}>Aucune fiche. Créez un {mod.singular} ou importez le catalogue.</div>;
  }

  const card = (row: Record<string, unknown>) => {
    const title = String(row[mod.titleKey] || '—');
    const img = mod.imageKey ? String(row[mod.imageKey] || '') : '';
    const sub = mod.subtitleKey ? String(row[mod.subtitleKey] || '') : '';
    const badge = mod.badgeKey ? String(row[mod.badgeKey] || '') : '';
    return (
      <article key={String(row.id)} className="ad-card ad-tile overflow-hidden ad-rise">
        {img && (
          <div className="h-40 overflow-hidden relative">
            <img src={img} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-black leading-snug">{title}</h3>
              {sub && <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{sub}</p>}
            </div>
            {badge && <span className={`ad-chip ${badge === 'published' || badge === 'active' ? 'ad-chip-ok' : 'ad-chip-warn'}`}>{badge}</span>}
          </div>
          {mod.layout === 'quotes' && <p className="text-sm italic line-clamp-4">“{String(row.text || '')}”</p>}
          {mod.key === 'products' && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--ad-muted)' }}>{String(row.category || '')}</span>
              <span className="font-black" style={{ color: 'var(--ad-accent)' }}>{String(row.price || '')}</span>
            </div>
          )}
          {mod.key === 'careers' && (
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{String(row.type || '')} · {String(row.salary || '')}</div>
          )}
          <div className="flex gap-1 pt-2">
            <Link href={`/${locale}/admin/${mod.path}/${row.id}`} className="ad-btn ad-btn-ghost"><Pencil className="w-4 h-4" /> Éditer</Link>
            <button className="ad-btn ad-btn-danger ad-btn-icon ml-auto" onClick={() => onDelete(String(row.id))}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </article>
    );
  };

  if (mod.layout === 'timeline') {
    return (
      <div className="relative pl-7 space-y-4">
        <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: 'repeating-linear-gradient(to bottom, var(--ad-accent), var(--ad-accent) 6px, transparent 6px, transparent 12px)' }} />
        {rows.map((row) => (
          <div key={String(row.id)} className="relative">
            <span className="absolute -left-[1.4rem] top-4 w-3 h-3" style={{ background: 'var(--ad-accent-2)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--ad-accent-2) 30%, transparent)' }} />
            {card(row)}
          </div>
        ))}
      </div>
    );
  }

  if (mod.layout === 'slides') {
    return <div className="grid md:grid-cols-2 gap-4">{rows.map(card)}</div>;
  }

  if (mod.layout === 'docs') {
    return (
      <div className="ad-card overflow-hidden pixel-frame">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Meta</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td className="font-bold">{String(row[mod.titleKey])}</td>
                <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>{String(row[mod.subtitleKey || 'slug'] || '')}</td>
                <td><span className="ad-chip ad-chip-acc">{String(row.status || '')}</span></td>
                <td className="text-right">
                  <Link href={`/${locale}/admin/${mod.path}/${row.id}`} className="ad-btn ad-btn-ghost">Ouvrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map(card)}</div>;
}
