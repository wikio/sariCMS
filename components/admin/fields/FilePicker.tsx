'use client';

import { useState } from 'react';
import { Download, Eye, FolderOpen, Upload } from 'lucide-react';
import GedPicker from '@/components/admin/GedPicker';

async function uploadOriginal(file: File, moduleName = 'documents') {
  const body = new FormData();
  body.append('file', file);
  body.append('module', moduleName);
  body.append('label', file.name);
  const res = await fetch('/api/admin/upload', { method: 'POST', body });
  const json = await res.json();
  return json.url as string | undefined;
}

export default function FilePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [ged, setGed] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input className="ad-input flex-1 min-w-[180px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL ou fichier GED…" />
        <label className="ad-btn ad-btn-ghost cursor-pointer">
          <Upload className="w-4 h-4" /> PDF
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = await uploadOriginal(f);
            if (url) onChange(url);
          }} />
        </label>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setGed(true)}><FolderOpen className="w-4 h-4" /> GED</button>
        {value ? (
          <>
            <a className="ad-btn ad-btn-ghost" href={value} target="_blank" rel="noreferrer"><Eye className="w-4 h-4" /> Consulter</a>
            <a className="ad-btn ad-btn-ghost" href={value} download><Download className="w-4 h-4" /> Télécharger</a>
          </>
        ) : null}
      </div>
      {ged && <GedPicker accept=".pdf,application/pdf" onClose={() => setGed(false)} onPick={(url) => { onChange(url); setGed(false); }} />}
    </div>
  );
}
