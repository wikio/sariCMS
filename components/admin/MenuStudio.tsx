'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';

type MenuItem = {
  id?: string;
  label: string;
  href: string;
  desc?: string;
  icon?: string;
  children?: MenuItem[];
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

export default function MenuStudio() {
  const locale = useLocale();
  const { showToast } = useToast();
  const [tab, setTab] = useState('main');
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
    setDraft(Array.isArray(items) && items.length ? items : DEFAULTS[tab] || []);
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

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: LOCATIONS.find((l) => l.id === tab)?.label || tab,
        location: tab,
        locale,
        status: 'published',
        items: draft.map((it) => ({ ...it, id: it.id || uid() })),
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
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Menu principal et pieds de page · glisser-déposer pour l’ordre</p>
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
                <div className="ad-card p-3 grid md:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                  <GripVertical className="w-4 h-4 opacity-40 cursor-grab" />
                  <input className="ad-input" placeholder="Libellé" value={item.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                  <input className="ad-input font-mono" placeholder="/chemin" value={item.href} onChange={(e) => setItem(i, { href: e.target.value })} />
                  <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => setDraft((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="md:col-span-4 grid md:grid-cols-2 gap-2">
                    <input className="ad-input" placeholder="Description (optionnel)" value={item.desc || ''} onChange={(e) => setItem(i, { desc: e.target.value })} />
                    <input className="ad-input" placeholder="Icône Lucide (optionnel)" value={item.icon || ''} onChange={(e) => setItem(i, { icon: e.target.value })} />
                  </div>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
