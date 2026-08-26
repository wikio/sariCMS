'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, FolderOpen, Trash2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type GedFile = {
  name: string;
  url: string;
  file?: string;
  originalName?: string;
  label?: string;
  title?: string;
  description?: string;
  category?: string;
  module?: string;
  createdAt?: string;
};

function fileName(f: Partial<GedFile> | null | undefined) {
  return String(f?.title || f?.label || f?.originalName || f?.name || f?.file || f?.url || '').trim();
}

function normalize(raw: unknown): GedFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const url = String(row.url || (row.file ? `/uploads/${row.file}` : ''));
  if (!url) return null;
  const name = fileName(row);
  return {
    name: name || url.split('/').pop() || url,
    url,
    file: row.file ? String(row.file) : undefined,
    originalName: row.originalName ? String(row.originalName) : undefined,
    label: row.label ? String(row.label) : undefined,
    title: row.title ? String(row.title) : undefined,
    description: row.description ? String(row.description) : undefined,
    category: row.category ? String(row.category) : undefined,
    module: row.module ? String(row.module) : undefined,
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
  };
}

export default function GedPicker({
  accept = 'image/*,.pdf',
  onPick,
  onClose,
}: {
  accept?: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('admin.gedPicker');
  const [files, setFiles] = useState<GedFile[]>([]);
  const [q, setQ] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [renamingFile, setRenamingFile] = useState<GedFile | null>(null);
  const [newName, setNewName] = useState('');
  const [replacingFile, setReplacingFile] = useState<GedFile | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/upload');
      const json = await res.json();
      setFiles((json.files || []).map(normalize).filter(Boolean) as GedFile[]);
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('module', 'ged');
      body.append('label', file.name);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const json = await res.json();
      if (json.url) {
        onPick(json.url);
        load(); // Recharger la liste
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteFile = async (file: GedFile) => {
    if (!confirm(`Supprimer le fichier "${file.name}" ?`)) return;
    try {
      const res = await fetch(`/api/admin/upload?file=${encodeURIComponent(file.file || '')}`, { method: 'DELETE' });
      if (res.ok) {
        load(); // Recharger la liste
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const startRename = (file: GedFile) => {
    setRenamingFile(file);
    setNewName(file.name.replace(/\.[^/.]+$/, '')); // Enlever l'extension
  };

  const renameFile = async () => {
    if (!renamingFile || !newName.trim()) return;
    try {
      const oldFile = renamingFile.file || '';
      const ext = oldFile.split('.').pop() || '';
      const newFileName = `${newName.trim()}.${ext}`;
      const res = await fetch('/api/admin/upload', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldFile, newFile: newFileName }),
      });
      if (res.ok) {
        setRenamingFile(null);
        setNewName('');
        load(); // Recharger la liste
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  };

  const replaceFile = async (file: File) => {
    if (!replacingFile) return;
    setBusy(true);
    try {
      // Supprimer l'ancien fichier
      await fetch(`/api/admin/upload?file=${encodeURIComponent(replacingFile.file || '')}`, { method: 'DELETE' });
      
      // Upload le nouveau fichier avec le même nom
      const body = new FormData();
      body.append('file', file);
      body.append('module', replacingFile.module || 'ged');
      body.append('label', replacingFile.label || file.name);
      body.append('slug', replacingFile.name.replace(/\.[^/.]+$/, ''));
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const json = await res.json();
      if (json.url) {
        setReplacingFile(null);
        load(); // Recharger la liste
      }
    } finally {
      setBusy(false);
    }
  };

  const modules = useMemo(() => Array.from(new Set(files.map((f) => f.module).filter(Boolean))).sort(), [files]);
  const categories = useMemo(() => Array.from(new Set(files.map((f) => f.category).filter(Boolean))).sort() as string[], [files]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return files.filter((f) => {
      if (moduleName && f.module !== moduleName) return false;
      if (category && f.category !== category) return false;
      if (!needle) return true;
      const blob = `${f.name} ${f.label || ''} ${f.originalName || ''} ${f.module || ''} ${f.description || ''} ${f.url}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [files, q, moduleName, category]);

  const modal = (
    <div className="ad-modal" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="ad-modal-card space-y-3" style={{ width: 'min(860px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">{t('title')}</h3>
          <div className="flex gap-2">
            <label className="ad-btn ad-btn-primary cursor-pointer">
              <Upload className="w-4 h-4" /> {busy ? t('importing') : t('importBtn')}
              <input type="file" accept={accept} multiple className="hidden" onChange={(e) => {
                Array.from(e.target.files || []).forEach(upload);
              }} />
            </label>
            <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onClose} aria-label={t('close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className="ad-input" placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="ad-select" value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
            <option value="">{t('allModules')}</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('allCategories')}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[50vh] overflow-auto">
          {shown.map((f) => (
            <div key={f.url} className="ad-card overflow-hidden text-left relative group">
              <button type="button" className="w-full" onClick={() => onPick(f.url)}>
                {f.url.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                  <img src={f.url} alt="" className="h-24 w-full object-contain bg-[var(--ad-surface-2)]" />
                ) : (
                  <div className="h-24 flex items-center justify-center"><FolderOpen className="w-6 h-6" /></div>
                )}
                <div className="p-2 text-[11px] truncate font-mono">{f.name}</div>
              </button>
              {/* Boutons d'action */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className="ad-btn ad-btn-icon ad-btn-ghost bg-white/90 dark:bg-gray-800/90"
                  onClick={(e) => { e.stopPropagation(); startRename(f); }}
                  title={t('rename')}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="ad-btn ad-btn-icon ad-btn-ghost bg-white/90 dark:bg-gray-800/90"
                  onClick={(e) => { e.stopPropagation(); setReplacingFile(f); }}
                  title={t('replace')}
                >
                  <Upload className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="ad-btn ad-btn-icon ad-btn-danger bg-white/90 dark:bg-gray-800/90"
                  onClick={(e) => { e.stopPropagation(); deleteFile(f); }}
                  title={t('delete')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {shown.length === 0 && <div className="col-span-full text-sm p-6 text-center" style={{ color: 'var(--ad-muted)' }}>{t('noFiles')}</div>}
        </div>

        {/* Formulaire de renommage */}
        {renamingFile && (
          <div className="ad-card p-3 space-y-2">
            <h4 className="font-bold text-sm">{t('renameFile')}</h4>
            <div className="flex gap-2">
              <input
                className="ad-input flex-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') renameFile(); }}
                autoFocus
              />
              <button type="button" className="ad-btn ad-btn-primary" onClick={renameFile}>
                {t('save')}
              </button>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => { setRenamingFile(null); setNewName(''); }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Formulaire de remplacement */}
        {replacingFile && (
          <div className="ad-card p-3 space-y-2">
            <h4 className="font-bold text-sm">{t('replaceFile', { name: replacingFile.name })}</h4>
            <div className="flex gap-2">
              <label className="ad-btn ad-btn-primary cursor-pointer">
                <Upload className="w-4 h-4" /> {busy ? t('importing') : t('selectFile')}
                <input
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && replaceFile(e.target.files[0])}
                />
              </label>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setReplacingFile(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end"><button type="button" className="ad-btn ad-btn-ghost" onClick={onClose}>{t('close')}</button></div>
      </div>
    </div>
  );

  // Render via Portal to escape parent stacking context (ad-rise transform)
  if (!mounted) return null;
  // Copy admin theme attribute so CSS variables are available in the portal
  const themeAttr = document.querySelector('[data-admin-theme]')?.getAttribute('data-admin-theme') || 'light';
  return createPortal(<div data-admin-theme={themeAttr}>{modal}</div>, document.body);
}
