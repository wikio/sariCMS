'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Save } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';

export default function BuilderPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<{ getHtml: () => string; getCss: () => string; setComponents: (h: string) => void } | null>(null);
  const [lang, setLang] = useState(locale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const grapes = await import('grapesjs');
      await import('grapesjs/dist/css/grapes.min.css');
      if (cancelled || !host.current) return;
      const init = (grapes as { default?: { init: typeof grapes.init }; init?: typeof grapes.init }).default?.init || grapes.init;
      const ed = init({
        container: host.current,
        height: '70vh',
        fromElement: false,
        storageManager: false,
        canvas: { styles: ['/globals.css'] },
      });
      const saved = localStorage.getItem(`sari_page_builder_${lang}`);
      ed.setComponents(saved || `<section style="padding:48px;font-family:Inter,sans-serif"><h1 style="color:#199ACA">Page vitrine</h1><p>Éditez ce contenu comme un page-builder. Charte #199ACA / #C6DA34 / #EBB518.</p><a href="/${lang}/products" style="background:#C6DA34;padding:12px 18px;border-radius:10px;text-decoration:none;color:#2a3308">Voir le catalogue</a></section>`);
      editor.current = ed;
      setReady(true);
    })();
    return () => { cancelled = true; editor.current = null; };
  }, [lang]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="ad-breadcrumb">Paramètres du site vitrine / Éditeur visuel</div>
          <h1 className="text-3xl font-black">Éditeur de pages (GrapesJS)</h1>
        </div>
        <div className="flex gap-2">
          {['fr', 'en', 'ar'].map((l) => (
            <button key={l} className={`ad-btn ${lang === l ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
          <button className="ad-btn ad-btn-lime" disabled={!ready} onClick={() => {
            if (!editor.current) return;
            localStorage.setItem(`sari_page_builder_${lang}`, editor.current.getHtml());
            showToast('Page enregistrée', 'success');
          }}><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </header>
      <div className="ad-card overflow-hidden" ref={host} />
    </div>
  );
}
