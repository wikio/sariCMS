'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';

export default function MediaPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [loading, setLoading] = useState(true);

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
    const res = await fetch('/api/admin/upload', { method: 'POST', body });
    if (!res.ok) {
      showToast('Upload refusé', 'error');
      return;
    }
    showToast('Fichier ajouté à la GED', 'success');
    load();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--ad-muted)' }}>GED</div>
          <h1 className="text-3xl font-black">Médiathèque</h1>
        </div>
        <label className="ad-btn ad-btn-primary cursor-pointer">
          <Upload className="w-4 h-4" /> Importer
          <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </header>
      {loading ? <div className="ad-card"><PixelGridLoader label="GED" /></div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {files.map((f) => (
            <button key={f.url} className="ad-card ad-tile overflow-hidden text-left" onClick={() => { navigator.clipboard.writeText(f.url); }}>
              {f.url.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                <img src={f.url} alt="" className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 flex items-center justify-center"><FolderOpen /></div>
              )}
              <div className="p-2 text-[11px] truncate font-mono">{f.name}</div>
            </button>
          ))}
          {files.length === 0 && <div className="col-span-full ad-card p-10 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun fichier. Importez images ou PDF.</div>}
        </div>
      )}
    </div>
  );
}
