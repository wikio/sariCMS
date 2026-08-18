'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Filter, GripVertical, LayoutGrid, List as ListIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminDelete, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import type { CmsModule } from '@/lib/cms-modules';
import { CmsError } from '@/lib/cms';

type ViewMode = 'list' | 'cards';

export default function CmsList({ mod }: { mod: CmsModule }) {
  const locale = useLocale();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);
  const [view, setView] = useState<ViewMode>(mod.layout === 'docs' ? 'list' : 'cards');

  const load = async () => {
    setLoading(true);
    try {
      const query: Record<string, string> = {
        filter: JSON.stringify({ locale, ...(mod.filter || {}) }),
      };
      if (mod.orderField) query.sortBy = mod.orderField;
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
        if (!v) continue;
        const raw = row[k];
        const asStr = String(raw ?? '');
        const asBool = String(Boolean(raw));
        if (asStr !== v && asBool !== v) return false;
      }
      if (!q.trim()) return true;
      const blob = mod.searchKeys.map((k) => String(row[k] ?? '')).join(' ').toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [rows, filters, q, mod.searchKeys]);

  const canReorder = Boolean(mod.orderField) && !q.trim() && Object.values(filters).every((v) => !v);

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

  const persistOrder = async (next: Record<string, unknown>[]) => {
    if (!mod.orderField) return;
    setRows(next);
    try {
      await Promise.all(next.map((row, i) => (
        cmsAdminUpdate(mod.resource, String(row.id), { [mod.orderField!]: i })
      )));
      showToast('Ordre enregistré', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Ordre non enregistré', 'error');
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = shown.findIndex((r) => String(r.id) === String(active.id));
    const newIndex = shown.findIndex((r) => String(r.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(shown, oldIndex, newIndex));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const Icon = mod.icon;

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            <Icon className="w-3.5 h-3.5" /> Consultation
          </div>
          <h1 className="text-3xl font-black tracking-tight">{mod.label}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
            {shown.length} fiche(s) · lecture seule · l’édition se fait sur la fiche
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex" style={{ border: '1px solid var(--ad-line)' }}>
            <button type="button" className={`ad-btn ad-btn-icon ${view === 'list' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('list')} title="Liste">
              <ListIcon className="w-4 h-4" />
            </button>
            <button type="button" className={`ad-btn ad-btn-icon ${view === 'cards' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('cards')} title="Cartes">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Link href={`/${locale}/admin/${mod.path}/new`} className="ad-btn ad-btn-primary">
            <Plus className="w-4 h-4" /> Nouveau {mod.singular}
          </Link>
        </div>
      </header>

      <div className="ad-card p-3 ad-rise ad-rise-2">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
            <input className="ad-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Rechercher un ${mod.singular}…`} />
          </div>
          {mod.filterKeys.slice(0, 2).map((f) => (
            <select key={f.key} className="ad-select lg:w-44" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
              <option value="">{f.label}</option>
              {(f.options || Array.from(new Set(rows.map((r) => String(r[f.key] ?? '')).filter(Boolean)))).map((o) => (
                <option key={o} value={o}>{o === 'true' ? 'Oui' : o === 'false' ? 'Non' : o}</option>
              ))}
            </select>
          ))}
          <button type="button" className={`ad-btn ${advanced ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setAdvanced((v) => !v)}>
            <Filter className="w-4 h-4" /> Filtres
          </button>
        </div>
        {advanced && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--ad-line)' }}>
            {mod.filterKeys.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{f.label}</span>
                <select className="ad-select" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
                  <option value="">Tous</option>
                  {(f.options || Array.from(new Set(rows.map((r) => String(r[f.key] ?? '')).filter(Boolean)))).map((o) => (
                    <option key={o} value={o}>{o === 'true' ? 'Oui' : o === 'false' ? 'Non' : o}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="flex items-end">
              <button type="button" className="ad-btn ad-btn-ghost w-full" onClick={() => setFilters({})}>Réinitialiser</button>
            </div>
          </div>
        )}
        {mod.orderField && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--ad-muted)' }}>
            {canReorder ? 'Glissez les poignées pour réordonner les fiches.' : 'Retirez la recherche et les filtres pour réordonner.'}
          </p>
        )}
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label={mod.label} /></div>
      ) : view === 'list' ? (
        <ListTable mod={mod} rows={shown} locale={locale} onDelete={remove} canReorder={canReorder} sensors={sensors} onDragEnd={onDragEnd} />
      ) : (
        <CardCanvas mod={mod} rows={shown} locale={locale} onDelete={remove} canReorder={canReorder} sensors={sensors} onDragEnd={onDragEnd} />
      )}
    </div>
  );
}

function ListTable({
  mod, rows, locale, onDelete, canReorder, sensors, onDragEnd,
}: {
  mod: CmsModule;
  rows: Record<string, unknown>[];
  locale: string;
  onDelete: (id: string) => void;
  canReorder: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  if (rows.length === 0) return <Empty mod={mod} />;
  const body = (
    <table className="ad-table">
      <thead>
        <tr>
          {canReorder && <th className="w-10"></th>}
          <th>Titre</th>
          <th>Meta</th>
          <th>Statut</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SortableRow key={String(row.id)} id={String(row.id)} disabled={!canReorder}>
            {canReorder && (
              <td className="w-10">
                <span className="opacity-40 cursor-grab"><GripVertical className="w-4 h-4" /></span>
              </td>
            )}
            <td className="font-bold">{String(row[mod.titleKey] || '—')}</td>
            <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>{String(row[mod.subtitleKey || 'slug'] || '')}</td>
            <td><span className="ad-chip ad-chip-acc">{String(row.status || row[mod.badgeKey || ''] || '')}</span></td>
            <td className="text-right">
              <div className="flex justify-end gap-1">
                <Link href={`/${locale}/admin/${mod.path}/${row.id}`} className="ad-btn ad-btn-ghost"><Pencil className="w-4 h-4" /> Ouvrir</Link>
                <button className="ad-btn ad-btn-danger ad-btn-icon" onClick={() => onDelete(String(row.id))}><Trash2 className="w-4 h-4" /></button>
              </div>
            </td>
          </SortableRow>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="ad-card overflow-hidden ad-rise">
      {canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => String(r.id))} strategy={verticalListSortingStrategy}>
            {body}
          </SortableContext>
        </DndContext>
      ) : body}
    </div>
  );
}

function CardCanvas({
  mod, rows, locale, onDelete, canReorder, sensors, onDragEnd,
}: {
  mod: CmsModule;
  rows: Record<string, unknown>[];
  locale: string;
  onDelete: (id: string) => void;
  canReorder: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  if (rows.length === 0) return <Empty mod={mod} />;
  const cards = rows.map((row) => (
    <SortableCard key={String(row.id)} id={String(row.id)} disabled={!canReorder}>
      <article className="ad-card ad-tile overflow-hidden h-full">
        {mod.imageKey && String(row[mod.imageKey] || '') && (
          <div className="h-40 overflow-hidden relative">
            <img src={String(row[mod.imageKey])} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              {canReorder && <span className="inline-flex opacity-40 mb-1 cursor-grab"><GripVertical className="w-4 h-4" /></span>}
              <h3 className="font-black leading-snug">{String(row[mod.titleKey] || '—')}</h3>
              {mod.subtitleKey && <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{String(row[mod.subtitleKey] || '')}</p>}
            </div>
            {mod.badgeKey && String(row[mod.badgeKey] || '') && (
              <span className={`ad-chip ${['published', 'active'].includes(String(row[mod.badgeKey])) ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
                {String(row[mod.badgeKey])}
              </span>
            )}
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
    </SortableCard>
  ));

  const grid = <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{cards}</div>;
  if (!canReorder) return grid;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => String(r.id))} strategy={verticalListSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  );
}

function SortableCard({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function Empty({ mod }: { mod: CmsModule }) {
  return (
    <div className="ad-card p-12 text-center" style={{ color: 'var(--ad-muted)' }}>
      Aucune fiche. Créez un {mod.singular} ou importez le catalogue.
    </div>
  );
}
