'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownAZ, ArrowUpAZ, Check, GripVertical, Pencil, Plus, RefreshCw,
  Search, SlidersHorizontal, Table2, LayoutGrid, Trash2, X, Save, Eye,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import {
  cmsAdminAutocomplete,
  cmsAdminCreate,
  cmsAdminDelete,
  cmsAdminList,
  cmsAdminUpdate,
  extraFiltersForType,
  newItemDraft,
} from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';

export type CrudVariant =
  | 'catalog'
  | 'magazine'
  | 'timeline'
  | 'logos'
  | 'slides'
  | 'people'
  | 'quotes'
  | 'jobs'
  | 'tiles'
  | 'table';

export interface ModuleCrudConfig {
  resource: string;
  dataType: string;
  label: string;
  variant: CrudVariant;
  titleField: string;
  imageField?: string;
  subtitleField?: string;
  searchHint?: string;
  filters: Array<{ key: string; label: string; options?: string[] }>;
  sortKeys: Array<{ key: string; label: string }>;
  inlineFields: string[];
  orderField?: string;
  autocompleteField?: string;
}

const STATUS_OPTS = ['draft', 'published', 'archived'];

export const MODULE_CRUD: Record<string, ModuleCrudConfig> = {
  products: {
    resource: 'products', dataType: 'products', label: 'Produits', variant: 'catalog',
    titleField: 'name', imageField: 'image', subtitleField: 'category',
    searchHint: 'Nom, catégorie, SKU…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }, { key: 'category', label: 'Catégorie' }],
    sortKeys: [{ key: 'name', label: 'Nom' }, { key: 'price', label: 'Prix' }, { key: 'updatedAt', label: 'Modifié' }],
    inlineFields: ['name', 'price', 'inStock', 'status'],
    autocompleteField: 'name',
  },
  services: {
    resource: 'services', dataType: 'services', label: 'Services', variant: 'tiles',
    titleField: 'title', subtitleField: 'icon',
    searchHint: 'Titre du service…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }],
    sortKeys: [{ key: 'sortOrder', label: 'Ordre' }, { key: 'title', label: 'Titre' }],
    inlineFields: ['title', 'icon', 'status'],
    orderField: 'sortOrder',
    autocompleteField: 'title',
  },
  careers: {
    resource: 'careers', dataType: 'careers', label: 'Offres', variant: 'jobs',
    titleField: 'title', subtitleField: 'location',
    searchHint: 'Poste, ville, type…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }, { key: 'type', label: 'Contrat' }],
    sortKeys: [{ key: 'title', label: 'Poste' }, { key: 'updatedAt', label: 'Modifié' }],
    inlineFields: ['title', 'location', 'salary', 'status'],
    autocompleteField: 'title',
  },
  news: {
    resource: 'news', dataType: 'news', label: 'Actualités', variant: 'magazine',
    titleField: 'title', imageField: 'image', subtitleField: 'category',
    searchHint: 'Titre, auteur, sujet…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }, { key: 'category', label: 'Catégorie' }],
    sortKeys: [{ key: 'date', label: 'Date' }, { key: 'title', label: 'Titre' }],
    inlineFields: ['title', 'authorName', 'status'],
    autocompleteField: 'title',
  },
  events: {
    resource: 'events', dataType: 'events', label: 'Événements', variant: 'timeline',
    titleField: 'title', imageField: 'image', subtitleField: 'date',
    searchHint: 'Événement, lieu…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }, { key: 'type', label: 'Type' }],
    sortKeys: [{ key: 'date', label: 'Date' }, { key: 'title', label: 'Titre' }],
    inlineFields: ['title', 'location', 'status'],
    autocompleteField: 'title',
  },
  testimonials: {
    resource: 'testimonials', dataType: 'testimonials', label: 'Témoignages', variant: 'quotes',
    titleField: 'name', imageField: 'image', subtitleField: 'clinic',
    searchHint: 'Nom, clinique…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }],
    sortKeys: [{ key: 'sortOrder', label: 'Ordre' }, { key: 'rating', label: 'Note' }],
    inlineFields: ['name', 'rating', 'status'],
    orderField: 'sortOrder',
  },
  partners: {
    resource: 'partners', dataType: 'partners', label: 'Partenaires', variant: 'logos',
    titleField: 'name', imageField: 'logo', subtitleField: 'category',
    searchHint: 'Nom partenaire…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }, { key: 'category', label: 'Catégorie' }],
    sortKeys: [{ key: 'sortOrder', label: 'Ordre' }, { key: 'name', label: 'Nom' }],
    inlineFields: ['name', 'category', 'status'],
    orderField: 'sortOrder',
  },
  'solution-categories': {
    resource: 'solutions', dataType: 'solution-categories', label: 'Solutions', variant: 'tiles',
    titleField: 'title', imageField: 'image', subtitleField: 'slug',
    searchHint: 'Solution…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }],
    sortKeys: [{ key: 'sortOrder', label: 'Ordre' }, { key: 'title', label: 'Titre' }],
    inlineFields: ['title', 'color', 'status'],
    orderField: 'sortOrder',
    autocompleteField: 'title',
  },
  hero: {
    resource: 'hero', dataType: 'hero', label: 'Hero', variant: 'slides',
    titleField: 'title', imageField: 'image', subtitleField: 'cta',
    searchHint: 'Slide…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }],
    sortKeys: [{ key: 'sortOrder', label: 'Ordre' }],
    inlineFields: ['title', 'cta', 'status'],
    orderField: 'sortOrder',
  },
  genericContent: {
    resource: 'pages', dataType: 'genericContent', label: 'Pages génériques', variant: 'table',
    titleField: 'title', subtitleField: 'subtype',
    searchHint: 'Page…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }],
    sortKeys: [{ key: 'updatedAt', label: 'Modifié' }, { key: 'title', label: 'Titre' }],
    inlineFields: ['title', 'status'],
    autocompleteField: 'title',
  },
  legal: {
    resource: 'pages', dataType: 'legal', label: 'Pages légales', variant: 'table',
    titleField: 'title', subtitleField: 'slug',
    searchHint: 'Mentions, CGV…',
    filters: [{ key: 'status', label: 'Statut', options: STATUS_OPTS }],
    sortKeys: [{ key: 'title', label: 'Titre' }],
    inlineFields: ['title', 'status'],
  },
  menu: {
    resource: 'menus', dataType: 'menu', label: 'Menus', variant: 'table',
    titleField: 'name', subtitleField: 'location',
    searchHint: 'Menu…',
    filters: [{ key: 'status', label: 'Statut', options: ['draft', 'published'] }],
    sortKeys: [{ key: 'location', label: 'Emplacement' }],
    inlineFields: ['name', 'status'],
  },
  users: {
    resource: 'users', dataType: 'users', label: 'Utilisateurs', variant: 'people',
    titleField: 'email', subtitleField: 'type',
    searchHint: 'Email, nom, société…',
    filters: [
      { key: 'type', label: 'Type', options: ['admin', 'client', 'partner', 'candidate'] },
      { key: 'status', label: 'Statut', options: ['active', 'pending', 'blocked'] },
    ],
    sortKeys: [{ key: 'createdAt', label: 'Créé' }, { key: 'email', label: 'Email' }],
    inlineFields: ['status', 'type'],
  },
};

