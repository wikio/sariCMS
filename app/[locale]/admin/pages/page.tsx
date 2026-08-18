'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Eye, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminList, cmsAdminUpdate, newItemDraft } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';

export default function AdminPagesPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const [pages, setPages] = useState<Record<string, unknown>[]>([]);
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await cmsAdminList('pages', { filter: JSON.stringify({ locale }) });
      setPages(rows);
      setCurrent((c) => c || rows[0] || null);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Pages indisponibles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [locale]);

  const save = async () => {
    if (!current) return;
    try {
      const saved = current.id
        ? await cmsAdminUpdate('pages', String(current.id), current)
        : await cmsAdminCreate('pages', current);
      showToast('Page enregistrée', 'success');
      await load();
      setCurrent(saved as Record<string, unknown>);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Erreur', 'error');
    }
  };

  const add = async () => {
    const created = await cmsAdminCreate('pages', { ...newItemDraft('pages', locale), title: 'Nouvelle page', kind: 'generic' });
    setPages((p) => [created as Record<string, unknown>, ...p]);
    setCurrent(created as Record<string, unknown>);
  };

  const moveSection = (from: number, to: number) => {
    const sections = [...((current?.sections as unknown[]) || [])];
    const [s] = sections.splice(from, 1);
    sections.splice(to, 0, s);
    setCurrent({ ...current!, sections });
  };

  if (loading) return <div className="ad-card"><PixelGridLoader label="Pages" /></div>;

  return (
    <div className="grid lg:grid-cols-12 gap-4">
      <aside className="lg:col-span-3 ad-card p-3 max-h-[80vh] overflow-y-auto ad-scroll">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black">Pages CMS</h2>
          <button className="ad-btn ad-btn-primary ad-btn-icon" onClick={add}><Plus className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1">
          {pages.map((p) => (
            <button key={String(p.id)} onClick={() => setCurrent(p)} className={`w-full text-left px-3 py-2 rounded-xl text-sm ${current?.id === p.id ? 'font-bold' : ''}`} style={{ background: current?.id === p.id ? 'color-mix(in srgb, var(--ad-accent) 14%, transparent)' : undefined }}>
              <div>{String(p.title)}</div>
              <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{String(p.kind)} · {String(p.status)}</div>
            </button>
          ))}
        </div>
      </aside>
      <section className="lg:col-span-9 space-y-3">
        {!current ? <div className="ad-card p-10 text-center">Aucune page</div> : (
          <>
            <div className="ad-card p-4 flex flex-wrap gap-2 items-center">
              <input className="ad-input flex-1 min-w-[180px] font-black text-lg" value={String(current.title || '')} onChange={(e) => setCurrent({ ...current, title: e.target.value })} />
              <select className="ad-select w-36" value={String(current.status || 'draft')} onChange={(e) => setCurrent({ ...current, status: e.target.value })}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
              <button className={`ad-btn ${preview ? 'ad-btn-lime' : 'ad-btn-ghost'}`} onClick={() => setPreview((v) => !v)}><Eye className="w-4 h-4" /> Aperçu</button>
              <button className="ad-btn ad-btn-primary" onClick={save}><Save className="w-4 h-4" /> Sauver</button>
              <button className="ad-btn ad-btn-danger" onClick={async () => { if (current.id) { await cmsAdminDelete('pages', String(current.id)); setCurrent(null); load(); } }}><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className={`grid gap-3 ${preview ? 'md:grid-cols-2' : ''}`}>
              <div className="ad-card p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-2">
                  <input className="ad-input" value={String(current.slug || '')} onChange={(e) => setCurrent({ ...current, slug: e.target.value })} placeholder="slug" />
                  <input className="ad-input" value={String(current.kind || '')} onChange={(e) => setCurrent({ ...current, kind: e.target.value })} placeholder="kind" />
                  <input className="ad-input md:col-span-2" value={String(current.subtitle || '')} onChange={(e) => setCurrent({ ...current, subtitle: e.target.value })} placeholder="sous-titre" />
                </div>
                <textarea className="ad-textarea font-mono text-sm min-h-[280px]" value={String(current.content || '')} onChange={(e) => setCurrent({ ...current, content: e.target.value })} placeholder="HTML / contenu" />
                {Array.isArray(current.sections) && (current.sections as unknown[]).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>Sections · drag</div>
                    {(current.sections as Array<Record<string, unknown>>).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 ad-card p-2">
                        <button onClick={() => i > 0 && moveSection(i, i - 1)}><GripVertical className="w-4 h-4" /></button>
                        <input className="ad-input" value={String(s.title || '')} onChange={(e) => {
                          const sections = [...(current.sections as Array<Record<string, unknown>>)];
                          sections[i] = { ...s, title: e.target.value };
                          setCurrent({ ...current, sections });
                        }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {preview && (
                <div className="ad-card p-6 prose dark:prose-invert max-w-none">
                  <p className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--ad-muted)' }}>Live</p>
                  <h1 className="!mt-1">{String(current.title)}</h1>
                  {current.subtitle && <p className="lead">{String(current.subtitle)}</p>}
                  <div dangerouslySetInnerHTML={{ __html: String(current.content || '') }} />
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
