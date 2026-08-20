'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Code, Eye, Plus, Save, Layers } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { PAGE_BUILDER_CSS, PAGE_TEMPLATES, builderKey } from '@/lib/page-templates';
import { BUILDER_COMPONENTS, builderComponentById } from '@/lib/builder-components';

type EditorLike = {
  getHtml: () => string;
  getCss: () => string;
  setComponents: (h: string) => void;
  setStyle: (c: string) => void;
  addComponents: (h: string) => void;
  runCommand: (cmd: string) => void;
  destroy?: () => void;
  Canvas: { getDocument: () => Document | undefined };
  BlockManager: { get: (id: string) => unknown; add: (id: string, def: { label: string; content: string; category?: string }) => void };
};

export default function BuilderPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorLike | null>(null);
  const [lang, setLang] = useState(locale);
  const [slug, setSlug] = useState('home');
  const [ready, setReady] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    let ed: { destroy?: () => void } | null = null;
    (async () => {
      const grapes = await import('grapesjs') as unknown as { default?: { init: (opts: Record<string, unknown>) => EditorLike }; init?: (opts: Record<string, unknown>) => EditorLike };
      await import('grapesjs/dist/css/grapes.min.css');
      if (cancelled || !host.current) return;
      const init = grapes.default?.init || grapes.init;
      if (!init) return;
      const instance = init({
        container: host.current,
        height: '72vh',
        fromElement: false,
        storageManager: false,
        noticeOnUnload: false,
        canvas: { styles: ['/globals.css'] },
        blockManager: { appendTo: '' },
        deviceManager: {
          devices: [
            { name: 'Desktop', width: '' },
            { name: 'Tablet', width: '768px' },
            { name: 'Mobile', width: '375px' },
          ],
        },
      });
      const tpl = PAGE_TEMPLATES.find((p) => p.slug === slug) || PAGE_TEMPLATES[0];
      const savedRaw = localStorage.getItem(builderKey(slug, lang));
      let html = tpl.html(lang);
      let css = PAGE_BUILDER_CSS;
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw) as { html?: string; css?: string };
          html = parsed.html || html;
          css = parsed.css || css;
        } catch {
          html = savedRaw;
        }
      }
      instance.setComponents(html);
      instance.setStyle(css);
      instance.Canvas.getDocument()?.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      const bm = instance.BlockManager;
      // Enregistre tous les composants existants de la vitrine comme blocs GrapesJS.
      for (const c of BUILDER_COMPONENTS) {
        if (!bm.get(c.id)) bm.add(c.id, { label: c.label, content: c.html, category: c.category });
      }
      editor.current = instance;
      ed = instance;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      try { ed?.destroy?.(); } catch { /* ignore */ }
      editor.current = null;
      setReady(false);
    };
  }, [lang, slug]);

  const categories = useMemo(() => {
    const map = new Map<string, typeof BUILDER_COMPONENTS>();
    for (const c of BUILDER_COMPONENTS) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map(([cat, items]) => [cat, items.filter((c) => c.label.toLowerCase().includes(q))] as const)
      .filter(([, items]) => items.length > 0);
  }, [categories, query]);

  const addComponent = (id: string) => {
    const c = builderComponentById(id);
    if (!c || !editor.current) return;
    editor.current.addComponents(c.html);
    showToast(`« ${c.label} » ajouté à la page`, 'success');
  };

  const save = () => {
    if (!editor.current) return;
    localStorage.setItem(builderKey(slug, lang), JSON.stringify({ html: editor.current.getHtml(), css: editor.current.getCss() }));
    showToast('Page enregistrée', 'success');
  };

  const toggleCode = () => {
    if (!editor.current) return;
    if (showCode) {
      setShowCode(false);
    } else {
      setCode(`<!-- HTML -->\n${editor.current.getHtml()}\n\n/* CSS */\n${editor.current.getCss()}`);
      setShowCode(true);
    }
  };

  const togglePreview = () => {
    editor.current?.runCommand('core:preview');
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2 ad-rise">
        <div>
          <div className="ad-breadcrumb">Paramètres du site vitrine / Éditeur visuel</div>
          <h1 className="text-3xl font-black">Éditeur de pages (GrapesJS)</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
            Ajoutez des composants existants de la vitrine, configurez-les (double-clic pour éditer, style à droite) et enregistrez.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="ad-select w-48" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {PAGE_TEMPLATES.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
          </select>
          {['fr', 'en', 'ar'].map((l) => (
            <button key={l} className={`ad-btn ${lang === l ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
          <button className="ad-btn ad-btn-ghost" disabled={!ready} onClick={togglePreview}><Eye className="w-4 h-4" /> Aperçu</button>
          <button className="ad-btn ad-btn-ghost" disabled={!ready} onClick={toggleCode}><Code className="w-4 h-4" /> {showCode ? 'Éditeur' : 'Code'}</button>
          <button className="ad-btn ad-btn-lime" disabled={!ready} onClick={save}><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <aside className="ad-card p-3 ad-rise ad-rise-2 max-h-[74vh] min-w-0 overflow-y-auto ad-scroll space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--ad-muted)' }}>
              <Layers className="w-4 h-4" /> Composants existants
            </div>
            <input className="ad-input" placeholder="Filtrer les composants…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {filtered.map(([cat, items]) => (
            <div key={cat} className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] font-black" style={{ color: 'var(--ad-accent)' }}>{cat}</div>
              {items.map((c) => (
                <button key={c.id} className="ad-card ad-card-hover w-full p-3 text-left flex items-start justify-between gap-2" onClick={() => addComponent(c.id)}>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{c.label}</span>
                    <span className="block text-[11px] mt-0.5" style={{ color: 'var(--ad-muted)' }}>{c.description}</span>
                  </span>
                  <Plus className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--ad-accent)' }} />
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-sm py-4" style={{ color: 'var(--ad-muted)' }}>Aucun composant.</div>}
        </aside>

        <div className="min-w-0">
          {showCode ? (
            <pre className="ad-card p-4 text-xs overflow-auto ad-scroll max-h-[74vh] whitespace-pre-wrap" style={{ color: 'var(--ad-ink)' }}>{code}</pre>
          ) : (
            <div className="ad-card overflow-hidden ad-rise ad-rise-3" ref={host} />
          )}
        </div>
      </div>
    </div>
  );
}
