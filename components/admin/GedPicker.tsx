'use client';

import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Upload, X } from 'lucide-react';

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
  const [files, setFiles] = useState<GedFile[]>([]);
  const [q, setQ] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

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
      if (json.url) onPick(json.url);
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

  return (
    <div className="ad-modal" onClick={onClose}>
      <div className="ad-modal-card space-y-3" style={{ width: 'min(860px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">Médiathèque GED</h3>
          <div className="flex gap-2">
            <label className="ad-btn ad-btn-primary cursor-pointer">
              <Upload className="w-4 h-4" /> {busy ? 'Import…' : 'Importer'}
              <input type="file" accept={accept} multiple className="hidden" onChange={(e) => {
                Array.from(e.target.files || []).forEach(upload);
              }} />
            </label>
            <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onClose} aria-label="Fermer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className="ad-input" placeholder="Rechercher un fichier…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="ad-select" value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
            <option value="">Tous les modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[50vh] overflow-auto">
          {shown.map((f) => (
            <button key={f.url} type="button" className="ad-card overflow-hidden text-left" onClick={() => onPick(f.url)}>
              {f.url.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                <img src={f.url} alt="" className="h-24 w-full object-contain bg-[var(--ad-surface-2)]" />
              ) : (
                <div className="h-24 flex items-center justify-center"><FolderOpen className="w-6 h-6" /></div>
              )}
              <div className="p-2 text-[11px] truncate font-mono">{f.name}</div>
            </button>
          ))}
          {shown.length === 0 && <div className="col-span-full text-sm p-6 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun fichier</div>}
        </div>
        <div className="flex justify-end"><button type="button" className="ad-btn ad-btn-ghost" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}
