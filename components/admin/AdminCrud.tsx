'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownAZ, ArrowUpAZ, Check, GripVertical, Pencil, Plus, RefreshCw,
  Search, SlidersHorizontal, Table2, LayoutGrid, Trash2, X, Save, Eye,
  CheckSquare, Square, Mail, ShieldOff, ShieldCheck, KeyRound, MessageSquare,
} from 'lucide-react';
import UserForm from '@/components/admin/UserForm';
import UserSheet from '@/components/admin/UserSheet';
import UserRow from '@/components/admin/UserRow';
import UsersTable from '@/components/admin/UsersTable';
import MessageComposer from '@/components/admin/MessageComposer';
import type { PersonType } from '@/lib/messages';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import {
  cmsAdminAutocomplete,
  cmsAdminCreate,
  cmsAdminDelete,
  cmsAdminGet,
  cmsAdminList,
  cmsAdminUpdate,
  extraFiltersForType,
  newItemDraft,
} from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { userRecordHref } from '@/lib/user-links';
import Link from 'next/link';

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
  // Sélection multiple et fiche de consultation : réservées aux comptes, les
  // autres modules disposent déjà de ces outils dans CmsList.
  const [selected, setSelected] = useState<string[]>([]);
  const [consulting, setConsulting] = useState<Record<string, unknown> | null>(null);
  const [messaging, setMessaging] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const estUsers = cfg.dataType === 'users';

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
    // Comptes : on ouvre un formulaire vierge sans rien écrire en base.
    // L'ancien comportement créait immédiatement un compte de remplissage
    // (« user1757…@sarisysteme.com ») avec un mot de passe connu ; abandonner
    // la saisie laissait ce compte actif derrière soi.
    if (estUsers) {
      setEditing({ locale, type: 'client', status: 'active' });
      return;
    }
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

  /**
   * Exécute une action sur chaque élément sélectionné.
   *
   * `allSettled` plutôt que `all` : une fiche en échec (droits insuffisants,
   * compte supprimé entre-temps) ne doit pas masquer le sort des autres. On
   * renvoie les identifiants réellement traités afin de n'actualiser que
   * ceux-là et de laisser les autres sélectionnés pour un nouvel essai.
   */
  const runBulk = async (ids: string[], action: (id: string) => Promise<unknown>) => {
    const results = await Promise.allSettled(ids.map((id) => action(id)));
    const done: string[] = [];
    let firstError: unknown = null;
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') done.push(ids[i]);
      else if (!firstError) firstError = res.reason;
    });
    return { done, failed: ids.length - done.length, firstError };
  };

  /**
   * Ouvre une fiche après avoir rechargé l'enregistrement complet.
   *
   * La liste ne renvoie qu'une projection : éditer directement une de ses
   * lignes afficherait `position` ou `roleId` vides, puis les effacerait à
   * l'enregistrement. En cas d'échec on retombe sur la ligne de liste, ce qui
   * vaut mieux que de ne rien ouvrir.
   */
  const ouvrirFiche = async (row: Record<string, unknown>, mode: 'edit' | 'view') => {
    const poser = (r: Record<string, unknown>) => (mode === 'edit' ? setEditing(r) : setConsulting(r));
    poser(row);
    if (!row.id) return;
    try {
      const complet = await cmsAdminGet(cfg.resource, String(row.id));
      if (complet && typeof complet === 'object') poser({ ...row, ...(complet as Record<string, unknown>) });
    } catch {
      /* Fiche complète indisponible : la ligne de liste reste affichée. */
    }
  };

  /** Change le statut d'un seul compte, sans passer par la sélection. */
  const setRowStatus = async (row: Record<string, unknown>, status: string) => {
    setBusy(true);
    try {
      await cmsAdminUpdate(cfg.resource, String(row.id), { status });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
      showToast('Statut mis à jour', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () => {
    const ids = filtered.map((r) => String(r.id));
    // Tout décocher si la page entière est déjà sélectionnée, sinon tout cocher.
    setSelected((prev) => (ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : ids));
  };

  /** Applique un champ (statut, type…) à toute la sélection. */
  const bulkPatch = async (patch: Record<string, unknown>, libelle: string) => {
    if (!selected.length) return;
    if (!confirm(`${libelle} — ${selected.length} compte(s) ?`)) return;
    setBusy(true);
    try {
      const { done, failed, firstError } = await runBulk(selected, (id) => cmsAdminUpdate(cfg.resource, id, patch));
      // Mise à jour locale plutôt que rechargement : tri, filtres et position
      // de défilement en cours sont conservés.
      if (done.length) setRows((prev) => prev.map((r) => (done.includes(String(r.id)) ? { ...r, ...patch } : r)));
      setSelected((prev) => prev.filter((id) => !done.includes(id)));
      if (failed) {
        showToast(`${done.length} traité(s), ${failed} en échec — ${firstError instanceof CmsError ? firstError.message : ''}`.trim(), 'error');
      } else {
        showToast(`${libelle} : ${done.length} compte(s)`, 'success');
      }
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!selected.length || !confirm(`Envoyer ${selected.length} compte(s) en corbeille ?`)) return;
    setBusy(true);
    try {
      const { done, failed, firstError } = await runBulk(selected, (id) => cmsAdminDelete(cfg.resource, id));
      if (done.length) setRows((prev) => prev.filter((r) => !done.includes(String(r.id))));
      setSelected((prev) => prev.filter((id) => !done.includes(id)));
      if (failed) {
        showToast(`${done.length} supprimé(s), ${failed} en échec — ${firstError instanceof CmsError ? firstError.message : ''}`.trim(), 'error');
      } else {
        showToast(`${done.length} compte(s) en corbeille`, 'success');
      }
    } finally {
      setBusy(false);
    }
  };

  /** Ouvre le client mail avec la sélection en copie cachée. */
  const bulkMail = () => {
    const mails = rows
      .filter((r) => selected.includes(String(r.id)))
      .map((r) => String(r.email || '').trim())
      .filter(Boolean);
    if (!mails.length) {
      showToast('Aucune adresse e-mail dans la sélection', 'error');
      return;
    }
    // Cci plutôt que « À » : les destinataires ne doivent pas voir les
    // adresses des autres comptes.
    window.location.href = `mailto:?bcc=${encodeURIComponent(mails.join(','))}`;
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
        {/*
          La recherche occupe l'essentiel de la largeur : les filtres, sur une
          base flexible égale, lui prenaient auparavant la majorité de la
          place. `basis` fixe leur largeur et `flex-1` donne le reste au champ.
          L'icône utilise `ad-affix`, donc elle passe à droite en arabe.
        */}
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="ad-affix has-start flex-1 lg:min-w-[22rem]">
            <span className="ad-affix-start"><Search className="w-4 h-4" /></span>
            <input className="ad-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={cfg.searchHint || 'Recherche avancée…'} />
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
            <select key={f.key} className="ad-select lg:basis-40 lg:shrink-0 lg:grow-0" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
              <option value="">{f.label}</option>
              {(f.options || dynamicOptions(f.key)).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ))}
          <button className="ad-btn ad-btn-ghost lg:shrink-0" onClick={() => { setQ(''); setFilters({}); }}>
            <SlidersHorizontal className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {estUsers && selected.length > 0 && (
        <div className="ad-card p-3 ad-rise flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--ad-accent)' }}>
          <span className="text-sm font-bold">{selected.length} compte(s) sélectionné(s)</span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => bulkPatch({ status: 'active' }, 'Activer')}>
              <ShieldCheck className="w-4 h-4" /> Activer
            </button>
            <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => bulkPatch({ status: 'blocked' }, 'Bloquer')}>
              <ShieldOff className="w-4 h-4" /> Bloquer
            </button>
            <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => bulkPatch({ status: 'pending' }, 'Mettre en attente')}>
              <KeyRound className="w-4 h-4" /> En attente
            </button>
            <select
              className="ad-select w-auto"
              disabled={busy}
              value=""
              onChange={(e) => { if (e.target.value) bulkPatch({ type: e.target.value }, `Changer le type en « ${e.target.value} »`); e.target.value = ''; }}
            >
              <option value="">Changer le type…</option>
              {['admin', 'client', 'partner', 'candidate'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={bulkMail}>
              <Mail className="w-4 h-4" /> E-mail
            </button>
            <button className="ad-btn ad-btn-danger" disabled={busy} onClick={bulkDelete}>
              <Trash2 className="w-4 h-4" /> Corbeille
            </button>
            <button className="ad-btn ad-btn-ghost" onClick={() => setSelected([])}>
              <X className="w-4 h-4" /> Désélectionner
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ad-card"><PixelGridLoader label="Sync CMS" /></div>
      ) : view === 'table' && estUsers ? (
        <UsersTable
          rows={filtered}
          locale={locale}
          selected={selected}
          busy={busy}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onConsult={(r) => ouvrirFiche(r, 'view')}
          onEdit={(r) => ouvrirFiche(r, 'edit')}
          onDelete={remove}
          onMessage={setMessaging}
          onStatus={setRowStatus}
          sortKey={sortKey}
          sortDir={sortDir}
          toggleSort={toggleSort}
        />
      ) : view === 'table' ? (
        <div className="ad-card overflow-x-auto ad-rise ad-rise-3">
          <table className="ad-table">
            <thead>
              <tr>
                {estUsers && (
                  <th className="w-8">
                    <button className="ad-btn ad-btn-icon ad-btn-ghost !p-1" onClick={toggleSelectAll} title="Tout sélectionner">
                      {filtered.length > 0 && filtered.every((r) => selected.includes(String(r.id)))
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
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
                  {estUsers && (
                    <td className="w-8">
                      <button className="ad-btn ad-btn-icon ad-btn-ghost !p-1" onClick={() => toggleSelect(String(row.id))}>
                        {selected.includes(String(row.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                  )}
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
                    {estUsers && (
                      <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setMessaging(row)} title="Envoyer un message interne"><MessageSquare className="w-4 h-4" /></button>
                    )}
                    <button className="ad-btn ad-btn-icon ad-btn-ghost ml-1" onClick={() => ouvrirFiche(row, 'view')} title="Consulter la fiche"><Eye className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-icon ad-btn-ghost ml-1" onClick={() => ouvrirFiche(row, 'edit')} title="Éditer"><Pencil className="w-4 h-4" /></button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={() => remove(String(row.id))}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SmartGrid cfg={cfg} locale={locale} rows={filtered} onEdit={(r) => ouvrirFiche(r, 'edit')} onConsult={(r) => ouvrirFiche(r, 'view')} onDelete={remove} onDrop={onDrop} setDragId={setDragId} onInline={(row, field) => setInline({ id: String(row.id), field, value: String(row[field] ?? '') })} inline={inline} persistInline={persistInline} setInline={setInline} selected={selected} onToggleSelect={toggleSelect} onMessage={setMessaging} onStatus={setRowStatus} />
      )}

      {messaging && (
        <MessageComposer
          email={String(messaging.email || '')}
          name={[messaging.firstName, messaging.lastName].filter(Boolean).join(' ') || String(messaging.email || '')}
          type={(['client', 'partner', 'candidate'].includes(String(messaging.type)) ? messaging.type : 'other') as PersonType}
          onClose={() => setMessaging(null)}
        />
      )}

      {consulting && (
        <div className="ad-overlay">
          <div className="ad-card ad-sheet w-full max-w-4xl max-h-[92dvh] ad-rise">
            <div className="ad-modal-body ad-scroll p-4 sm:p-6">
            <UserSheet
              record={consulting}
              locale={locale}
              onClose={() => setConsulting(null)}
              onEdit={() => { setEditing(consulting); setConsulting(null); }}
            />
            </div>
          </div>
        </div>
      )}

      {editing && estUsers && (
        <div className="ad-overlay">
          {/*
            En-tête fixe et corps défilant : le cadre ne défile pas, seul le
            contenu le fait. `dvh` plutôt que `vh` car sur mobile la barre
            d'adresse rogne la fenêtre, ce qui rendait le pied inaccessible.
          */}
          <div className="ad-card ad-sheet w-full max-w-4xl max-h-[92dvh] ad-rise">
            <div className="flex items-center justify-between gap-2 p-4 sm:p-6 pb-3 border-b shrink-0" style={{ borderColor: 'var(--ad-line)' }}>
              <h2 className="text-lg sm:text-xl font-black truncate">
                {editing.id ? `Édition · ${titleOf(editing, cfg)}` : 'Nouveau compte'}
              </h2>
              <button className="ad-btn ad-btn-icon ad-btn-ghost shrink-0" onClick={() => setEditing(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="ad-modal-body ad-scroll p-4 sm:p-6">
            <UserForm
              record={editing}
              locale={locale}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={async (payload) => {
                setSaving(true);
                try {
                  if (payload.id) {
                    const saved = await cmsAdminUpdate(cfg.resource, String(payload.id), payload);
                    setRows((prev) => prev.map((r) => (r.id === payload.id ? { ...r, ...(saved as Record<string, unknown>) } : r)));
                    showToast('Compte enregistré', 'success');
                  } else {
                    const cree = await cmsAdminCreate(cfg.resource, payload) as Record<string, unknown>;
                    setRows((prev) => [cree, ...prev]);
                    showToast('Compte créé', 'success');
                  }
                  setEditing(null);
                } catch (err) {
                  showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
                } finally {
                  setSaving(false);
                }
              }}
            />
            </div>
          </div>
        </div>
      )}

      {editing && !estUsers && (
        <div className="ad-overlay">
          <div className="ad-card ad-sheet w-full max-w-3xl max-h-[90dvh] ad-rise">
            <div className="ad-modal-body ad-scroll p-6">
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
            </div>
            {/* Pied fixe : les boutons restent atteignables sur un formulaire long. */}
            <div
              className="flex justify-end gap-2 px-6 py-4 border-t shrink-0"
              style={{ borderColor: 'var(--ad-line)' }}
            >
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
  cfg, rows, onEdit, onConsult, onDelete, onDrop, setDragId, inline, setInline, persistInline, locale,
  selected = [], onToggleSelect, onMessage, onStatus,
}: {
  cfg: ModuleCrudConfig;
  locale: string;
  rows: Record<string, unknown>[];
  onEdit: (r: Record<string, unknown>) => void;
  onConsult?: (r: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  selected?: string[];
  onToggleSelect?: (id: string) => void;
  onMessage?: (r: Record<string, unknown>) => void;
  onStatus?: (r: Record<string, unknown>, statut: string) => void;
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
    // Une colonne : chaque ligne porte désormais coordonnées et statistiques,
    // que trois colonnes tronqueraient. Deux colonnes seulement sur très
    // grand écran, où la place le permet.
    return (
      <div className="grid gap-2 2xl:grid-cols-2">
        {rows.map((row) => (
          <UserRow
            key={String(row.id)}
            record={row}
            locale={locale}
            selected={selected.includes(String(row.id))}
            onToggleSelect={() => onToggleSelect?.(String(row.id))}
            onConsult={() => onConsult?.(row)}
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(String(row.id))}
            onMessage={() => onMessage?.(row)}
            onStatus={(statut) => onStatus?.(row, statut)}
          />
        ))}
        {rows.length === 0 && (
          <div className="ad-card p-10 text-center 2xl:col-span-2" style={{ color: 'var(--ad-muted)' }}>
            Aucun compte ne correspond à la recherche.
          </div>
        )}
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

/**
 * Badge de type de compte, cliquable vers la vue métier correspondante.
 *
 * Clients, partenaires et candidats ne sont pas des tables distinctes : ce sont
 * des lignes de `users` avec un `type` différent. Le badge mène donc à la liste
 * métier filtrée sur l'email du compte (unique en base). Le type `admin`
 * renvoie vers Rôles & permissions.
 */
function TypeChip({ locale, type, email }: { locale: string; type: unknown; email: unknown }) {
  const label = String(type ?? '—');
  const href = userRecordHref(locale, type, email);
  if (!href) return <span className="ad-chip ad-chip-acc">{label}</span>;
  return (
    <Link
      href={href}
      className="ad-chip ad-chip-acc hover:underline"
      title={`Voir la fiche ${label}`}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
      <Eye className="w-3 h-3 ml-1 inline-block" />
    </Link>
  );
}
