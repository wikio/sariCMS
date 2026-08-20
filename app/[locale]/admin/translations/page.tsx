'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown, ChevronRight, Download, FileJson, Folder, RefreshCw, Save, Search } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';

interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  path?: string;
  children?: TreeNode[];
}

export default function AdminTranslationEditorPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const [editLang, setEditLang] = useState(locale);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [node, setNode] = useState<TreeNode | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const loadTree = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/translations/tree?locale=${editLang}`);
      const json = await res.json();
      setTree(json.tree || []);
      setOpen(new Set((json.tree || []).map((n: TreeNode) => n.id)));
    } catch {
      showToast('Arborescence indisponible', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTree(); setNode(null); }, [editLang]);

  useEffect(() => {
    if (!node?.path) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/translations/file?locale=${editLang}&path=${encodeURIComponent(node.path!)}`);
        setData(res.ok ? await res.json() : {});
      } finally {
        setLoading(false);
      }
    })();
  }, [node, editLang]);

  const flat = useMemo(() => flatten(data), [data]);
  const shown = Object.entries(flat).filter(([k, v]) => !q || k.toLowerCase().includes(q.toLowerCase()) || String(v).toLowerCase().includes(q.toLowerCase()));

  const setKey = (key: string, value: string) => {
    const next = structuredClone(data);
    const parts = key.split('.');
    let cur: Record<string, unknown> = next;
    parts.slice(0, -1).forEach((p) => {
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    });
    cur[parts[parts.length - 1]] = value;
    setData(next);
  };

  const save = async () => {
    if (!node?.path) return;
    try {
      const res = await fetch(`/api/admin/translations/file?locale=${editLang}&path=${encodeURIComponent(node.path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('save');
      showToast('Traductions enregistrées', 'success');
    } catch {
      showToast('Écriture impossible', 'error');
    }
  };

  const renderNode = (n: TreeNode, depth = 0) => {
    if (n.type === 'folder') {
      const expanded = open.has(n.id);
      return (
        <div key={n.id}>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm min-w-0" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => setOpen((s) => { const nset = new Set(s); nset.has(n.id) ? nset.delete(n.id) : nset.add(n.id); return nset; })}>
            {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
            <Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--ad-accent)' }} />
            <span className="truncate">{n.label}</span>
          </button>
          {expanded && n.children?.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }
    return (
      <button key={n.id} onClick={() => setNode(n)} className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 min-w-0 ${node?.id === n.id ? 'font-bold' : ''}`} style={{ paddingLeft: 20 + depth * 12, background: node?.id === n.id ? 'color-mix(in srgb, var(--ad-accent) 16%, transparent)' : undefined }}>
        <FileJson className="w-4 h-4 shrink-0" /> <span className="truncate">{n.label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="ad-card p-4 flex flex-wrap items-center justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--ad-muted)' }}>i18n</div>
          <h1 className="text-2xl font-black">Gestionnaire de traductions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>
            L’interface d’administration (menus, boutons, messages) est indépendante de la traduction du contenu vitrine.
            Ouvrez le fichier <code>admin.json</code> pour traduire le back-office.
          </p>
        </div>
        <div className="flex gap-2">
          {['fr', 'en', 'ar'].map((l) => (
            <button key={l} onClick={() => setEditLang(l)} className={`ad-btn ${editLang === l ? 'ad-btn-primary' : 'ad-btn-ghost'}`}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div className="grid lg:grid-cols-4 gap-4 lg:h-[calc(100vh-230px)] lg:min-h-[420px]">
        <aside className="ad-card p-3 ad-rise ad-rise-2 h-full min-h-0 min-w-0 overflow-auto ad-scroll">
          <div className="flex items-center justify-between mb-2 sticky top-0 z-10" style={{ background: 'var(--ad-surface)' }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>Arbre</span>
            <button onClick={loadTree}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
          {tree.map((n) => renderNode(n))}
        </aside>
        <section className="lg:col-span-3 min-w-0 ad-card p-4 ad-rise ad-rise-3 h-full min-h-0 flex flex-col overflow-hidden">
          {!node ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--ad-muted)' }}>Choisissez un fichier JSON</div>
          ) : loading ? (
            <PixelGridLoader compact label="i18n" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 shrink-0">
                <h2 className="font-black">{node.label} · {shown.length} clés</h2>
                <div className="flex gap-2">
                  <button className="ad-btn ad-btn-ghost" onClick={() => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${node.label}_${editLang}.json`; a.click();
                  }}><Download className="w-4 h-4" /> Export</button>
                  <button className="ad-btn ad-btn-primary" onClick={save}><Save className="w-4 h-4" /> Sauver</button>
                </div>
              </div>
              <div className="relative mb-3 shrink-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
                <input className="ad-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer une clé ou une valeur…" />
              </div>
              <div className="space-y-2 flex-1 min-h-0 overflow-y-auto ad-scroll">
                {shown.map(([key, value]) => (
                  <label key={key} className="block ad-card p-3">
                    <code className="text-[11px] font-mono" style={{ color: 'var(--ad-accent)' }}>{key}</code>
                    {typeof value === 'string' ? (
                      <input className="ad-input mt-2" defaultValue={value} onBlur={(e) => setKey(key, e.target.value)} />
                    ) : (
                      <div className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{Array.isArray(value) ? `Array(${value.length})` : 'Objet'}</div>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}
