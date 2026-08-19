'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';

export default function GedPicker({
  accept = 'image/*,.pdf',
  onPick,
  onClose,
}: {
  accept?: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [q, setQ] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/upload');
    const json = await res.json();
    setFiles(json.files || []);
  };

  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body });
    const json = await res.json();
    if (json.url) onPick(json.url);
  };

  const shown = files.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="ad-modal" onClick={onClose}>
      <div className="ad-modal-card space-y-3" style={{ width: 'min(860px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">Médiathèque GED</h3>
          <label className="ad-btn ad-btn-primary cursor-pointer">
            <Upload className="w-4 h-4" /> Importer
            <input type="file" accept={accept} multiple className="hidden" onChange={(e) => {
              const list = Array.from(e.target.files || []);
              list.forEach(upload);
            }} />
          </label>
        </div>
        <input className="ad-input" placeholder="Rechercher un fichier…" value={q} onChange={(e) => setQ(e.target.value)} />
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
        <div className="flex justify-end"><button className="ad-btn ad-btn-ghost" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}
