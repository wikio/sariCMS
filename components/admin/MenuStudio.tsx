'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, CornerDownRight, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { IconPicker } from '@/components/admin/fields/FieldKit';
import SlugPicker from '@/components/admin/SlugPicker';
import { cmsAdminCreate, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import AutoSubmenuPicker from '@/components/admin/AutoSubmenuPicker';
import type { AutoRule } from '@/lib/menu-auto';
import { CmsError } from '@/lib/cms';

type MenuItem = {
  id?: string;
  label: string;
  href: string;
  desc?: string;
  icon?: string;
  submenu?: MenuItem[];
  /**
   * Sous-menu généré depuis le contenu (voir `lib/menu-auto.ts`).
   * Quand elle est présente, `submenu` n'est pas enregistré : la liste est
   * recalculée à l'affichage, donc toujours à jour.
   */
  auto?: AutoRule | null;
};

type MenuRecord = {
  id?: string;
  name: string;
  location: string;
  locale: string;
  status: string;
  items: MenuItem[];
};

const LOCATIONS = [
  { id: 'main', label: 'Menu principal', hint: 'Navigation du header de la vitrine.' },
  { id: 'footer-nav', label: 'Pied — navigation', hint: 'Colonnes de liens du footer.' },
  { id: 'footer-legal', label: 'Pied — légal', hint: 'Mentions, CGV, confidentialité.' },
];

const DEFAULTS: Record<string, MenuItem[]> = {
  main: [
    { id: 'home', label: 'Accueil', href: '/' },
    { id: 'products', label: 'Produits', href: '/products' },
    { id: 'services', label: 'Services', href: '/services' },
    {
      id: 'solutions', label: 'Solutions', href: '/solutions',
      submenu: [
        { id: 'solutions-diagnostic', label: 'Diagnostic', href: '/solutions/diagnostic' },
        { id: 'solutions-imagerie', label: 'Imagerie', href: '/solutions/imaging' },
        { id: 'solutions-chirurgie', label: 'Chirurgie', href: '/solutions/surgery' },
      ],
    },
    { id: 'news', label: 'Actualités', href: '/news' },
    { id: 'careers', label: 'Carrières', href: '/careers' },
    { id: 'contact', label: 'Contact', href: '/contact' },
  ],
  'footer-nav': [
    { id: 'about', label: 'À propos', href: '/about' },
    { id: 'solutions', label: 'Solutions', href: '/solutions' },
    { id: 'events', label: 'Événements', href: '/events' },
    { id: 'contact', label: 'Contact', href: '/contact' },
  ],
  'footer-legal': [
    { id: 'legal', label: 'Mentions légales', href: '/legal' },
    { id: 'privacy', label: 'Confidentialité', href: '/privacy' },
    { id: 'terms', label: 'CGV', href: '/terms' },
  ],
};

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `i-${Date.now()}-${Math.random()}`;
}

function normalizeItems(items: unknown): MenuItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it: MenuItem & { children?: MenuItem[] }) => ({
    ...it,
    submenu: it.submenu || (it.children ? normalizeItems(it.children) : undefined),
    children: undefined,
  }));
}

