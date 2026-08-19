'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Save } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { PAGE_BUILDER_CSS, PAGE_TEMPLATES, builderKey } from '@/lib/page-templates';

type EditorLike = {
  getHtml: () => string;
  getCss: () => string;
  setComponents: (h: string) => void;
  setStyle: (c: string) => void;
  destroy?: () => void;
  Canvas: { getDocument: () => Document | undefined };
  BlockManager: { get: (id: string) => unknown; add: (id: string, def: { label: string; content: string }) => void };
};

export default function BuilderPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorLike | null>(null);
  const [lang, setLang] = useState(locale);
  const [slug, setSlug] = useState('home');
  const [ready, setReady] = useState(false);

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
        canvas: {
          styles: ['/globals.css'],
        },
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
      if (!bm.get('sari-hero')) {
        bm.add('sari-hero', { label: 'Hero SARI', content: '<section class="hero"><div class="wrap"><h1>Titre</h1><p>Sous-titre</p><a class="btn" href="#">CTA</a></div></section>' });
        bm.add('sari-card', { label: 'Carte', content: '<article class="card"><h3>Titre</h3><p class="muted">Texte</p></article>' });
        bm.add('sari-grid', { label: 'Grille 3', content: '<section class="wrap grid"><article class="card"><h3>A</h3></article><article class="card"><h3>B</h3></article><article class="card"><h3>C</h3></article></section>' });
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

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="ad-breadcrumb">Paramètres du site vitrine / Éditeur visuel</div>
          <h1 className="text-3xl font-black">Éditeur de pages (GrapesJS)</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>La page réelle de la vitrine est chargée avec la charte #199ACA / #C6DA34 / #EBB518. Basculez la langue pour l’arabe (RTL).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="ad-select w-48" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {PAGE_TEMPLATES.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
          </select>
          {['fr', 'en', 'ar'].map((l) => (
            <button key={l} className={`ad-btn ${lang === l ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
          <button className="ad-btn ad-btn-lime" disabled={!ready} onClick={() => {
            if (!editor.current) return;
            localStorage.setItem(builderKey(slug, lang), JSON.stringify({ html: editor.current.getHtml(), css: editor.current.getCss() }));
            showToast('Page enregistrée', 'success');
          }}><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </header>
      <div className="ad-card overflow-hidden" ref={host} />
    </div>
  );
}
