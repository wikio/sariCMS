'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { defaultLocale } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { Barcode, CalendarDays, Check, Copy, Download, ExternalLink, Image as ImageIcon, MapPin, QrCode, RefreshCw, Search, Share2, Wand2 } from 'lucide-react';
import { uploadGedAsset } from '@/lib/ged/client';
import { useDateFormat } from '@/lib/use-date-format';
import { DATE_FORMAT_PRESETS, formatDateRangeWith, previewFormat, type SupportedLocale } from '@/lib/date-format';
import { SOCIAL_STYLE_PRESETS } from '@/config/socialTemplates.js';

type SourceKind = 'articles' | 'events' | 'products' | 'services' | 'solutions' | 'pages' | 'announcements' | 'tips';
type ContentItem = { id?: string | number; slug?: string; locale?: string; legacyId?: string | number; title?: string; name?: string; shortDesc?: string; chapo?: string; sujet?: string; category?: string; classification?: string; image?: unknown; coverImage?: unknown; thumbnail?: unknown; media?: unknown; icon?: string; color?: string; startDate?: string; endDate?: string; date?: string; location?: string; venue?: string };
type Brand = { title?: string; logo?: string };
type ResolvedContent = { source: string; selected: string; requestedLocale: string; contentLocale: string; item: ContentItem };
function unwrapPayload(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }
  if (payload && typeof payload === 'object' && 'data' in payload && !Array.isArray((payload as { data: unknown }).data)) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}
