'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy, Download, FolderOpen, Image as ImageIcon, Pencil, Trash2, Upload,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import Drawer from '@/components/admin/Drawer';
import ImageEditor from '@/components/admin/ImageEditor';
import { useToast } from '@/components/admin/Toast';
import { CMS_MODULES } from '@/lib/cms-modules';
import { useTranslations } from 'next-intl';

type MediaItem = {
  file: string;
  url: string;
  name?: string;
  originalName: string;
  module: string;
  label: string;
  title?: string;
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
  size: number;
};

const isImage = (url: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(url);

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function MediaPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.media');
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [over, setOver] = useState(false);
  const [q, setQ] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', module: 'ged', label: '' });
  const [editingImage, setEditingImage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/upload');
    const json = await res.json();
    setFiles(json.files || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    setBusy(true);
    const body = new FormData();
    body.append('file', file);
    body.append('module', moduleName || 'ged');
    body.append('label', file.name);
    body.append('title', file.name.replace(/\.[^.]+$/, ''));
    const res = await fetch('/api/admin/upload', { method: 'POST', body });
    if (!res.ok) { showToast('Upload refusé', 'error'); }
    else { showToast('Fichier ajouté à la GED', 'success'); }
    setBusy(false);
    load();
  };

  const shown = useMemo(() => files.filter((f) => {
    if (moduleName && f.module !== moduleName) return false;
    if (category && f.category !== category) return false;
    if (kind === 'image' && !isImage(f.url)) return false;
    if (kind === 'file' && isImage(f.url)) return false;
    if (!q.trim()) return true;
    const blob = `${f.title || ''} ${f.label} ${f.originalName} ${f.module} ${f.category || ''} ${f.description || ''}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  }), [files, q, moduleName, category, kind]);

  const modules = useMemo(() => Array.from(new Set([...CMS_MODULES.map((m) => m.key), ...files.map((f) => f.module)].filter(Boolean))).sort(), [files]);
  const categories = useMemo(() => Array.from(new Set(files.map((f) => f.category).filter(Boolean))).sort() as string[], [files]);

  const openEdit = (f: MediaItem) => {
    setEditing(f);
    setForm({
      title: f.title || '',
      description: f.description || '',
      category: f.category || '',
      module: f.module || 'ged',
      label: f.label || f.originalName || '',
    });
  };

  const saveMeta = async () => {
    if (!editing) return;
    const res = await fetch('/api/admin/upload', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: editing.file, ...form }),
    });
    const json = await res.json();
    if (!res.ok) { showToast(json.error || 'Erreur', 'error'); return; }
    showToast('Métadonnées enregistrées', 'success');
    setEditing(null);
    load();
  };

  const remove = async (f: MediaItem) => {
    if (!confirm(`Supprimer « ${f.title || f.label} » définitivement ?`)) return;
    const res = await fetch(`/api/admin/upload?file=${encodeURIComponent(f.file)}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Suppression impossible', 'error'); return; }
    showToast('Fichier supprimé', 'success');
    load();
  };

  const copyUrl = (f: MediaItem) => {
    navigator.clipboard.writeText(f.url);
    showToast('URL copiée', 'success');
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--ad-muted)' }}>{t("ged")}</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Gestion des fichiers : renommage, titre, description, catégorie, édition d’images.</p>
        </div>
        <label className="ad-btn ad-btn-primary cursor-pointer">
          <Upload className="w-4 h-4" /> {busy ? 'Import…' : 'Importer'}
          <input type="file" className="hidden" multiple accept="image/*,.pdf,.svg" onChange={(e) => { Array.from(e.target.files || []).forEach(upload); e.target.value = ''; }} />
        </label>
      </header>

      <div className="ad-card p-3 grid md:grid-cols-4 gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Titre, nom, description…" />
        <select className="ad-select" value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
          <option value="">{t("allModules")}</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="ad-select" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">{t("allTypes")}</option>
          <option value="image">{t("images")}</option>
          <option value="file">{t("documents")}</option>
        </select>
      </div>

      <div
        className="ad-card p-6 text-center text-sm"
        style={{ borderStyle: 'dashed', background: over ? 'color-mix(in srgb, var(--ad-accent) 8%, transparent)' : undefined }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); Array.from(e.dataTransfer.files || []).forEach(upload); }}
      >
        Glissez-déposez des fichiers ici, ou utilisez le bouton « Importer ».
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label="GED" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {shown.map((f) => (
            <div key={f.url} className="ad-card overflow-hidden flex flex-col">
              <button type="button" className="relative block w-full" onClick={() => copyUrl(f)} title="Copier l’URL">
                {isImage(f.url) ? (
                  <img src={f.url} alt={f.title || f.label} className="h-28 w-full object-contain bg-[var(--ad-surface-2)]" />
                ) : (
                  <div className="h-28 flex items-center justify-center bg-[var(--ad-surface-2)]">
                    <FolderOpen className="w-8 h-8" style={{ color: 'var(--ad-muted)' }} />
                  </div>
                )}
                <span className="absolute top-1 right-1 ad-chip ad-chip-acc">{f.module}</span>
              </button>
              <div className="p-2 space-y-1 flex-1">
                <div className="text-xs font-black truncate" title={f.title || f.label}>{f.title || f.label}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--ad-muted)' }}>
                  {f.category ? `${f.category} · ` : ''}{fmtSize(f.size)}
                </div>
              </div>
              <div className="p-2 pt-0 flex items-center gap-1 border-t border-[var(--ad-line)]">
                <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" title="Copier l’URL" onClick={() => copyUrl(f)}>
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a className="ad-btn ad-btn-icon ad-btn-ghost" href={f.url} target="_blank" rel="noreferrer" download title="Télécharger">
                  <Download className="w-3.5 h-3.5" />
                </a>
                {isImage(f.url) && (
                  <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" title="Éditer l’image" onClick={() => setEditingImage(f.url)}>
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" title="Informations / renommer" onClick={() => openEdit(f)}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="ad-btn ad-btn-icon ad-btn-danger ml-auto" title="Supprimer" onClick={() => remove(f)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <div className="col-span-full ad-card p-10 text-center" style={{ color: 'var(--ad-muted)' }}>{t("noFiles")}</div>
          )}
        </div>
      )}

      {/* Drawer métadonnées / renommage */}
      <Drawer
        open={!!editing}
        title="Informations du fichier"
        subtitle={editing?.file}
        onClose={() => setEditing(null)}
        width={520}
        footer={
          <>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setEditing(null)}>Annuler</button>
            <button type="button" className="ad-btn ad-btn-primary" onClick={saveMeta}>Enregistrer</button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            {isImage(editing.url) && (
              <div className="flex justify-center py-2">
                <img src={editing.url} alt="" className="max-h-40 rounded border border-[var(--ad-line)]" />
              </div>
            )}
            <label className="space-y-1.5 block">
              <span className="field-label">Nom du fichier (renommage)</span>
              <input className="ad-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>Renomme le fichier sur le disque. L’URL change en conséquence.</p>
            </label>
            <label className="space-y-1.5 block">
              <span className="field-label">Titre</span>
              <input className="ad-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="space-y-1.5 block">
              <span className="field-label">Description</span>
              <textarea className="ad-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 block">
                <span className="field-label">Module</span>
                <select className="ad-select" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                  {modules.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 block">
                <span className="field-label">Catégorie</span>
                <input className="ad-input" list="ged-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <datalist id="ged-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
            </div>
            <div className="text-[11px] space-y-0.5" style={{ color: 'var(--ad-muted)' }}>
              <div>Nom d’origine : {editing.originalName}</div>
              <div>Ajouté le : {editing.createdAt ? new Date(editing.createdAt).toLocaleString() : '—'}</div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Éditeur d’images */}
      {editingImage && (
        <ImageEditor
          src={editingImage}
          onClose={() => setEditingImage(null)}
          onSaved={(url) => { setEditingImage(null); load(); }}
        />
      )}
    </div>
  );
}
