'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Barcode, Check, Copy, Download, ExternalLink, Image as ImageIcon, QrCode, RefreshCw, Share2, Wand2 } from 'lucide-react';
import { uploadGedAsset } from '@/lib/ged/client';

type SourceKind = 'articles' | 'events' | 'products' | 'services' | 'solutions' | 'pages' | 'announcements' | 'tips';
type ContentItem = { id?: string | number; slug?: string; title?: string; name?: string; shortDesc?: string; image?: string };
const SOURCES: Array<{ id: SourceKind; label: string; endpoint: string }> = [
  { id: 'articles', label: 'Articles / actualités', endpoint: 'news' },
  { id: 'announcements', label: 'Annonces', endpoint: 'news' },
  { id: 'tips', label: 'Astuces', endpoint: 'news' },
  { id: 'events', label: 'Événements', endpoint: 'events' },
  { id: 'products', label: 'Produits', endpoint: 'products' },
  { id: 'services', label: 'Services', endpoint: 'services' },
  { id: 'solutions', label: 'Solutions', endpoint: 'solutions' },
  { id: 'pages', label: 'Pages', endpoint: 'pages' },
];
const FORMATS = [
  ['youtube', 'YouTube · miniature (1280 × 720)'], ['youtube-banner', 'YouTube · bannière (2560 × 1440)'],
  ['instagram', 'Instagram · publication carrée (1080 × 1080)'], ['instagram-story', 'Instagram · story / reel (1080 × 1920)'],
  ['facebook', 'Facebook · partage (1200 × 630)'], ['facebook-cover', 'Facebook · couverture (1640 × 624)'],
  ['linkedin', 'LinkedIn · partage (1200 × 627)'], ['x', 'X · publication (1200 × 675)'],
  ['pinterest', 'Pinterest · épingle (1000 × 1500)'], ['og', 'Open Graph · aperçu web (1200 × 630)'],
] as const;
const BARCODE_TYPES = ['code128', 'ean13', 'ean8', 'upca', 'upce', 'itf14', 'isbn', 'code39', 'datamatrix'];
const DEFAULT_COLORS = { bg: '#1B2A4A', bg2: '#169EC9', accent: '#C6DA34', textColor: '#FFFFFF' };

function rowsFrom(payload: unknown): ContentItem[] {
  if (Array.isArray(payload)) return payload as ContentItem[];
  if (!payload || typeof payload !== 'object') return [];
  const o = payload as Record<string, unknown>;
  for (const key of ['data', 'items', 'results', 'records']) {
    const nested = o[key];
    if (Array.isArray(nested)) return nested as ContentItem[];
    if (nested && typeof nested === 'object') {
      const result = rowsFrom(nested);
      if (result.length) return result;
    }
  }
  return [];
}