function MenuStudioInner() {
  const locale = useLocale();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => {
    const wanted = searchParams.get('location');
    return wanted && LOCATIONS.some((l) => l.id === wanted) ? wanted : 'main';
  });
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MenuItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await cmsAdminList<MenuRecord>('menus', { filter: JSON.stringify({ locale }) });
      setMenus(rows);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Menus inaccessibles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [locale]);

  const current = useMemo(
    () => menus.find((m) => m.location === tab) || null,
    [menus, tab],
  );

  useEffect(() => {
    if (loading) return;
    const items = current?.items;
    setDraft(Array.isArray(items) && items.length ? normalizeItems(items) : DEFAULTS[tab] || []);
  }, [tab, current, loading]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.findIndex((it) => (it.id || it.href) === active.id);
    const newIndex = draft.findIndex((it) => (it.id || it.href) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setDraft(arrayMove(draft, oldIndex, newIndex));
  };

  const setItem = (index: number, patch: Partial<MenuItem>) => {
    setDraft((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  const addChild = (index: number) => {
    setDraft((prev) => prev.map((it, i) => (i === index
      ? { ...it, submenu: [...(it.submenu || []), { id: uid(), label: 'Nouveau sous-lien', href: '/' }] }
      : it)));
  };

  const setChild = (index: number, childIndex: number, patch: Partial<MenuItem>) => {
    setDraft((prev) => prev.map((it, i) => (i === index
      ? { ...it, submenu: (it.submenu || []).map((c, j) => (j === childIndex ? { ...c, ...patch } : c)) }
      : it)));
  };

  const removeChild = (index: number, childIndex: number) => {
    setDraft((prev) => prev.map((it, i) => (i === index
      ? { ...it, submenu: (it.submenu || []).filter((_, j) => j !== childIndex) }
      : it)));
  };

  const moveChild = (index: number, childIndex: number, dir: -1 | 1) => {
    setDraft((prev) => prev.map((it, i) => {
      if (i !== index) return it;
      const sub = it.submenu || [];
      const target = childIndex + dir;
      if (target < 0 || target >= sub.length) return it;
      return { ...it, submenu: arrayMove(sub, childIndex, target) };
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: LOCATIONS.find((l) => l.id === tab)?.label || tab,
        location: tab,
        locale,
        status: 'published',
        // Une règle `auto` remplace le sous-menu : on n'enregistre pas la
        // liste résolue, sinon elle serait figée à la date d'enregistrement et
        // continuerait d'afficher les fiches archivées depuis.
        items: draft.map((it) => ({
          ...it,
          id: it.id || uid(),
          auto: it.auto || null,
          submenu: it.auto ? [] : (it.submenu || []).map((c) => ({ ...c, id: c.id || uid() })),
        })),
      };
      if (current?.id) {
        const saved = await cmsAdminUpdate<MenuRecord>('menus', current.id, payload);
        setMenus((prev) => prev.map((m) => (m.id === current.id ? { ...m, ...saved, items: payload.items } : m)));
      } else {
        const created = await cmsAdminCreate<MenuRecord>('menus', payload);
        setMenus((prev) => [...prev, created]);
      }
      showToast('Menu enregistré', 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ad-card"><PixelGridLoader label="Menus" /></div>;

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Site vitrine</div>
          <h1 className="text-3xl font-black tracking-tight">Menus</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Menu principal et pieds de page · glisser-déposer pour l’ordre · sous-menus disponibles</p>
        </div>
        <button className="ad-btn ad-btn-primary" disabled={saving} onClick={save}>
          <Save className="w-4 h-4" /> {saving ? '…' : 'Enregistrer ce menu'}
        </button>
      </header>

      <div className="flex flex-wrap gap-2 ad-rise">
        {LOCATIONS.map((loc) => (
          <button key={loc.id} type="button" className={`ad-btn ${tab === loc.id ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setTab(loc.id)}>
            {loc.label}
          </button>
        ))}
      </div>

      <p className="text-sm ad-rise" style={{ color: 'var(--ad-muted)' }}>
        {LOCATIONS.find((l) => l.id === tab)?.hint}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draft.map((it) => it.id || it.href)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {draft.map((item, i) => (
              <SortableItem key={item.id || item.href} id={item.id || item.href}>
                <div className="ad-card p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-black text-sm flex items-center gap-2">
                      <CornerDownRight className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} /> {item.label || 'Lien'}
                    </div>
                    <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => removeItem(i)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input className="ad-input" placeholder="Libellé" value={item.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                    <input className="ad-input" placeholder="Description (optionnel)" value={item.desc || ''} onChange={(e) => setItem(i, { desc: e.target.value })} />
                    <SlugPicker value={item.href} onChange={(href) => setItem(i, { href })} />
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Icône Lucide (optionnel)</span>
                      <IconPicker value={item.icon || ''} onChange={(icon) => setItem(i, { icon })} />
                    </div>
                  </div>

                  {/* Sous-menu généré depuis le contenu */}
                  <AutoSubmenuPicker
                    value={item.auto}
                    onChange={(auto) => setItem(i, { auto })}
                  />

                  {/* Sous-menu saisi à la main. Masqué quand une règle est
                      active : la liste générée la remplace à l'affichage, en
                      montrer deux serait trompeur. */}
                  {!item.auto && (item.submenu?.length || 0) > 0 && (
                    <div className="ml-4 pl-4 space-y-2" style={{ borderLeft: '2px solid var(--ad-line)' }}>
                      <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-accent)' }}>Sous-menu</div>
                      {item.submenu!.map((child, ci) => (
                        <div key={child.id || child.href} className="ad-card p-3 space-y-2" style={{ background: 'var(--ad-surface-2)' }}>
                          <div className="flex items-center gap-1">
                            <input className="ad-input" placeholder="Libellé du sous-lien" value={child.label} onChange={(e) => setChild(i, ci, { label: e.target.value })} />
                            <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" disabled={ci === 0} onClick={() => moveChild(i, ci, -1)}><ChevronUp className="w-4 h-4" /></button>
                            <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" disabled={ci === (item.submenu!.length - 1)} onClick={() => moveChild(i, ci, 1)}><ChevronDown className="w-4 h-4" /></button>
                            <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => removeChild(i, ci)}><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <SlugPicker value={child.href} onChange={(href) => setChild(i, ci, { href })} />
                          <input className="ad-input" placeholder="Description (optionnel)" value={child.desc || ''} onChange={(e) => setChild(i, ci, { desc: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  )}

                  {!item.auto && (
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => addChild(i)}>
                      <Plus className="w-4 h-4" /> Ajouter un sous-lien
                    </button>
                  )}
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setDraft((prev) => [...prev, { id: uid(), label: 'Nouveau lien', href: '/' }])}>
        <Plus className="w-4 h-4" /> Ajouter un lien
      </button>
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="ad-btn ad-btn-icon ad-btn-ghost cursor-grab mt-2 shrink-0"
          title="Glisser pour réordonner"
        >
          <GripVertical className="w-4 h-4 opacity-60" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default function MenuStudio() {
  return (
    <Suspense fallback={<div className="ad-card"><PixelGridLoader label="Menus" /></div>}>
      <MenuStudioInner />
    </Suspense>
  );
}