async function fetchPublicItem(resource: string, key: string, locale: string): Promise<ContentItem | null> {
  if (!key) return null;
  try {
    const response = await fetch(`/api/v1/public/${encodeURIComponent(resource)}/${encodeURIComponent(key)}?locale=${encodeURIComponent(locale)}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const row = unwrapPayload(await response.json());
    return row && typeof row === 'object' && !Array.isArray(row) ? row as ContentItem : null;
  } catch {
    return null;
  }
}
async function fetchPublicMatch(resource: string, locale: string, references: ContentItem[]): Promise<ContentItem | null> {
  const keys = new Set(references.flatMap((row) => [row.id, row.slug, row.legacyId].filter((value) => value != null && String(value)).map(String)));
  if (!keys.size) return null;
  for (let page = 1; page <= 5; page += 1) {
    try {
      const params = new URLSearchParams({ view: 'block', limit: '100', page: String(page), locale });
      const response = await fetch(`/api/v1/public/${encodeURIComponent(resource)}?${params}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const rows = rowsFrom(unwrapPayload(await response.json()));
      const match = rows.find((row) => [row.id, row.slug, row.legacyId].some((value) => value != null && keys.has(String(value))));
      if (match) return match;
      if (rows.length < 100) break;
    } catch {
      return null;
    }
  }
  return null;
}
async function resolveLocalizedContent(resource: string, original: ContentItem, requestedLocale: string, defaultLocale: string): Promise<{ item: ContentItem; contentLocale: string }> {
  const originalKey = itemKey(original);
  const localesToTry = [...new Set([requestedLocale, defaultLocale])];
  let translations: ContentItem[] = [];
  try {
    const response = await fetch(`/api/v1/public/${encodeURIComponent(resource)}/${encodeURIComponent(originalKey)}/translations`, { cache: 'no-store' });
    if (response.ok) translations = rowsFrom(unwrapPayload(await response.json()));
  } catch { /* Les requêtes directes ci-dessous servent de repli. */ }

  for (const targetLocale of localesToTry) {
    const reference = translations.find((row) => String(row.locale || '') === targetLocale);
    if (reference) {
      const translated = await fetchPublicItem(resource, itemKey(reference), targetLocale);
      if (translated && (!translated.locale || translated.locale === targetLocale)) return { item: translated, contentLocale: targetLocale };
      const listedTranslation = await fetchPublicMatch(resource, targetLocale, [reference, original]);
      if (listedTranslation && (!listedTranslation.locale || listedTranslation.locale === targetLocale)) return { item: listedTranslation, contentLocale: targetLocale };
      if (reference.title || reference.name) return { item: reference, contentLocale: targetLocale };
    }
    const direct = await fetchPublicItem(resource, originalKey, targetLocale);
    if (direct && (!direct.locale || direct.locale === targetLocale)) return { item: direct, contentLocale: targetLocale };
    const listed = await fetchPublicMatch(resource, targetLocale, [original]);
    if (listed && (!listed.locale || listed.locale === targetLocale)) return { item: listed, contentLocale: targetLocale };
  }
  return { item: original, contentLocale: String(original.locale || defaultLocale) };
}
function mediaPath(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return '';
  if (typeof value === 'string') return value.startsWith('uploads/') ? `/${value}` : value;
  if (Array.isArray(value)) return value.map((row) => mediaPath(row, depth + 1)).find(Boolean) || '';
  if (typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  for (const key of ['url', 'src', 'path', 'image', 'media', 'thumbnail', 'cover']) {
    const found = mediaPath(row[key], depth + 1);
    if (found) return found;
  }
  return '';
}
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
const LAYOUTS = [
  ['full', 'Image pleine page'], ['diagonal', 'Découpe diagonale'], ['split-left', 'Image à gauche · texte à droite'], ['split-right', 'Texte à gauche · image à droite'],
] as const;
const EFFECTS = [['none', 'Aucun'], ['tint', 'Teinte'], ['screen', 'Écran'], ['multiply', 'Produit / Multiply'], ['soft-light', 'Lumière douce'], ['overlay', 'Superposition'], ['negative', 'Négatif']] as const;
const defaultLayout = (kind: SourceKind) => ['products', 'services', 'solutions'].includes(kind) ? 'split-left' : kind === 'events' ? 'diagonal' : 'full';
const DEFAULT_COLORS = { bg: '#1B2A4A', bg2: '#169EC9', accent: '#C6DA34', textColor: '#FFFFFF' };
const SOCIAL_THEMES: Record<string, typeof DEFAULT_COLORS> = {
  sari: DEFAULT_COLORS,
  clinical: { bg: '#F1F5F9', bg2: '#DBEAFE', accent: '#169EC9', textColor: '#14233B' },
  midnight: { bg: '#0B1020', bg2: '#25365C', accent: '#C6DA34', textColor: '#FFFFFF' },
  editorial: { bg: '#111827', bg2: '#374151', accent: '#EAB616', textColor: '#FFFFFF' },
  aurora: { bg: '#312E81', bg2: '#0E7490', accent: '#67E8F9', textColor: '#FFFFFF' },
  lime: { bg: '#365314', bg2: '#84CC16', accent: '#ECFCCB', textColor: '#FFFFFF' },
  'modular-grid': { bg: '#0B0D10', bg2: '#0F9F6E', accent: '#EAB616', textColor: '#FFFFFF' },
  'editorial-grid': { bg: '#FFFFFF', bg2: '#0F9F6E', accent: '#169EC9', textColor: '#0B0D10' },
  'blueprint-grid': { bg: '#0B0D10', bg2: '#169EC9', accent: '#EAB616', textColor: '#FFFFFF' },
  'presse-immersive': { bg: '#0B0D10', bg2: '#0F9F6E', accent: '#EAB616', textColor: '#FFFFFF' },
  'grille-plein-cadre': { bg: '#0B0D10', bg2: '#0F9F6E', accent: '#169EC9', textColor: '#FFFFFF' },
  'sans-photo-blocs': { bg: '#0B0D10', bg2: '#0F9F6E', accent: '#EAB616', textColor: '#FFFFFF' },
  'sans-photo-minimal': { bg: '#0B0D10', bg2: '#0F9F6E', accent: '#EAB616', textColor: '#FFFFFF' },
};
const COMPOSITION_THEMES = [
  ['modular-grid', 'Grille modulaire'],
  ['editorial-grid', 'Grille éditoriale'],
  ['blueprint-grid', 'Grille technique'],
  ['presse-immersive', 'Presse immersive · photo plein cadre'],
  ['grille-plein-cadre', 'Grille plein cadre · photo et grille'],
  ['sans-photo-blocs', 'Sans photo · blocs graphiques'],
  ['sans-photo-minimal', 'Sans photo · minimal'],
] as const;
const SOCIAL_DIMENSIONS: Record<string, [number, number, string]> = {
  youtube: [1280, 720, 'landscape'], 'youtube-banner': [2560, 1440, 'widescreen'],
  instagram: [1080, 1080, 'square'], 'instagram-story': [1080, 1920, 'story'],
  facebook: [1200, 630, 'landscape'], 'facebook-cover': [1640, 624, 'landscape'],
  linkedin: [1200, 627, 'landscape'], x: [1200, 675, 'widescreen'],
  pinterest: [1000, 1500, 'portrait'], og: [1200, 630, 'landscape'],
};

function itemKey(item: ContentItem) { return String(item.slug || item.id || ''); }
function itemLabel(item: ContentItem) {
  const title = String(item.title || item.name || item.slug || 'Contenu sans titre');
  return item.id != null ? `${title} · #${item.id}` : title;
}
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
  const { settings: dateSettings } = useDateFormat();
  const [tab, setTab] = useState<'social' | 'qr' | 'barcode'>('social');
  const [source, setSource] = useState<SourceKind>('articles');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [brand, setBrand] = useState<Brand>({});
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>('instagram');
  const [layout, setLayout] = useState<string>('full');
  const [theme, setTheme] = useState('sari');
  const [renderLocale, setRenderLocale] = useState(locale);
  const [resolvedContent, setResolvedContent] = useState<ResolvedContent | null>(null);
  const [dateFormat, setDateFormat] = useState('short');
  const [direction, setDirection] = useState(locale === 'ar' ? 'rtl' : 'ltr');
  const [font, setFont] = useState('Inter');
  const [customFont, setCustomFont] = useState('');
  const [titleScale, setTitleScale] = useState('1');
  const [logoScale, setLogoScale] = useState('1');
  const [gridBackground, setGridBackground] = useState(true);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [align, setAlign] = useState('left');
  const [titleX, setTitleX] = useState('7');
  const [titleY, setTitleY] = useState('65');
  const [overlay, setOverlay] = useState('0.52');
  const [effect, setEffect] = useState('none');
  const [effectColor, setEffectColor] = useState('#C6DA34');
  const [effectOpacity, setEffectOpacity] = useState('0.26');
  const [imageOpacity, setImageOpacity] = useState('1');
  const [borderWidth, setBorderWidth] = useState('0');
  const [borderColor, setBorderColor] = useState('#C6DA34');
  const [borderRadius, setBorderRadius] = useState('0');
  const [blockRadius, setBlockRadius] = useState('0');
  const [includeQr, setIncludeQr] = useState(false);
  const [qrPosition, setQrPosition] = useState('bottom-right');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState('top-left');
  const [customLogo, setCustomLogo] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customIcon, setCustomIcon] = useState('');
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
      .then(async (res) => { if (!res.ok) throw new Error(`Chargement impossible (${res.status}). Vérifiez que l’API est démarrée et que le contenu est publié.`); return rowsFrom(await res.json()); })
      .then((rows) => {
        if (!active) return;
        setItems(rows);
        const first = rows[0];
        if (first) { setSelected(itemKey(first)); setSearchText(itemLabel(first)); }
        else { setSelected(''); setSearchText(''); }
      })
      .catch((error) => { if (active) { setItems([]); setLoadError(error instanceof Error ? error.message : 'Impossible de charger les contenus publiés.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source, locale, sourceConfig.endpoint]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/public/brand', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => { if (active) setBrand((payload?.data || payload || {}) as Brand); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const itemOptions = useMemo(() => items.map((item) => ({ value: itemKey(item), label: itemLabel(item), item })).filter((option) => option.value), [items]);
  const filteredItems = useMemo(() => {
    const needle = searchText.trim().toLocaleLowerCase();
    return itemOptions.filter(({ label, value, item }) => !needle || `${label} ${value} ${item.id ?? ''}`.toLocaleLowerCase().includes(needle)).slice(0, 10);
  }, [itemOptions, searchText]);
  const selectedItem = items.find((item) => itemKey(item) === selected);
  useEffect(() => {
    let active = true;
    if (!selectedItem) return () => { active = false; };
    const resolution = renderLocale === locale
      ? Promise.resolve({ item: selectedItem, contentLocale: locale })
      : resolveLocalizedContent(sourceConfig.endpoint, selectedItem, renderLocale, defaultLocale);
    void resolution.then((result) => {
      if (active) setResolvedContent({ source, selected, requestedLocale: renderLocale, ...result });
    });
    return () => { active = false; };
  }, [source, selected, selectedItem, renderLocale, locale, sourceConfig.endpoint]);
  const resolvedIsCurrent = resolvedContent?.source === source && resolvedContent.selected === selected && resolvedContent.requestedLocale === renderLocale;
  const previewItem = resolvedIsCurrent ? resolvedContent.item : selectedItem;
  const previewContentLocale = resolvedIsCurrent ? resolvedContent.contentLocale : renderLocale;
  const isResolvingContent = Boolean(selectedItem && !resolvedIsCurrent);
  const sourceImage = mediaPath(previewItem?.image) || mediaPath(previewItem?.coverImage) || mediaPath(previewItem?.thumbnail) || mediaPath(previewItem?.media);
  const effectiveDateFormat = dateFormat === 'site' ? dateSettings.format : dateFormat;
  const dateOptions = { format: effectiveDateFormat, dateOnly: !dateSettings.showTime };
  const rawDate = previewItem?.startDate || previewItem?.date;
  const formattedDate = rawDate
    ? formatDateRangeWith(rawDate, previewItem?.endDate, renderLocale as SupportedLocale, dateOptions)
    : '';

  const socialUrl = useMemo(() => {
    if (!selected || isResolvingContent || !previewItem) return '';
    const composition = Object.hasOwn(SOCIAL_STYLE_PRESETS, theme)
      ? (SOCIAL_STYLE_PRESETS as Record<string, { image?: boolean }>)[theme]
      : undefined;
    if (composition) {
      const [width, height, format] = SOCIAL_DIMENSIONS[platform] || SOCIAL_DIMENSIONS.instagram;
      const params = new URLSearchParams({
        kind: source === 'events' ? 'event' : ['products', 'services', 'solutions'].includes(source) ? 'product' : source === 'announcements' ? 'announcement' : 'article',
        format, width: String(width), height: String(height), style: theme,
        locale: previewContentLocale, direction, fontFamily: customFont.trim() || font, textScale: titleScale,
        title: customTitle.trim() || String(previewItem.title || previewItem.name || ''),
        summary: customSummary.trim() || String(previewItem.shortDesc || previewItem.chapo || ''),
        topic: customSubject.trim() || String(previewItem.sujet || previewItem.category || previewItem.classification || ''),
        brand: String(brand.title || ''), showLogo: showLogo ? 'true' : 'false', includeQr: includeQr ? 'true' : 'false',
        themeConfig: JSON.stringify({
          primary: colors.bg2, secondary: 'rgb(22, 158, 201)', accent: colors.accent,
          background: colors.bg, foreground: colors.textColor,
          fontFamily: customFont.trim() || font, direction, locale: previewContentLocale,
          transparent: false,
        }),
      });
      const location = previewItem.location || previewItem.venue;
      if (formattedDate) params.set('date', formattedDate);
      if (location) params.set('location', String(location));
      if (includeQr && linkUrl.trim()) params.set('url', linkUrl.trim());
      const image = customImage.trim() || sourceImage;
      if (image && composition.image !== false) params.set('imageUrl', image);
      if (showLogo && (customLogo.trim() || brand.logo)) params.set('logoUrl', customLogo.trim() || String(brand.logo));
      return `/api/social-card?${params.toString()}`;
    }
    const params = new URLSearchParams({ platform, locale: previewContentLocale, direction, font: customFont.trim() || font, titleScale, logoScale, grid: gridBackground ? '1' : '0', theme, bg: colors.bg, bg2: colors.bg2, accent: colors.accent, textColor: colors.textColor, align, overlay, layout, effect, effectColor, effectOpacity, imageOpacity, borderWidth, borderColor, borderRadius, blockRadius });
    if (includeQr) params.set('qr', '1');
    if (linkUrl.trim()) params.set('url', linkUrl.trim());
    if (customTitle.trim()) params.set('title', customTitle.trim());
    if (customSubject.trim()) params.set('subject', customSubject.trim());
    if (customSummary.trim()) params.set('summary', customSummary.trim());
    if (formattedDate) params.set('date', formattedDate);
    if (customImage.trim()) params.set('image', customImage.trim());
    else if (sourceImage) params.set('image', sourceImage);
    if (customIcon.trim()) params.set('icon', customIcon.trim());
    params.set('logoPosition', logoPosition);
    params.set('titleX', titleX);
    params.set('titleY', titleY);
    params.set('qrPosition', qrPosition);
    if (!showLogo) params.set('logo', 'none');
    else if (customLogo.trim()) params.set('logo', customLogo.trim());
    return `/api/v1/public/graphics/social/${encodeURIComponent(source)}/${encodeURIComponent(itemKey(previewItem))}?${params.toString()}`;
  }, [source, selected, previewItem, previewContentLocale, isResolvingContent, platform, formattedDate, direction, font, customFont, titleScale, logoScale, gridBackground, theme, colors, align, titleX, titleY, overlay, effect, effectColor, effectOpacity, imageOpacity, borderWidth, borderColor, borderRadius, blockRadius, layout, includeQr, qrPosition, linkUrl, showLogo, logoPosition, customLogo, customTitle, customSubject, customIcon, customSummary, customImage, sourceImage, brand]);

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
  const applyDirection = (value: string) => {
    const nextDirection = value === 'rtl' ? 'rtl' : 'ltr';
    const nextAlign = nextDirection === 'rtl' ? 'right' : 'left';
    setDirection(nextDirection);
    setAlign(nextAlign);
    setTitleX(nextAlign === 'right' ? (layout === 'split-left' ? '93' : layout === 'split-right' ? '47' : '93') : (layout === 'split-left' ? '53' : '7'));
  };
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
              <label className="space-y-1 text-sm"><span className="font-semibold">Type de contenu</span><select className="ad-select w-full" value={source} onChange={(e) => { const kind = e.target.value as SourceKind; setItems([]); setSelected(''); setSearchText(''); setLoadError(''); setLoading(true); setLayout(defaultLayout(kind)); setTitleX(['products', 'services', 'solutions'].includes(kind) ? '53' : '7'); setTitleY(kind === 'events' ? '58' : '65'); setSource(kind); }}>{SOURCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
              <div className="relative space-y-1 text-sm">
                <label htmlFor="social-content-search" className="font-semibold">Rechercher par titre ou ID</label>
                <div className="relative">
                  <Search className="ad-search-ico h-4 w-4" />
                  <input id="social-content-search" className="ad-input ad-input-icon w-full" role="combobox" aria-autocomplete="list" aria-controls="social-content-options" aria-expanded={searchOpen && filteredItems.length > 0} value={searchText} placeholder={loading ? 'Chargement des contenus…' : 'Titre, ID ou slug'} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)} onChange={(e) => { setSearchText(e.target.value); setSelected(''); setSearchOpen(true); }} />
                  {searchOpen && filteredItems.length > 0 && <div id="social-content-options" role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[var(--ad-line)] bg-[var(--ad-bg)] p-1 shadow-2xl">
                    {filteredItems.map(({ item, value, label }) => {
                      const thumb = mediaPath(item.image) || mediaPath(item.coverImage) || mediaPath(item.thumbnail) || mediaPath(item.media);
                      return <button key={value} type="button" role="option" aria-selected={selected === value} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-black/5 dark:hover:bg-white/5" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelected(value); setSearchText(label); setSearchOpen(false); }}>
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Article thumbnails may use any configured media host.
                          <img src={thumb} alt="" className="h-10 w-14 rounded object-cover" />
                        ) : <span className="grid h-10 w-14 place-items-center rounded bg-black/5 dark:bg-white/5"><ImageIcon className="h-4 w-4" /></span>}
                        <span className="min-w-0"><span className="block truncate font-semibold">{label}</span><span className="block truncate text-xs opacity-70">ID {String(item.id ?? '—')} · {String(item.slug ?? '')}</span></span>
                      </button>;
                    })}
                  </div>}
                </div>
                {loading && <span className="block text-xs opacity-70">Chargement des contenus publiés…</span>}
                {loadError && <span role="alert" className="block text-xs text-red-600">{loadError}</span>}
                {!loading && !loadError && !items.length && <span className="block text-xs opacity-70">Aucun contenu publié trouvé pour ce type.</span>}
              </div>
            </div>
            {previewItem && <div className="grid gap-3 rounded-xl border border-[var(--ad-line)] p-3 sm:grid-cols-[160px_1fr]">
              <div className="aspect-video overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">{sourceImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- The source image is selected from existing CMS records.
                <img src={sourceImage} alt={`Image source : ${String(previewItem.title || previewItem.name || '')}`} className="h-full w-full object-cover" />
              ) : <div className="grid h-full place-items-center text-xs opacity-60"><ImageIcon className="mb-1 h-5 w-5" />Pas d’image sur la fiche</div>}</div>
              <div className="min-w-0 self-center"><div className="text-xs font-bold uppercase tracking-wide opacity-60">Image et métadonnées du contenu sélectionné</div><div className="mt-1 truncate font-bold">{String(previewItem.title || previewItem.name || 'Sans titre')}</div><div className="mt-1 text-xs opacity-70">ID {String(previewItem.id ?? '—')} · {String(previewItem.slug ?? '')}</div>
                {resolvedIsCurrent && resolvedContent.contentLocale !== renderLocale && <div className="mt-2 text-xs text-amber-700">Aucune traduction « {renderLocale} » n’est associée à cette fiche. Aperçu de la version par défaut.</div>}
                {isResolvingContent && <div className="mt-2 text-xs opacity-70">Chargement de la traduction…</div>}
                {source === 'events' && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{formattedDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formattedDate}</span>}{(previewItem.location || previewItem.venue) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{String(previewItem.location || previewItem.venue)}</span>}</div>}
                {['services', 'solutions', 'products'].includes(source) && previewItem.icon && <div className="mt-2 text-xs">Icône configurée : <code>{previewItem.icon}</code></div>}
              </div>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-semibold">Format de réseau social</span><select className="ad-select w-full" value={platform} onChange={(e) => setPlatform(e.target.value)}>{FORMATS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Habillage selon le contenu</span><select className="ad-select w-full" value={layout} onChange={(e) => { setLayout(e.target.value); setTitleX(e.target.value === 'split-left' ? '53' : e.target.value === 'split-right' ? '47' : align === 'center' ? '50' : align === 'right' ? '93' : '7'); }}>{LAYOUTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-semibold">Thème d’habillage</span><select className="ad-select w-full" value={theme} onChange={(e) => { const next = e.target.value; setTheme(next); setColors(SOCIAL_THEMES[next] || DEFAULT_COLORS); }}><optgroup label="Palettes de couleurs">{[['sari','SARI · marque'],['clinical','Clinique claire'],['midnight','Minuit'],['editorial','Éditorial'],['aurora','Aurore'],['lime','Citron vert']].map(([id,label]) => <option key={id} value={id}>{label}</option>)}</optgroup><optgroup label="Compositions graphiques">{COMPOSITION_THEMES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup></select></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Format de date</span><select className="ad-select w-full" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}><option value="short">Court · {previewFormat('short', renderLocale as SupportedLocale)}</option><option value="site">Comme les paramètres du site · {dateSettings.format}</option>{DATE_FORMAT_PRESETS.filter((preset) => preset.value !== 'short').map((preset) => <option key={preset.value} value={preset.value}>{preset.value} · {previewFormat(preset.value, renderLocale as SupportedLocale)}</option>)}</select><a className="text-xs underline" href={`/${locale}/admin/settings?tab=dates`}>Configurer le format général des dates</a></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Langue du rendu</span><select className="ad-select w-full" value={renderLocale} onChange={(e) => { const next = e.target.value; setRenderLocale(next); applyDirection(next === 'ar' ? 'rtl' : 'ltr'); }}><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Direction du texte</span><select className="ad-select w-full" value={direction} onChange={(e) => applyDirection(e.target.value)}><option value="ltr">Gauche à droite · LTR</option><option value="rtl">Droite à gauche · RTL</option></select></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Police configurée ou Google Fonts</span><select className="ad-select w-full" value={font} onChange={(e) => { setFont(e.target.value); setCustomFont(''); }}>{['Inter','Cairo','Arial','Roboto','Open Sans','Montserrat','Lato','Poppins'].map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Police personnalisée (nom de famille)</span><input className="ad-input w-full" value={customFont} maxLength={64} placeholder="Ex. Police configurée ou Google Fonts" onChange={(e) => setCustomFont(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Taille des textes</span><span>{Math.round(Number(titleScale) * 100)}%</span></span><input className="w-full" type="range" min="0.65" max="1.6" step="0.05" value={titleScale} onChange={(e) => setTitleScale(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Taille du logo</span><span>{Math.round(Number(logoScale) * 100)}%</span></span><input className="w-full" type="range" min="0.5" max="2" step="0.05" value={logoScale} onChange={(e) => setLogoScale(e.target.value)} /></label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={gridBackground} onChange={(e) => setGridBackground(e.target.checked)} /> Fond en grille, placement sur la grille</label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">{colorField('Fond principal', 'bg')}{colorField('Dégradé', 'bg2')}{colorField('Accent du site', 'accent')}{colorField('Texte', 'textColor')}</div>
            <details className="rounded-lg border border-[var(--ad-line)] p-3">
              <summary className="cursor-pointer text-sm font-bold">Effets, transparence, cadres et bordures</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="font-semibold">Calque de couleur</span><select className="ad-select w-full" value={effect} onChange={(e) => setEffect(e.target.value)}>{EFFECTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                {simpleColorField('Couleur du calque', effectColor, setEffectColor)}
                <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Opacité du calque</span><span>{Math.round(Number(effectOpacity) * 100)}%</span></span><input className="w-full" type="range" min="0" max="0.9" step="0.02" value={effectOpacity} onChange={(e) => setEffectOpacity(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Transparence de l’image</span><span>{Math.round(Number(imageOpacity) * 100)}%</span></span><input className="w-full" type="range" min="0.1" max="1" step="0.05" value={imageOpacity} onChange={(e) => setImageOpacity(e.target.value)} /></label>
                {simpleColorField('Couleur de bordure', borderColor, setBorderColor)}
                <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Épaisseur de bordure</span><span>{borderWidth}px</span></span><input className="w-full" type="range" min="0" max="36" step="1" value={borderWidth} onChange={(e) => setBorderWidth(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Arrondi du cadre</span><span>{borderRadius}px</span></span><input className="w-full" type="range" min="0" max="180" step="4" value={borderRadius} onChange={(e) => setBorderRadius(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Arrondi des blocs carrés</span><span>{blockRadius}px</span></span><input className="w-full" type="range" min="0" max="100" step="4" value={blockRadius} onChange={(e) => setBlockRadius(e.target.value)} /></label>
              </div>
            </details>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-semibold">Alignement du texte</span><select className="ad-select w-full" value={align} onChange={(e) => { const value = e.target.value; setAlign(value); setTitleX(value === 'center' ? (layout === 'split-left' ? '70' : layout === 'split-right' ? '28' : '50') : value === 'right' ? (layout === 'split-left' ? '93' : layout === 'split-right' ? '47' : '93') : (layout === 'split-left' ? '53' : '7')); }}><option value="left">Gauche</option><option value="center">Centré</option><option value="right">Droite</option></select></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Voile / contraste</span><span>{Math.round(Number(overlay) * 100)}%</span></span><input className="w-full" type="range" min="0" max="0.88" step="0.04" value={overlay} onChange={(e) => setOverlay(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Position horizontale du titre</span><span>{titleX}%</span></span><input className="w-full" type="range" min="5" max="95" step="5" value={titleX} onChange={(e) => setTitleX(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="flex justify-between font-semibold"><span>Position verticale du titre</span><span>{titleY}%</span></span><input className="w-full" type="range" min="15" max="90" step="5" value={titleY} onChange={(e) => setTitleY(e.target.value)} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span className="font-semibold">URL à encoder dans le QR (facultatif)</span><input className="ad-input w-full" type="url" placeholder="https://exemple.com/fr/actualites/mon-article" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Logo configuré du site</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} /> QR code vers la page</label>
              <label className="space-y-1 text-sm"><span className="font-semibold">Position du logo</span><select className="ad-select w-full" value={logoPosition} onChange={(e) => setLogoPosition(e.target.value)}><option value="top-left">Haut gauche</option><option value="top-right">Haut droite</option><option value="bottom-left">Bas gauche</option><option value="bottom-right">Bas droite</option></select></label>
              {includeQr && <label className="space-y-1 text-sm"><span className="font-semibold">Position du QR code</span><select className="ad-select w-full" value={qrPosition} onChange={(e) => setQrPosition(e.target.value)}><option value="top-left">Haut gauche</option><option value="top-right">Haut droite</option><option value="bottom-left">Bas gauche</option><option value="bottom-right">Bas droite</option></select></label>}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--ad-line)] p-3 text-sm">
              <span className="font-semibold">Logo du site à ajouter :</span>
              {customLogo || brand.logo ? <>
                {/* eslint-disable-next-line @next/next/no-img-element -- Brand logo can be an uploaded GED file or configured URL. */}
                <img src={mediaPath(customLogo) || customLogo || brand.logo} alt={`Logo ${brand.title || 'du site'}`} className="h-10 max-w-40 rounded bg-white p-1 object-contain" />
                <span className="text-xs opacity-70">{customLogo ? 'Logo personnalisé' : brand.title || 'Logo configuré'}</span>
              </> : <><span className="text-xs opacity-70">Aucun logo configuré — ajoutez-le dans Paramètres → Marque.</span><a className="underline" href={`/${locale}/admin/settings?tab=brand`}>Configurer le logo</a></>}
            </div>
            <details className="rounded-lg border border-[var(--ad-line)] p-3">
              <summary className="cursor-pointer text-sm font-bold">Sujet, chapô, image ou logo personnalisés</summary>
              <div className="mt-3 grid gap-3">
                <label className="space-y-1 text-sm"><span>Titre de remplacement</span><input className="ad-input w-full" maxLength={180} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} /></label>
                {['articles', 'announcements', 'tips'].includes(source) && <label className="space-y-1 text-sm"><span>Sujet / catégorie (badge)</span><input className="ad-input w-full" maxLength={72} placeholder={String(previewItem?.sujet || previewItem?.category || previewItem?.classification || '')} value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} /></label>}
                <label className="space-y-1 text-sm"><span>Chapô / résumé</span><textarea className="ad-input w-full" rows={2} maxLength={500} value={customSummary} onChange={(e) => setCustomSummary(e.target.value)} /></label>
                {['services', 'solutions', 'products'].includes(source) && <label className="space-y-1 text-sm"><span>Icône Lucide (nom de l’icône de la fiche)</span><input className="ad-input w-full" placeholder={previewItem?.icon || 'stethoscope'} value={customIcon} onChange={(e) => setCustomIcon(e.target.value)} /></label>}
                <label className="space-y-1 text-sm"><span>Image GED de remplacement (/uploads/...)</span><input className="ad-input w-full" placeholder="/uploads/news/visuel.jpg" value={customImage} onChange={(e) => setCustomImage(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span>Logo GED personnalisé (facultatif)</span><input className="ad-input w-full" placeholder={brand.logo || '/uploads/ged/logo.png'} value={customLogo} onChange={(e) => setCustomLogo(e.target.value)} /></label>
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
            {tab === 'social' && <button className="ad-btn ad-btn-ghost" title="Le rendu s’ouvre comme un calque image déplaçable/redimensionnable; ajoutez ensuite texte, HTML/CSS, SVG/icônes, formes, graphiques et filtres." onClick={() => void openInCanvas()} disabled={sendingToCanvas || !selected}><Wand2 className="h-4 w-4" /> {sendingToCanvas ? 'Préparation…' : 'Ouvrir dans l’atelier graphique'}</button>}
          </div>
          {studioError && <p role="alert" className="mt-2 text-sm text-red-600">{studioError}</p>}
        </section>

        <section className="ad-card flex min-h-[360px] flex-col p-4">
          <h2 className="mb-3 text-lg font-black">Aperçu du rendu</h2>
          <div className="grid min-h-[290px] flex-1 place-items-center overflow-hidden rounded-xl border border-[var(--ad-line)] p-3" style={{ background: 'var(--ad-bg-2)' }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- The URL is a dynamic binary API preview.
              <img key={imageUrl} src={imageUrl} alt="Aperçu du visuel généré" className="max-h-[560px] max-w-full object-contain shadow-xl" />
            ) : <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{isResolvingContent ? 'Chargement de la traduction et de l’aperçu…' : 'Choisissez un contenu et un format pour afficher l’aperçu.'}</p>}
          </div>
          {absolute && <div className="mt-3"><div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ad-muted)' }}>URL publique de l’API</div><code className="block break-all rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5">{absolute}</code></div>}
          {tab === 'social' && <p className="mt-2 text-xs" style={{ color: 'var(--ad-muted)' }}>Paramètres API : source et identifiant dans le chemin, puis plateforme, couleurs, alignement, voile et QR dans la query string. Le contenu doit être publié.</p>}
        </section>
      </div>
    </div>
  );
}
