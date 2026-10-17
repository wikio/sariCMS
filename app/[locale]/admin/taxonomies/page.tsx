'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Plus, Pencil, Trash2 } from 'lucide-react';
import { allTaxonomies, removeTaxonomyTerm, saveTaxonomy, type TaxonomyTerm } from '@/lib/taxonomies';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';

export default function TaxonomiesPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState(allTaxonomies());
  const [tab, setTab] = useState(groups[0]?.key || 'products.category');
  const [draft, setDraft] = useState<TaxonomyTerm | null>(null);
  const [original, setOriginal] = useState<TaxonomyTerm | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');

  const refresh = () => setGroups(allTaxonomies());
  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener('sari-taxonomies', on);
    return () => window.removeEventListener('sari-taxonomies', on);
  }, []);

  const current = useMemo(() => groups.find((g) => g.key === tab) || groups[0], [groups, tab]);

  const persist = (terms: TaxonomyTerm[]) => {
    if (!current) return;
    saveTaxonomy(current.key, terms);
    refresh();
    showToast('Taxonomie enregistrée', 'success');
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="ad-breadcrumb">Configuration avancée / Taxonomies</div>
        <h1 className="text-3xl font-black tracking-tight">Configuration des taxonomies</h1>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Un onglet par famille. L’édition se fait dans un panneau latéral — plus d’édition inline.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button key={g.key} type="button" className={`ad-btn ${current?.key === g.key ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setTab(g.key)}>
            {g.label}
          </button>
        ))}
      </div>
      {current && (
        <section className="ad-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black">{current.label}</h2>
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{current.hint}</p>
            </div>
            <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setOriginal(null); setDraft({ value: '', label: '' }); }}><Plus className="w-4 h-4" /> Ajouter</button>
          </div>
          <table className="ad-table">
            <thead><tr><th>Valeur</th><th>Libellé</th><th></th></tr></thead>
            <tbody>
              {current.terms.map((t) => (
                <tr key={t.value}>
                  <td className="font-mono text-sm">{t.value}</td>
                  <td>{t.label}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setOriginal(t); setDraft({ ...t }); }}><Eye className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setOriginal(t); setDraft({ ...t }); }}><Pencil className="w-4 h-4" /> Modifier</button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => { removeTaxonomyTerm(current.key, t.value); refresh(); }}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Drawer
        open={!!draft && !!current}
        title={mode === 'consult' ? `Consultation · ${draft?.label}` : original ? 'Modifier le terme' : 'Nouveau terme'}
        onClose={() => setDraft(null)}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft || !current || !draft.value.trim()) return;
              const next = original
                ? current.terms.map((t) => (t.value === original.value ? { value: draft.value.trim(), label: draft.label.trim() || draft.value } : t))
                : [...current.terms, { value: draft.value.trim(), label: draft.label.trim() || draft.value }];
              persist(next);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Valeur</span>
              <input className="ad-input" disabled={mode === 'consult'} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="slug-interne" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Libellé</span>
              <input className="ad-input" disabled={mode === 'consult'} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Nom affiché" />
            </label>
          </>
        )}
      </Drawer>
    </div>
  );
}
