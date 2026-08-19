'use client';

import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import { useToast } from '@/components/admin/Toast';
import { CMS_MODULES } from '@/lib/cms-modules';

type MediaItem = {
  file: string;
  url: string;
  originalName: string;
  module: string;
  label: string;
  createdAt: string;
  size: number;
};

export default function MediaPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [over, setOver] = useState(false);
  const [q, setQ] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [from, setFrom] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/upload');
    const json = await res.json();
    setFiles(json.files || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    body.append('module', moduleName || 'ged');
    body.append('label', file.name);
    const res = await fetch('/api/admin/upload', { method: 'POST', body });
    if (!res.ok) { showToast('Upload refusé', 'error'); return; }
    showToast('Fichier ajouté à la GED', 'success');
    load();
  };

  const shown = useMemo(() => files.filter((f) => {
    if (moduleName && f.module !== moduleName) return false;
    if (from && f.createdAt && f.createdAt.slice(0, 10) < from) return false;
    if (!q.trim()) return true;
    const blob = `${f.label} ${f.originalName} ${f.module} ${f.file}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  }), [files, q, moduleName, from]);

  const modules = Array.from(new Set([...CMS_MODULES.map((m) => m.key), ...files.map((f) => f.module)].filter(Boolean)));

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--ad-muted)' }}>GED</div>
          <h1 className="text-3xl font-black">Médiathèque</h1>
        </div>
        <label className="ad-btn ad-btn-primary cursor-pointer">
          <Upload className="w-4 h-4" /> Importer
          <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={(e) => Array.from(e.target.files || []).forEach(upload)} />
        </label>
      </header>
      <div className="ad-card p-3 grid md:grid-cols-3 gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Nom, fichier, module…" />
        <select className="ad-select" value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
          <option value="">Tous les modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="ad-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div
        className="ad-card p-8 text-center"
        style={{ borderStyle: 'dashed', background: over ? 'color-mix(in srgb, var(--ad-accent) 8%, transparent)' : undefined }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); Array.from(e.dataTransfer.files || []).forEach(upload); }}
      >
        Glissez-déposez ici. Liaison enregistrée : module / nom d’origine.
      </div>
      {loading ? <div className="ad-card"><PixelGridLoader label="GED" /></div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {shown.map((f) => (
            <button key={f.url} className="ad-card overflow-hidden text-left" onClick={() => { navigator.clipboard.writeText(f.url); showToast('URL copiée', 'success'); }}>
              {f.url.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                <img src={f.url} alt="" className="h-28 w-full object-contain bg-[var(--ad-surface-2)]" />
              ) : (
                <div className="h-28 flex items-center justify-center"><FolderOpen /></div>
              )}
              <div className="p-2 space-y-0.5">
                <div className="text-[11px] font-black truncate">{f.module} / {f.label || f.originalName}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--ad-muted)' }}>{f.createdAt ? new Date(f.createdAt).toLocaleString() : '—'}</div>
              </div>
            </button>
          ))}
          {shown.length === 0 && <div className="col-span-full ad-card p-10 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun fichier.</div>}
        </div>
      )}
    </div>
  );
}