export default function SocialGraphicsStudio() {
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<'social' | 'qr' | 'barcode'>('social');
  const [source, setSource] = useState<SourceKind>('articles');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>('instagram');
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [align, setAlign] = useState('left');
  const [titleX, setTitleX] = useState('7');
  const [titleY, setTitleY] = useState('65');
  const [overlay, setOverlay] = useState('0.52');
  const [includeQr, setIncludeQr] = useState(false);
  const [qrPosition, setQrPosition] = useState('bottom-right');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState('top-left');
  const [customTitle, setCustomTitle] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [previewVersion, setPreviewVersion] = useState(0);
  const [copyDone, setCopyDone] = useState(false);
  const [sendingToCanvas, setSendingToCanvas] = useState(false);
  const [studioError, setStudioError] = useState('');
  const [qrData, setQrData] = useState('https://');
  const [codeData, setCodeData] = useState('SARI-2026');
  const [codeType, setCodeType] = useState('code128');
  const [codeColor, setCodeColor] = useState('#172554');
  const [codeBg, setCodeBg] = useState('#FFFFFF');
  const [qrSize, setQrSize] = useState('512');

  const sourceConfig = SOURCES.find((item) => item.id === source)!;
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/public/${sourceConfig.endpoint}?view=block&limit=100&locale=${encodeURIComponent(locale)}`, { cache: 'no-store' })
      .then(async (res) => { if (!res.ok) throw new Error('Impossible de charger les contenus publiés.'); return rowsFrom(await res.json()); })
      .then((rows) => {
        if (!active) return;
        setItems(rows);
        const first = rows[0];
        if (first) setSelected(String(first.slug || first.id || ''));
      })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source, locale, sourceConfig.endpoint]);

  const itemOptions = useMemo(() => items.map((item) => ({
    value: String(item.slug || item.id || ''),
    label: String(item.title || item.name || item.slug || item.id || 'Contenu sans titre'),
  })).filter((item) => item.value), [items]);

  const socialUrl = useMemo(() => {
    if (!selected) return '';
    const params = new URLSearchParams({ platform, locale, bg: colors.bg, bg2: colors.bg2, accent: colors.accent, textColor: colors.textColor, align, overlay });
    if (includeQr) params.set('qr', '1');
    if (linkUrl.trim()) params.set('url', linkUrl.trim());
    if (customTitle.trim()) params.set('title', customTitle.trim());
    if (customSummary.trim()) params.set('summary', customSummary.trim());
    if (customImage.trim()) params.set('image', customImage.trim());
    params.set('logoPosition', logoPosition);
    params.set('titleX', titleX);
    params.set('titleY', titleY);
    params.set('qrPosition', qrPosition);
    if (!showLogo) params.set('logo', 'none');
    return `/api/v1/public/graphics/social/${encodeURIComponent(source)}/${encodeURIComponent(selected)}?${params.toString()}`;
  }, [source, selected, platform, locale, colors, align, titleX, titleY, overlay, includeQr, qrPosition, linkUrl, showLogo, logoPosition, customTitle, customSummary, customImage]);

  const imageEndpoint = useMemo(() => {
    if (tab === 'qr') return `/api/v1/public/graphics/qr?${new URLSearchParams({ data: qrData, size: qrSize, color: codeColor, background: codeBg, margin: '2' })}`;
    if (tab === 'barcode') return `/api/v1/public/graphics/barcode?${new URLSearchParams({ data: codeData, type: codeType, color: codeColor, background: codeBg })}`;
    return socialUrl;
  }, [tab, qrData, qrSize, codeColor, codeBg, codeData, codeType, socialUrl]);
  const absolute = imageEndpoint && typeof window !== 'undefined' ? new URL(imageEndpoint, window.location.origin).toString() : imageEndpoint;
  const imageUrl = imageEndpoint ? `${imageEndpoint}${imageEndpoint.includes('?') ? '&' : '?'}_preview=${previewVersion}` : '';

  const copyUrl = async () => {
    if (!absolute) return;
    await navigator.clipboard.writeText(absolute);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 1600);
  };
  const openInCanvas = async () => {
    if (!imageEndpoint || tab !== 'social') return;
    setSendingToCanvas(true);
    setStudioError('');
    try {
      const response = await fetch(imageEndpoint);
      if (!response.ok) throw new Error('Le rendu ne peut pas être téléchargé. Vérifiez le contenu publié et ses médias.');
      const blob = await response.blob();
      const file = new File([blob], `social-${source}-${selected}.png`, { type: 'image/png' });
      const asset = await uploadGedAsset({ file, kind: 'image', module: 'social', title: `Visuel ${platform} · ${selected}`, alt: 'Visuel social généré depuis le contenu du site', tags: ['social', platform, source] });
      router.push(`/${locale}/admin/canvas?file=${encodeURIComponent(asset.file)}`);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'Impossible d’ouvrir le visuel dans l’atelier.');
    } finally {
      setSendingToCanvas(false);
    }
  };
  const updateColor = (key: keyof typeof colors, value: string) => setColors((old) => ({ ...old, [key]: value }));
  const colorField = (label: string, key: keyof typeof colors) => (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ad-line)] px-3 py-2 text-sm">
      <span>{label}</span><input aria-label={label} type="color" value={colors[key]} onChange={(e) => updateColor(key, e.target.value)} className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent" />
    </label>
  );
  const simpleColorField = (label: string, value: string, setValue: (s: string) => void) => (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ad-line)] px-3 py-2 text-sm">
      <span>{label}</span><input aria-label={label} type="color" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent" />
    </label>
  );

  return (
    <div className="space-y-4">
      <header>
        <div className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--ad-accent)' }}>ATELIER · API</div>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><Share2 className="h-7 w-7" /> Visuels sociaux & codes</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--ad-muted)' }}>Créez un visuel dynamique à partir d’un contenu publié, puis utilisez directement son URL PNG depuis un autre site ou une balise Open Graph.</p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Type de génération">
        <button className={`ad-btn ${tab === 'social' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setTab('social')}><ImageIcon className="h-4 w-4" /> Visuel social</button>
        <button className={`ad-btn ${tab === 'qr' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setTab('qr')}><QrCode className="h-4 w-4" /> Code QR</button>
        <button className={`ad-btn ${tab === 'barcode' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setTab('barcode')}><Barcode className="h-4 w-4" /> Code-barres</button>
      </nav>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <section className="ad-card space-y-4 p-4">
          {tab === 'social' ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-semibold">Contenu du site</span><select className="ad-select w-full" value={source} onChange={(e) => { setItems([]); setSelected(''); setLoading(true); setSource(e.target.value as SourceKind); }}>{SOURCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Article / page publié(e)</span><select className="ad-select w-full" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={loading || !itemOptions.length}><option value="">{loading ? 'Chargement…' : itemOptions.length ? 'Choisir un contenu' : 'Aucun contenu publié'}</option>{itemOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            </div>
            <label className="block space-y-1 text-sm"><span className="font-semibold">Format de réseau social</span><select className="ad-select w-full" value={platform} onChange={(e) => setPlatform(e.target.value)}>{FORMATS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <div className="grid gap-2 sm:grid-cols-2">{colorField('Fond principal', 'bg')}{colorField('Dégradé', 'bg2')}{colorField('Accent du site', 'accent')}{colorField('Texte', 'textColor')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-semibold">Alignement du texte</span><select className="ad-select w-full" value={align} onChange={(e) => { const value = e.target.value; setAlign(value); setTitleX(value === 'center' ? '50' : value === 'right' ? '93' : '7'); }}><option value="left">Gauche</option><option value="center">Centré</option><option value="right">Droite</option></select></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Voile / contraste</span><span>{Math.round(Number(overlay) * 100)}%</span></span><input className="w-full" type="range" min="0" max="0.88" step="0.04" value={overlay} onChange={(e) => setOverlay(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Position horizontale du titre</span><span>{titleX}%</span></span><input className="w-full" type="range" min="3" max="97" value={titleX} onChange={(e) => setTitleX(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Position verticale du titre</span><span>{titleY}%</span></span><input className="w-full" type="range" min="15" max="90" value={titleY} onChange={(e) => setTitleY(e.target.value)} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span className="font-semibold">URL à encoder dans le QR (facultatif)</span><input className="ad-input w-full" type="url" placeholder="https://exemple.com/fr/actualites/mon-article" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Logo configuré du site</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} /> QR code vers la page</label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Position du logo</span><select className="ad-select w-full" value={logoPosition} onChange={(e) => setLogoPosition(e.target.value)}><option value="top-left">Haut gauche</option><option value="top-right">Haut droite</option><option value="bottom-left">Bas gauche</option><option value="bottom-right">Bas droite</option></select></label>
              {includeQr && <label className="space-y-1 text-sm"><span className="font-semibold">Position du QR code</span><select className="ad-select w-full" value={qrPosition} onChange={(e) => setQrPosition(e.target.value)}><option value="top-left">Haut gauche</option><option value="top-right">Haut droite</option><option value="bottom-left">Bas gauche</option><option value="bottom-right">Bas droite</option></select></label>}
            </div>
            <details className="rounded-lg border border-[var(--ad-line)] p-3">
              <summary className="cursor-pointer text-sm font-bold">Personnaliser texte et image (facultatif)</summary>
              <div className="mt-3 grid gap-3">
                <label className="space-y-1 text-sm"><span>Titre de remplacement</span><input className="ad-input w-full" maxLength={180} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span>Résumé de remplacement</span><textarea className="ad-input w-full" rows={2} maxLength={500} value={customSummary} onChange={(e) => setCustomSummary(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span>Image GED de remplacement (/uploads/...)</span><input className="ad-input w-full" placeholder="/uploads/news/visuel.jpg" value={customImage} onChange={(e) => setCustomImage(e.target.value)} /></label>
              </div>
            </details>
          </> : <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-semibold">{tab === 'qr' ? 'Texte ou URL à encoder' : 'Donnée à encoder'}</span><input className="ad-input w-full" value={tab === 'qr' ? qrData : codeData} onChange={(e) => tab === 'qr' ? setQrData(e.target.value) : setCodeData(e.target.value)} maxLength={2048} /></label>
              {tab === 'qr' ? <label className="space-y-1 text-sm"><span className="font-semibold">Taille (px)</span><select className="ad-select w-full" value={qrSize} onChange={(e) => setQrSize(e.target.value)}>{['256', '512', '768', '1024'].map((x) => <option key={x}>{x}</option>)}</select></label> : <label className="space-y-1 text-sm"><span className="font-semibold">Type</span><select className="ad-select w-full" value={codeType} onChange={(e) => setCodeType(e.target.value)}>{BARCODE_TYPES.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">{simpleColorField('Couleur du code', codeColor, setCodeColor)}{simpleColorField('Fond', codeBg, setCodeBg)}</div>
          </>}
          <div className="flex flex-wrap gap-2 border-t border-[var(--ad-line)] pt-3">
            <button className="ad-btn ad-btn-primary" onClick={() => setPreviewVersion((value) => value + 1)} disabled={!imageEndpoint}><RefreshCw className="h-4 w-4" /> Actualiser</button>
            <button className="ad-btn ad-btn-ghost" onClick={() => void copyUrl()} disabled={!absolute}>{copyDone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copyDone ? 'URL copiée' : 'Copier l’URL API'}</button>
            {absolute && <a className="ad-btn ad-btn-ghost" href={absolute} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ouvrir l’image</a>}
            {absolute && <a className="ad-btn ad-btn-ghost" href={absolute} download><Download className="h-4 w-4" /> Télécharger</a>}
            {tab === 'social' && <button className="ad-btn ad-btn-ghost" onClick={() => void openInCanvas()} disabled={sendingToCanvas || !selected}><Wand2 className="h-4 w-4" /> {sendingToCanvas ? 'Préparation…' : 'Ouvrir dans l’atelier graphique'}</button>}
          </div>
          {studioError && <p role="alert" className="mt-2 text-sm text-red-600">{studioError}</p>}
        </section>

        <section className="ad-card flex min-h-[360px] flex-col p-4">
          <h2 className="mb-3 text-lg font-black">Aperçu du rendu</h2>
          <div className="grid min-h-[290px] flex-1 place-items-center overflow-hidden rounded-xl border border-[var(--ad-line)] p-3" style={{ background: 'var(--ad-bg-2)' }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- The URL is a dynamic binary API preview.
              <img key={imageUrl} src={imageUrl} alt="Aperçu du visuel généré" className="max-h-[560px] max-w-full object-contain shadow-xl" />
            ) : <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Choisissez un contenu et un format pour afficher l’aperçu.</p>}
          </div>
          {absolute && <div className="mt-3"><div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ad-muted)' }}>URL publique de l’API</div><code className="block break-all rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5">{absolute}</code></div>}
          {tab === 'social' && <p className="mt-2 text-xs" style={{ color: 'var(--ad-muted)' }}>Paramètres API : source et identifiant dans le chemin, puis plateforme, couleurs, alignement, voile et QR dans la query string. Le contenu doit être publié.</p>}
        </section>
      </div>
    </div>
  );
}