function titleOf(row: Record<string, unknown>, cfg: ModuleCrudConfig) {
  return String(row[cfg.titleField] || row.title || row.name || row.email || '—');
}

export default function AdminCrud({
  dataType,
  locale,
}: {
  dataType: string;
  locale: string;
}) {
  const cfg = MODULE_CRUD[dataType] || MODULE_CRUD.genericContent;
  const { showToast } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [autoHits, setAutoHits] = useState<Array<{ id: string; value: string }>>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState(cfg.sortKeys[0]?.key || 'updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [view, setView] = useState<'smart' | 'table'>('smart');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inline, setInline] = useState<{ id: string; field: string; value: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await cmsAdminList(cfg.resource, extraFiltersForType(cfg.dataType, locale));
      setRows(list as Record<string, unknown>[]);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Chargement impossible', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dataType, locale]);

  useEffect(() => {
    if (!cfg.autocompleteField || q.length < 2) {
      setAutoHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setAutoHits(await cmsAdminAutocomplete(cfg.resource, q, cfg.autocompleteField));
    }, 220);
    return () => clearTimeout(t);
  }, [q, cfg.resource, cfg.autocompleteField]);

  const filtered = useMemo(() => {
    let list = [...rows];
    for (const [k, v] of Object.entries(filters)) {
      if (v) list = list.filter((r) => String(r[k] ?? '') === v);
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
    }
    list.sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
    });
    return list;
  }, [rows, filters, q, sortKey, sortDir]);

  const dynamicOptions = (key: string) =>
    Array.from(new Set(rows.map((r) => String(r[key] || '')).filter(Boolean))).slice(0, 20);

  const persistInline = async () => {
    if (!inline) return;
    try {
      const updated = await cmsAdminUpdate(cfg.resource, inline.id, { [inline.field]: coerce(inline.value) });
      setRows((prev) => prev.map((r) => (r.id === inline.id ? { ...r, ...updated } : r)));
      setInline(null);
      showToast('Cellule enregistrée', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  const saveEditor = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = { ...editing, locale: editing.locale || locale };
      const saved = editing.id
        ? await cmsAdminUpdate(cfg.resource, String(editing.id), payload)
        : await cmsAdminCreate(cfg.resource, payload);
      await load();
      setEditing(saved as Record<string, unknown>);
      setDirty(false);
      showToast('Enregistré dans le CMS', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    try {
      const created = await cmsAdminCreate(cfg.resource, newItemDraft(cfg.resource, locale));
      setRows((prev) => [created as Record<string, unknown>, ...prev]);
      setEditing(created as Record<string, unknown>);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Création impossible', 'error');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Envoyer en corbeille ?')) return;
    try {
      await cmsAdminDelete(cfg.resource, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (editing?.id === id) setEditing(null);
      showToast('En corbeille', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  const onDrop = async (targetId: string) => {
    if (!dragId || !cfg.orderField || dragId === targetId) return;
    const next = [...filtered];
    const from = next.findIndex((r) => r.id === dragId);
    const to = next.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRows(next);
    setDragId(null);
    await Promise.all(next.map((r, i) => cmsAdminUpdate(cfg.resource, String(r.id), { [cfg.orderField!]: i })));
    showToast('Ordre mis à jour', 'success');
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-4">
      <header className="ad-card p-4 ad-rise flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--ad-muted)' }}>
            Module · {cfg.variant}
          </div>
          <h1 className="text-2xl font-black tracking-tight">{cfg.label}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{filtered.length} / {rows.length} fiches</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={load}><RefreshCw className="w-4 h-4" /> Recharger</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => setView(view === 'smart' ? 'table' : 'smart')}>
            {view === 'smart' ? <Table2 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            {view === 'smart' ? 'Table' : 'Vue module'}
          </button>
          <button className="ad-btn ad-btn-primary" onClick={add}><Plus className="w-4 h-4" /> Nouveau</button>
        </div>
      </header>

      <div className="ad-card p-3 ad-rise ad-rise-2">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
            <input className="ad-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={cfg.searchHint || 'Recherche avancée…'} />
            {autoHits.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 ad-card overflow-hidden">
                {autoHits.map((h) => (
                  <button key={h.id} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]" onClick={() => { setQ(h.value); setAutoHits([]); }}>
                    {h.value}
                  </button>
                ))}
              </div>
            )}
          </div>
          {cfg.filters.map((f) => (
            <select key={f.key} className="ad-select lg:w-40" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
              <option value="">{f.label}</option>
              {(f.options || dynamicOptions(f.key)).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ))}
          <button className="ad-btn ad-btn-ghost" onClick={() => { setQ(''); setFilters({}); }}>
            <SlidersHorizontal className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label="Sync CMS" /></div>
      ) : view === 'table' ? (
        <div className="ad-card overflow-x-auto ad-rise ad-rise-3">
          <table className="ad-table">
            <thead>
              <tr>
                {cfg.orderField && <th />}
                <th onClick={() => toggleSort(cfg.titleField)}>{cfg.titleField} {sortIcon(sortKey, cfg.titleField, sortDir)}</th>
                {cfg.inlineFields.filter((f) => f !== cfg.titleField).map((f) => (
                  <th key={f} onClick={() => toggleSort(f)}>{f} {sortIcon(sortKey, f, sortDir)}</th>
                ))}
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={String(row.id)}
                  draggable={Boolean(cfg.orderField)}
                  onDragStart={() => setDragId(String(row.id))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(String(row.id))}
                >
                  {cfg.orderField && <td className="w-8 opacity-40"><GripVertical className="w-4 h-4" /></td>}
                  <td className="font-semibold">{titleOf(row, cfg)}</td>
                  {cfg.inlineFields.filter((f) => f !== cfg.titleField).map((f) => (
                    <td key={f}>
                      {inline && inline.id === row.id && inline.field === f ? (
                        <input
                          autoFocus
                          className="ad-input py-1"
                          value={inline.value}
                          onChange={(e) => setInline({ id: String(row.id), field: f, value: e.target.value })}
                          onBlur={persistInline}
                          onKeyDown={(e) => e.key === 'Enter' && persistInline()}
                        />
                      ) : (
                        <button className="text-left" onClick={() => setInline({ id: String(row.id), field: f, value: String(row[f] ?? '') })}>
                          {String(row[f] ?? '—')}
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setEditing(row)}><Pencil className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => remove(String(row.id))}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SmartGrid cfg={cfg} rows={filtered} onEdit={setEditing} onDelete={remove} onDrop={onDrop} setDragId={setDragId} onInline={(row, field) => setInline({ id: String(row.id), field, value: String(row[field] ?? '') })} inline={inline} persistInline={persistInline} setInline={setInline} />
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="ad-card w-full max-w-3xl max-h-[90vh] overflow-y-auto ad-scroll p-6 ad-rise">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">Édition · {titleOf(editing, cfg)}</h2>
              <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(editing).filter(([k]) => !['createdAt','updatedAt','deletedAt','createdBy','updatedBy','id'].includes(k)).map(([field, value]) => (
                <label key={field} className={typeof value === 'object' ? 'md:col-span-2 text-sm font-semibold' : 'text-sm font-semibold'}>
                  <span className="block mb-1 capitalize" style={{ color: 'var(--ad-muted)' }}>{field}</span>
                  {typeof value === 'boolean' ? (
                    <input type="checkbox" checked={Boolean(value)} onChange={(e) => { setEditing({ ...editing, [field]: e.target.checked }); setDirty(true); }} />
                  ) : typeof value === 'object' ? (
                    <textarea className="ad-textarea font-mono text-xs" rows={5} value={JSON.stringify(value, null, 2)} onChange={(e) => { try { setEditing({ ...editing, [field]: JSON.parse(e.target.value) }); setDirty(true); } catch { /* */ } }} />
                  ) : String(field).match(/desc|content|text|html/i) ? (
                    <textarea className="ad-textarea" rows={4} value={String(value ?? '')} onChange={(e) => { setEditing({ ...editing, [field]: e.target.value }); setDirty(true); }} />
                  ) : (
                    <input className="ad-input" value={String(value ?? '')} onChange={(e) => { setEditing({ ...editing, [field]: e.target.value }); setDirty(true); }} />
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="ad-btn ad-btn-ghost" onClick={() => setEditing(null)}>Fermer</button>
              <button className="ad-btn ad-btn-primary" disabled={!dirty || saving} onClick={saveEditor}>
                <Save className="w-4 h-4" /> {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sortIcon(current: string, key: string, dir: 'asc' | 'desc') {
  if (current !== key) return null;
  return dir === 'asc' ? <ArrowUpAZ className="inline w-3 h-3 ml-1" /> : <ArrowDownAZ className="inline w-3 h-3 ml-1" />;
}

function coerce(value: string) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function SmartGrid({
  cfg, rows, onEdit, onDelete, onDrop, setDragId, inline, setInline, persistInline,
}: {
  cfg: ModuleCrudConfig;
  rows: Record<string, unknown>[];
  onEdit: (r: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDrop: (id: string) => void;
  setDragId: (id: string | null) => void;
  onInline?: (row: Record<string, unknown>, field: string) => void;
  inline: { id: string; field: string; value: string } | null;
  setInline: (v: { id: string; field: string; value: string } | null) => void;
  persistInline: () => void;
}) {
  const card = (row: Record<string, unknown>) => {
    const img = cfg.imageField ? String(row[cfg.imageField] || '') : '';
    const title = titleOf(row, cfg);
    const sub = cfg.subtitleField ? String(row[cfg.subtitleField] || '') : '';
    const status = String(row.status || '');
    return (
      <article
        key={String(row.id)}
        draggable={Boolean(cfg.orderField)}
        onDragStart={() => setDragId(String(row.id))}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop(String(row.id))}
        className="ad-card overflow-hidden group ad-rise"
      >
        {img && cfg.variant !== 'people' && (
          <div className="h-36 overflow-hidden relative">
            <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              {inline && inline.id === row.id && inline.field === cfg.titleField ? (
                <input className="ad-input py-1" value={inline.value} onChange={(e) => setInline({ id: String(row.id), field: cfg.titleField, value: e.target.value })} onBlur={persistInline} autoFocus />
              ) : (
                <h3 className="font-bold leading-snug cursor-text" onClick={() => setInline({ id: String(row.id), field: cfg.titleField, value: title })}>{title}</h3>
              )}
              {sub && <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{sub}</p>}
            </div>
            {status && <span className={`ad-chip ${status === 'published' || status === 'active' ? 'ad-chip-ok' : 'ad-chip-warn'}`}>{status}</span>}
          </div>
          {cfg.variant === 'quotes' && <p className="text-sm italic line-clamp-3">“{String(row.text || '')}”</p>}
          {cfg.variant === 'jobs' && (
            <div className="flex gap-2 text-xs" style={{ color: 'var(--ad-muted)' }}>
              <span>{String(row.type || '')}</span>
              <span>{String(row.salary || '')}</span>
            </div>
          )}
          <div className="flex gap-1 pt-2">
            <button className="ad-btn ad-btn-ghost ad-btn-icon" onClick={() => onEdit(row)} title="Éditer"><Pencil className="w-4 h-4" /></button>
            <button className="ad-btn ad-btn-ghost ad-btn-icon" onClick={() => onEdit(row)} title="Voir"><Eye className="w-4 h-4" /></button>
            <button className="ad-btn ad-btn-danger ad-btn-icon ml-auto" onClick={() => onDelete(String(row.id))}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </article>
    );
  };

  if (cfg.variant === 'timeline') {
    return (
      <div className="relative pl-6 space-y-4">
        <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: 'var(--ad-line)' }} />
        {rows.map((row) => (
          <div key={String(row.id)} className="relative">
            <span className="absolute -left-[1.35rem] top-3 w-3 h-3 rounded-full" style={{ background: 'var(--ad-accent)' }} />
            {card(row)}
          </div>
        ))}
      </div>
    );
  }

  if (cfg.variant === 'logos') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {rows.map(card)}
      </div>
    );
  }

  if (cfg.variant === 'slides') {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map(card)}
      </div>
    );
  }

  if (cfg.variant === 'people') {
    return (
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map((row) => (
          <article key={String(row.id)} className="ad-card p-4 flex gap-3 items-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white" style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)' }}>
              {String(row.firstName || row.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{String(row.firstName || '')} {String(row.lastName || '')}</div>
              <div className="text-xs truncate" style={{ color: 'var(--ad-muted)' }}>{String(row.email)}</div>
            </div>
            <span className="ad-chip ad-chip-acc">{String(row.type)}</span>
            <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => onEdit(row)}><Pencil className="w-4 h-4" /></button>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${cfg.variant === 'magazine' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
      {rows.map(card)}
      {rows.length === 0 && (
        <div className="md:col-span-3 ad-card p-10 text-center" style={{ color: 'var(--ad-muted)' }}>
          Aucune fiche. Importez le catalogue ou créez un élément.
        </div>
      )}
    </div>
  );
}
