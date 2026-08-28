'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { couponStatus, generateCouponCode, loadCouponUses, loadCoupons, saveCoupons, type Coupon } from '@/lib/shop-store';
import { listTaxonomy } from '@/lib/taxonomies';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import TagInput from '@/components/admin/TagInput';
import SearchField from '@/components/admin/SearchField';

const empty = (): Coupon => ({
  id: `c-${Date.now()}`, code: generateCouponCode(), type: 'percent', amount: 10,
  start: new Date().toISOString().slice(0, 10), end: '', used: 0, scope: 'all',
  scopeValues: [], excludeValues: [], stackable: false, active: true, revenue: 0,
});

export default function CouponsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [draft, setDraft] = useState<Coupon | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [kind, setKind] = useState('');
  const [stack, setStack] = useState('');
  const [sort, setSort] = useState<'code' | 'status' | 'used' | 'revenue'>('code');
  const [selected, setSelected] = useState<string[]>([]);
  const cats = listTaxonomy('products.category').map((t) => t.label);
  const uses = loadCouponUses();

  useEffect(() => { setRows(loadCoupons()); }, []);

  const persist = (next: Coupon[], toast = 'Coupon enregistré') => {
    setRows(next);
    saveCoupons(next);
    showToast(toast, 'success');
    setDraft(null);
    setSelected([]);
  };

  const shown = useMemo(() => {
    const list = rows.filter((c) => {
      const status = couponStatus(c);
      if (st && status !== st) return false;
      if (kind && c.type !== kind) return false;
      if (stack && String(c.stackable) !== stack) return false;
      if (q && !`${c.code} ${c.scopeValues.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === 'used') return b.used - a.used;
      if (sort === 'revenue') return b.revenue - a.revenue;
      if (sort === 'status') return couponStatus(a).localeCompare(couponStatus(b));
      return a.code.localeCompare(b.code);
    });
  }, [rows, q, st, kind, stack, sort]);

  const chip = (status: string) => status === 'actif' ? 'ad-chip-ok' : status === 'à venir' ? 'ad-chip-warn' : 'ad-chip-mute';

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Coupons</div>
          <h1 className="text-3xl font-black">Coupons / codes promo</h1>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" /> Nouveau</button>
      </header>

      <div className="ad-card p-3 space-y-3">
        <SearchField value={q} onChange={setQ} onSubmit={() => undefined} showSubmit placeholder="Rechercher un code ou une cible…" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <select className="ad-select" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">Tous les statuts</option>
          {['actif', 'à venir', 'expiré', 'épuisé', 'inactif'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="ad-select" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="percent">Pourcentage</option>
          <option value="fixed">Montant fixe</option>
        </select>
        <select className="ad-select" value={stack} onChange={(e) => setStack(e.target.value)}>
          <option value="">Cumulable ?</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
        <select className="ad-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="code">Tri : code</option>
          <option value="status">Tri : statut</option>
          <option value="used">Tri : usages</option>
          <option value="revenue">Tri : CA</option>
        </select>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r), 'Activés')}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r), 'Désactivés')}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)), 'Supprimés')}>Supprimer</button>
        </div>
      )}

      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.length === shown.length && shown.length > 0} onChange={(e) => setSelected(e.target.checked ? shown.map((r) => r.id) : [])} /></th>
              <th>Code</th><th>Réduction</th><th>Usages</th><th>CA</th><th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const status = couponStatus(c);
              return (
                <tr key={c.id}>
                  <td><input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} /></td>
                  <td className="font-mono font-bold">{c.code}</td>
                  <td>{c.type === 'percent' ? `${c.amount} %` : `${c.amount} DA`}</td>
                  <td>{c.used}/{c.limitGlobal || '∞'}</td>
                  <td>{c.revenue.toLocaleString()} DA</td>
                  <td><span className={`ad-chip ${chip(status)}`}>{status}</span></td>
                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...c }); }}><Eye className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setDraft({ ...c }); }}><Pencil className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-ghost" onClick={() => persist([{ ...c, id: `c-${Date.now()}`, code: generateCouponCode(), used: 0, revenue: 0 }, ...rows], 'Dupliqué')}><Copy className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== c.id), 'Supprimé')}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.code}` : draft?.code || 'Nouveau coupon'}
        onClose={() => setDraft(null)}
        width={560}
        footer={mode === 'consult' ? (
          <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button>
        ) : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft) return;
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Code</span>
              <div className="flex gap-2">
                <input className="ad-input font-mono" disabled={mode === 'consult'} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
                {mode === 'edit' && <button className="ad-btn ad-btn-ghost" onClick={() => setDraft({ ...draft, code: generateCouponCode() })}>Auto</button>}
              </div>
              <p className="ad-field-hint">Saisie manuelle ou génération aléatoire (SARI + 6 caractères).</p>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Type de réduction</span>
              <select className="ad-select" disabled={mode === 'consult'} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Coupon['type'] })}>
                <option value="percent">Pourcentage</option>
                <option value="fixed">Montant fixe</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Valeur</span>
                <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Plafond (si %)</span>
                <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.maxDiscount || ''} onChange={(e) => setDraft({ ...draft, maxDiscount: Number(e.target.value) })} />
                <p className="ad-field-hint">Montant max remisé pour un coupon en %.</p>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Minimum de commande</span>
              <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.minOrder || ''} onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5"><span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Début</span><input className="ad-input" type="date" disabled={mode === 'consult'} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label>
              <label className="space-y-1.5"><span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Fin</span><input className="ad-input" type="date" disabled={mode === 'consult'} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5"><span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Limite globale</span><input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.limitGlobal || ''} onChange={(e) => setDraft({ ...draft, limitGlobal: Number(e.target.value) })} /></label>
              <label className="space-y-1.5"><span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Limite / client</span><input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.limitPerClient || ''} onChange={(e) => setDraft({ ...draft, limitPerClient: Number(e.target.value) })} /></label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Cible</span>
              <select className="ad-select" disabled={mode === 'consult'} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Coupon['scope'], scopeValues: [] })}>
                <option value="all">Tous les produits</option>
                <option value="category">Catégories spécifiques</option>
                <option value="product">Produits spécifiques</option>
              </select>
            </label>
            {draft.scope !== 'all' && (
              <TagInput values={draft.scopeValues} onChange={(scopeValues) => setDraft({ ...draft, scopeValues })} suggestions={draft.scope === 'category' ? cats : ['Échographe Portable Pro', 'Défibrillateur DSA Premium', 'Autoclave Classe B 23L']} />
            )}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Exclusions</span>
              <TagInput values={draft.excludeValues} onChange={(excludeValues) => setDraft({ ...draft, excludeValues })} suggestions={cats} placeholder="Produits / catégories exclus…" />
              <p className="ad-field-hint">Utile pour exclure les articles déjà en promotion.</p>
            </label>
            <Toggle on={draft.stackable} onChange={(stackable) => setDraft({ ...draft, stackable })} label="Cumulable" hint="Si oui, ce coupon peut se combiner avec un autre code." disabled={mode === 'consult'} />
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Actif" hint="Un coupon inactif n’est plus applicable, même dans sa période." disabled={mode === 'consult'} />

            <div className="pt-2">
              <h4 className="ad-section-title">Historique d’utilisation</h4>
              <table className="ad-table">
                <thead><tr><th>Commande</th><th>Client</th><th>Date</th><th>Remise</th></tr></thead>
                <tbody>
                  {uses.filter((u) => u.couponId === draft.id || u.code === draft.code).map((u) => (
                    <tr key={u.id}><td>#{u.orderId}</td><td>{u.client}</td><td>{u.date}</td><td>{u.discount.toLocaleString()} DA</td></tr>
                  ))}
                  {uses.filter((u) => u.couponId === draft.id || u.code === draft.code).length === 0 && (
                    <tr><td colSpan={4} style={{ color: 'var(--ad-muted)' }}>Aucune utilisation encore.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
