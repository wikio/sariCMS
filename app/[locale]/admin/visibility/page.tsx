'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Search } from 'lucide-react';
import {
  loadVisibility, resetVisibility, setVisibility, setVisibilityGroup,
  useVisibility, VISIBILITY_GROUPS,
} from '@/lib/site-visibility';
import { useToast } from '@/components/admin/Toast';

export default function VisibilityPage() {
  const { showToast } = useToast();
  const vis = useVisibility();
  const [q, setQ] = useState('');

  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => VISIBILITY_GROUPS.map((g) => ({
    ...g,
    items: needle
      ? g.items.filter((i) => `${i.label} ${i.key}`.toLowerCase().includes(needle))
      : g.items,
  })).filter((g) => g.items.length > 0), [needle]);

  const visibleCount = Object.values(vis).filter(Boolean).length;
  const totalCount = Object.values(vis).length;

  return (
    <div className="space-y-4">
      <header className="ad-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="ad-breadcrumb">Configuration avancée / Visibilité vitrine</div>
          <h1 className="text-3xl font-black tracking-tight">Visibilité de la vitrine</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
            Affichez ou masquez menus, pages, modules, sections, boutons et actions — {visibleCount}/{totalCount} actifs.
          </p>
        </div>
        <button
          type="button"
          className="ad-btn ad-btn-ghost"
          onClick={() => { resetVisibility(); showToast('Visibilité réinitialisée', 'success'); }}
        >
          <RotateCcw className="w-4 h-4" /> Réinitialiser
        </button>
      </header>

      <div className="ad-card p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
          <input className="ad-input ad-input-icon pl-9" placeholder="Rechercher un élément…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {groups.map((g) => {
          const allOn = g.items.every((i) => vis[i.key]);
          const allOff = g.items.every((i) => !vis[i.key]);
          return (
            <section key={g.key} className="ad-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">{g.label}</h2>
                  <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{g.items.length} élément(s)</p>
                </div>
                <button
                  type="button"
                  className={`ad-btn ${allOn ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                  onClick={() => { setVisibilityGroup(g.key, !allOn); showToast(`${g.label} ${!allOn ? 'affiché(s)' : 'masqué(s)'}`, 'success'); }}
                >
                  {allOn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {allOn ? 'Tout masquer' : allOff ? 'Tout afficher' : 'Tout afficher'}
                </button>
              </div>
              <div className="space-y-1">
                {g.items.map((i) => (
                  <div key={i.key} className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--ad-line)' }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        {vis[i.key] ? <Eye className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} /> : <EyeOff className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />}
                        {i.label}
                      </div>
                      {i.hint && <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{i.hint}</div>}
                      <div className="text-[10px] font-mono opacity-50">{i.key}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVisibility(i.key, !vis[i.key])}
                      className={`ad-toggle ${vis[i.key] ? 'is-on' : ''}`}
                      aria-pressed={vis[i.key]}
                      role="switch"
                    >
                      {vis[i.key] ? (<><span className="ad-toggle-label">Visible</span><span className="ad-toggle-knob" /></>) : (<><span className="ad-toggle-knob" /><span className="ad-toggle-label">Masqué</span></>)}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {groups.length === 0 && (
          <div className="col-span-full ad-card p-10 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun élément ne correspond à « {q} ».</div>
        )}
      </div>
    </div>
  );
}
