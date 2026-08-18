'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { allTaxonomies, removeTaxonomyTerm, saveTaxonomy, type TaxonomyTerm } from '@/lib/taxonomies';
import { useToast } from '@/components/admin/Toast';

export default function TaxonomiesPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState(allTaxonomies());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = () => setGroups(allTaxonomies());
  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener('sari-taxonomies', on);
    return () => window.removeEventListener('sari-taxonomies', on);
  }, []);

  const add = (key: string) => {
    const label = (drafts[key] || '').trim();
    if (!label) return;
    const group = groups.find((g) => g.key === key);
    const terms: TaxonomyTerm[] = [...(group?.terms || []), { value: label, label }];
    saveTaxonomy(key, terms);
    setDrafts((p) => ({ ...p, [key]: '' }));
    refresh();
    showToast('Terme ajouté', 'success');
  };

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Système</div>
        <h1 className="text-3xl font-black tracking-tight">Taxonomies</h1>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Catégories et types réutilisés dans les sélecteurs (autocomplete + ajout rapide).</p>
      </header>
      <div className="grid lg:grid-cols-2 gap-3">
        {groups.map((g) => (
          <section key={g.key} className="ad-card p-4 space-y-3 ad-rise">
            <div>
              <h2 className="font-black">{g.label}</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{g.hint}</p>
            </div>
            <div className="space-y-1">
              {g.terms.map((t) => (
                <div key={t.value} className="flex items-center justify-between gap-2 px-2 py-1" style={{ border: '1px solid var(--ad-line)' }}>
                  <span className="text-sm font-semibold">{t.label}</span>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => { removeTaxonomyTerm(g.key, t.value); refresh(); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {g.terms.length === 0 && <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Aucun terme</p>}
            </div>
            <div className="flex gap-2">
              <input
                className="ad-input"
                placeholder="Nouveau terme…"
                value={drafts[g.key] || ''}
                onChange={(e) => setDrafts((p) => ({ ...p, [g.key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && add(g.key)}
              />
              <button className="ad-btn ad-btn-primary" onClick={() => add(g.key)}><Plus className="w-4 h-4" /></button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
