'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, Copy, Download, Eye, Filter, GripVertical, LayoutGrid, List as ListIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import IconMark from '@/components/admin/IconMark';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import type { CmsModule } from '@/lib/cms-modules';
import { CmsError } from '@/lib/cms';
import { nextSku } from '@/lib/admin-settings';
import { slugify } from '@/lib/slugify';

type ViewMode = 'list' | 'cards';

export default function CmsList({ mod }: { mod: CmsModule }) {
  const locale = useLocale();
  const t = useTranslations('admin.common');
  const tTitles = useTranslations('admin.titles');
  const STATUS_LABELS: Record<string, string> = {
    draft: t('statusDraft'), published: t('statusPublished'), archived: t('statusArchived'),
  };
  const messages = useMessages() as Record<string, any>;
  const translateFilterOption = (o: string) => {
    if (STATUS_LABELS[o]) return STATUS_LABELS[o];
    if (o === 'true') return t('yes');
    if (o === 'false') return t('no');
    // Lookup directly in messages to avoid MISSING_MESSAGE errors
    try {
      const editor = messages?.admin?.editor;
      const key = `option_${o}`;
      if (editor && typeof editor === 'object' && key in editor) {
        const translated = editor[key];
        if (typeof translated === 'string' && translated.length > 0) return translated;
      }
    } catch {}
    return o;
  };
  const FILTER_LABELS: Record<string, string> = { 'Statut': t('status'), 'Contrat': t('contract', { defaultMessage: 'Contrat' }), 'Catégorie': t('category'), 'Langue': t('language'), 'Stock': t('stock'), 'Publication': t('publication'), 'Type': t('type', { defaultMessage: 'Type' }) };
  const translateFilterLabel = (label: string) => FILTER_LABELS[label] || label;
  const translatedSingular = (() => { const SINGULARS: Record<string, string> = { services: tTitles('singular_service'), products: tTitles('singular_product'), events: tTitles('singular_event'), news: tTitles('singular_news'), careers: tTitles('singular_career'), solutions: tTitles('singular_solution'), pages: tTitles('singular_page'), partners: tTitles('singular_partner'), testimonials: tTitles('singular_testimonial'), galleries: tTitles('singular_gallery'), legal: tTitles('singular_legal'), hero: tTitles('singular_hero'), contents: tTitles('singular_content') }; return SINGULARS[mod.key] || mod.singular; })();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);
  const [view, setView] = useState<ViewMode>(mod.layout === 'docs' ? 'list' : 'cards');
  const [sortKey, setSortKey] = useState(mod.titleKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const query: Record<string, string> = {
        filter: JSON.stringify({ locale, ...(mod.filter || {}) }),
      };
      if (mod.orderField) query.sortBy = mod.orderField;
      setRows(await cmsAdminList(mod.resource, query));
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t("loadError"), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mod.key, locale]);

  const shown = useMemo(() => {
    const filtered = rows.filter((row) => {
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
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [rows, filters, q, mod.searchKeys, sortKey, sortDir]);

  const canReorder = Boolean(mod.orderField) && !q.trim() && Object.values(filters).every((v) => !v);

  const remove = async (id: string) => {
    if (!confirm(t("confirmTrash"))) return;
    try {
      await cmsAdminDelete(mod.resource, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      showToast(t("trashed"), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  const duplicate = async (row: Record<string, unknown>) => {
    try {
      const saved = await cmsAdminCreate(mod.resource, {
        ...row,
        id: undefined,
        slug: slugify(`${row[mod.titleKey] || 'copie'}-copie`),
        [mod.titleKey]: `${row[mod.titleKey] || ''} (copie)`,
        status: 'draft',
        sku: mod.key === 'products' ? nextSku() : row.sku,
      });
      showToast(t("duplicated"), 'success');
      setRows((prev) => [saved as Record<string, unknown>, ...prev]);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t("duplicateError"), 'error');
    }
  };

  const persistOrder = async (next: Record<string, unknown>[]) => {
    if (!mod.orderField) return;
    setRows(next);
    try {
      await Promise.all(next.map((row, i) => cmsAdminUpdate(mod.resource, String(row.id), { [mod.orderField!]: i })));
      showToast(t("orderSaved"), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t("orderError"), 'error');
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

  const exportCsv = () => {
    const cols = [mod.titleKey, mod.subtitleKey, 'status', 'sku', 'category'].filter(Boolean) as string[];
    const lines = [cols.join(';'), ...shown.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${mod.key}.csv`;
    a.click();
  };

  const bulkDelete = async () => {
    if (!selected.length || !confirm(t("bulkTrashConfirm", { count: selected.length }))) return;
    for (const id of selected) await cmsAdminDelete(mod.resource, id);
    setRows((prev) => prev.filter((r) => !selected.includes(String(r.id))));
    setSelected([]);
    showToast(t("bulkTrashed"), 'success');
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const Icon = mod.icon;
  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            <Icon className="w-3.5 h-3.5" /> {t('catalogue')}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{(() => { try { const r = tTitles(mod.key); return typeof r === 'string' ? r : mod.label; } catch { return mod.label; } })()}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t("recordCount", { count: shown.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex" style={{ border: '1px solid var(--ad-line)' }}>
            <button type="button" className={`ad-btn ad-btn-icon ${view === 'list' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('list')}><ListIcon className="w-4 h-4" /></button>
            <button type="button" className={`ad-btn ad-btn-icon ${view === 'cards' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setView('cards')}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button className="ad-btn ad-btn-ghost" onClick={exportCsv}><Download className="w-4 h-4" />{t("export")}</button>
          <Link href={`/${locale}/admin/${mod.path}/new`} className="ad-btn ad-btn-primary">
            <Plus className="w-4 h-4" /> {t("newItem", { singular: translatedSingular })}
          </Link>
        </div>
      </header>

      <div className="ad-card p-3 ad-rise ad-rise-2 space-y-3">
        <SearchField
          value={draft}
          onChange={setDraft}
          onSubmit={() => setQ(draft)}
          showSubmit
          placeholder={t("searchPlaceholder", { singular: translatedSingular })}
        />
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {mod.filterKeys.slice(0, 2).map((f) => (
            <select key={f.key} className="ad-select sm:w-48" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
              <option value="">{translateFilterLabel(f.label)}</option>
              {(f.options || Array.from(new Set(rows.map((r) => String(r[f.key] ?? '')).filter(Boolean)))).map((o) => (
                <option key={o} value={o}>{translateFilterOption(o)}</option>
              ))}
            </select>
          ))}
          <button type="button" className={`ad-btn ${advanced ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setAdvanced((v) => !v)}>
            <Filter className="w-4 h-4" /> {t('filters')}
          </button>
        </div>
        {advanced && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--ad-line)' }}>
            {mod.filterKeys.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{translateFilterLabel(f.label)}</span>
                <select className="ad-select" value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}>
                  <option value="">{t("all")}</option>
                  {(f.options || Array.from(new Set(rows.map((r) => String(r[f.key] ?? '')).filter(Boolean)))).map((o) => (
                    <option key={o} value={o}>{translateFilterOption(o)}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="flex items-end"><button type="button" className="ad-btn ad-btn-ghost w-full" onClick={() => setFilters({})}>{t('reset')}</button></div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="ad-card p-3 flex items-center gap-2">
          <span className="text-sm font-bold">{t("selected", { count: selected.length })}</span>
          <button className="ad-btn ad-btn-danger" onClick={bulkDelete}><Trash2 className="w-4 h-4" />{t("trash")}</button>
        </div>
      )}

      {loading ? (
        <div className="ad-card"><PixelGridLoader label={mod.label} /></div>
      ) : view === 'list' ? (
        <ListTable
          mod={mod} rows={shown} locale={locale} onDelete={remove} onDuplicate={duplicate}
          canReorder={canReorder} sensors={sensors} onDragEnd={onDragEnd}
          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
          selected={selected} setSelected={setSelected}
        />
      ) : (
        <CardCanvas mod={mod} rows={shown} locale={locale} onDelete={remove} onDuplicate={duplicate} canReorder={canReorder} sensors={sensors} onDragEnd={onDragEnd} />
      )}
    </div>
  );
}

function SortMark({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return null;
  return dir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />;
}

function ListTable({
  mod, rows, locale, onDelete, onDuplicate, canReorder, sensors, onDragEnd, sortKey, sortDir, onSort, selected, setSelected,
}: {
  mod: CmsModule;
  rows: Record<string, unknown>[];
  locale: string;
  onDelete: (id: string) => void;
  onDuplicate: (row: Record<string, unknown>) => void;
  canReorder: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (k: string) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const t = useTranslations('admin.common');
  if (rows.length === 0) return <Empty mod={mod} />;
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const body = (
    <table className="ad-table min-w-[720px]">
      <thead>
        <tr>
          <th><input type="checkbox" checked={selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => String(r.id)) : [])} /></th>
          {canReorder && <th className="w-10"></th>}
          {mod.imageKey && <th>{t("visual")}</th>}
          <th onClick={() => onSort(mod.titleKey)}>{t("title")} <SortMark active={sortKey === mod.titleKey} dir={sortDir} /></th>
          <th onClick={() => onSort(mod.subtitleKey || 'slug')}>Meta <SortMark active={sortKey === (mod.subtitleKey || 'slug')} dir={sortDir} /></th>
          <th onClick={() => onSort('status')}>{t("status")} <SortMark active={sortKey === 'status'} dir={sortDir} /></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SortableRow key={String(row.id)} id={String(row.id)} disabled={!canReorder}>
            <td><input type="checkbox" checked={selected.includes(String(row.id))} onChange={() => toggle(String(row.id))} /></td>
            {canReorder && <td className="w-10"><span className="opacity-40 cursor-grab"><GripVertical className="w-4 h-4" /></span></td>}
            {mod.imageKey && (
              <td>
                {String(row[mod.imageKey] || '') ? (
                  <img src={String(row[mod.imageKey])} alt="" className="w-12 h-12 object-contain" style={{ border: '1px solid var(--ad-line)' }} />
                ) : '—'}
              </td>
            )}
            <td className="font-bold">
              <span className="inline-flex items-center gap-2">
                {row.icon ? <IconMark name={String(row.icon)} /> : null}
                {String(row[mod.titleKey] || '—')}
              </span>
            </td>
            <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>{String(row[mod.subtitleKey || 'slug'] || '')}</td>
            <td><span className="ad-chip ad-chip-acc">{String(row.status || row[mod.badgeKey || ''] || '')}</span></td>
            <td className="text-right">
              <div className="flex justify-end gap-1">
                <Link href={`/${locale}/admin/${mod.path}/${row.id}?consult=1`} className="ad-btn ad-btn-icon ad-btn-ghost" title={t("consult")}><Eye className="w-4 h-4" /></Link>
                <Link href={`/${locale}/admin/${mod.path}/${row.id}`} className="ad-btn ad-btn-ghost"><Pencil className="w-4 h-4" /> {t("editBtn")}</Link>
                <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => onDuplicate(row)}><Copy className="w-4 h-4" /></button>
                <button className="ad-btn ad-btn-danger ad-btn-icon" onClick={() => onDelete(String(row.id))}><Trash2 className="w-4 h-4" /></button>
              </div>
            </td>
          </SortableRow>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="ad-card overflow-x-auto ad-rise">
      {canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => String(r.id))} strategy={verticalListSortingStrategy}>{body}</SortableContext>
        </DndContext>
      ) : body}
    </div>
  );
}

function CardCanvas({
  mod, rows, locale, onDelete, onDuplicate, canReorder, sensors, onDragEnd,
}: {
  mod: CmsModule;
  rows: Record<string, unknown>[];
  locale: string;
  onDelete: (id: string) => void;
  onDuplicate: (row: Record<string, unknown>) => void;
  canReorder: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  const t = useTranslations('admin.common');
  if (rows.length === 0) return <Empty mod={mod} />;
  const cards = rows.map((row) => (
    <SortableCard key={String(row.id)} id={String(row.id)} disabled={!canReorder}>
      <article className="ad-card overflow-hidden h-full">
        {mod.imageKey && String(row[mod.imageKey] || '') && (
          <div className="h-40 overflow-hidden flex items-center justify-center" style={{ background: 'var(--ad-surface-2)' }}>
            <img src={String(row[mod.imageKey])} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
              <h3 className="font-black leading-snug inline-flex items-center gap-2">
                {row.icon ? <IconMark name={String(row.icon)} /> : null}
                {String(row[mod.titleKey] || '—')}
              </h3>
            {mod.badgeKey && String(row[mod.badgeKey] || '') && (
              <span className={`ad-chip ${['published', 'active'].includes(String(row[mod.badgeKey])) ? 'ad-chip-ok' : 'ad-chip-warn'}`}>{String(row[mod.badgeKey])}</span>
            )}
          </div>
          {mod.subtitleKey && <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{String(row[mod.subtitleKey] || '')}</p>}
          {mod.key === 'products' && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--ad-muted)' }}>{String(row.sku || row.category || '')}</span>
              <span className="font-black" style={{ color: 'var(--ad-accent)' }}>{String(row.price || '')}</span>
            </div>
          )}
          <div className="flex gap-1 pt-2">
            <Link href={`/${locale}/admin/${mod.path}/${row.id}?consult=1`} className="ad-btn ad-btn-icon ad-btn-ghost"><Eye className="w-4 h-4" /></Link>
            <Link href={`/${locale}/admin/${mod.path}/${row.id}`} className="ad-btn ad-btn-ghost"><Pencil className="w-4 h-4" /> {t("editBtn")}</Link>
            <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => onDuplicate(row)}><Copy className="w-4 h-4" /></button>
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
      <SortableContext items={rows.map((r) => String(r.id))} strategy={verticalListSortingStrategy}>{grid}</SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} {...attributes} {...listeners}>
      {children}
    </tr>
  );
}

function SortableCard({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function Empty({ mod }: { mod: CmsModule }) {
  const t = useTranslations('admin.common');
  return <div className="ad-card p-12 text-center" style={{ color: 'var(--ad-muted)' }}>{t("noRecords", { singular: translatedSingular })}</div>;
}
