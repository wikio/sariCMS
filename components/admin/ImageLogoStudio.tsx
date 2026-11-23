'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight, Check, Code2, Copy, Download, ExternalLink, FolderPlus,
  Grid, Image as ImageIcon, Layers, Loader2, Palette, RefreshCw, Sparkles,
  Trash2, Type, Upload, Wand2,
} from 'lucide-react';
import {
  DEFAULT_PLACEHOLDER_CONFIG,
  PLACEHOLDER_ICONS,
  buildPlaceholderPath,
  buildPlaceholderUrl,
  pickContrastColor,
  renderPlaceholderSvg,
  renderPlaceholderToCanvas,
  type FontKind,
  type GradientDir,
  type IconPosition,
  type PatternKind,
  type PlaceholderConfig,
  type PlaceholderSpec,
} from '@/lib/placeholder-engine';
import { getClientCsrfToken } from '@/lib/csrf';
import { useToast } from '@/components/admin/Toast';

interface QuickTemplate {
  id: string;
  patch: Partial<PlaceholderSpec>;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'partner',
    patch: {
      width: 150,
      height: 80,
      bg: '#169EC9',
      bg2: '#0B5F86',
      gradientDir: 'none',
      fg: '#FFFFFF',
      accent: '#FFFFFF',
      text: 'SURGICARE',
      sub: '',
      badge: '',
      icon: 'heart-pulse',
      iconPos: 'left',
      iconBg: false,
      pattern: 'none',
      radius: 8,
      border: 0,
      shadow: false,
      font: 'sans',
      weight: 700,
      uppercase: true,
    },
  },
  {
    id: 'medical-hd',
    patch: {
      width: 400,
      height: 200,
      bg: '#169EC9',
      bg2: '#0B5F86',
      gradientDir: 'diagonal',
      fg: '#FFFFFF',
      accent: '#C6DA34',
      text: 'SURGICARE',
      sub: 'Solutions Médicales',
      badge: '',
      icon: 'stethoscope',
      iconPos: 'left',
      iconBg: true,
      pattern: 'dots',
      radius: 18,
      border: 0,
      shadow: true,
      font: 'geometric',
      weight: 800,
      uppercase: true,
    },
  },
  {
    id: 'app-icon',
    patch: {
      width: 512,
      height: 512,
      bg: '#1B2A4A',
      bg2: '#0F172A',
      gradientDir: 'radial',
      fg: '#FFFFFF',
      accent: '#C6DA34',
      text: 'SARI',
      sub: 'SYSTÈME',
      badge: '',
      icon: 'shield-plus',
      iconPos: 'top',
      iconBg: true,
      pattern: 'rings',
      radius: 96,
      border: 0,
      shadow: true,
      font: 'geometric',
      weight: 800,
      uppercase: true,
    },
  },
  {
    id: 'product-card',
    patch: {
      width: 800,
      height: 600,
      bg: '#0F766E',
      bg2: '#115E59',
      gradientDir: 'diagonal',
      fg: '#FFFFFF',
      accent: '#C6DA34',
      text: 'ÉCHOGRAPHE HD',
      sub: 'Imagerie Médicale Haute Précision',
      badge: 'PRO',
      icon: 'activity',
      iconPos: 'top',
      iconBg: true,
      pattern: 'grid',
      radius: 20,
      border: 0,
      shadow: true,
      font: 'sans',
      weight: 800,
      uppercase: false,
    },
  },
  {
    id: 'og-banner',
    patch: {
      width: 1200,
      height: 630,
      bg: '#1B2A4A',
      bg2: '#169EC9',
      gradientDir: 'horizontal',
      fg: '#FFFFFF',
      accent: '#EAB616',
      text: 'SARI SYSTÈME',
      sub: 'Équipements & Solutions Professionnelles',
      badge: '2026',
      icon: 'sparkles',
      iconPos: 'left',
      iconBg: true,
      pattern: 'mesh',
      radius: 0,
      border: 0,
      shadow: true,
      font: 'geometric',
      weight: 800,
      uppercase: false,
    },
  },
  {
    id: 'minimal-light',
    patch: {
      width: 400,
      height: 200,
      bg: '#F1F5F9',
      bg2: '#E2E8F0',
      gradientDir: 'vertical',
      fg: '#0F172A',
      accent: '#169EC9',
      text: 'PARTENAIRE',
      sub: 'Distributeur Officiel',
      badge: 'ISO',
      icon: 'check-badge',
      iconPos: 'left',
      iconBg: true,
      pattern: 'none',
      radius: 14,
      border: 2,
      borderColor: '#CBD5E1',
      shadow: false,
      font: 'sans',
      weight: 700,
      uppercase: true,
    },
  },
];

function initialSpecFromConfig(config: PlaceholderConfig): PlaceholderSpec {
  return {
    width: config.defaultWidth || 400,
    height: config.defaultHeight || 200,
    bg: config.defaultBg || '#169EC9',
    bg2: config.defaultBg2 || '#0B5F86',
    gradientDir: config.defaultGradient || 'diagonal',
    fg: config.defaultFg || '#FFFFFF',
    accent: config.defaultFg || '#FFFFFF',
    text: config.defaultText || 'SURGICARE',
    sub: '',
    badge: '',
    font: config.defaultFont || 'sans',
    weight: 700,
    fontSize: 0,
    letterSpacing: 1,
    uppercase: true,
    icon: config.defaultIcon && config.defaultIcon !== 'none' ? config.defaultIcon : 'heart-pulse',
    iconPos: 'left',
    iconSize: 0,
    iconBg: false,
    pattern: config.defaultPattern || 'none',
    radius: config.defaultRadius || 10,
    border: 0,
    borderColor: config.defaultFg || '#FFFFFF',
    shadow: false,
    showDims: false,
  };
}

export default function ImageLogoStudio({
  config: externalConfig,
  onSavedToMedia,
  compact = false,
}: {
  config?: PlaceholderConfig;
  onSavedToMedia?: (url: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations('admin.placeholderStudio');
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [config, setConfig] = useState<PlaceholderConfig>(externalConfig || DEFAULT_PLACEHOLDER_CONFIG);
  const [spec, setSpec] = useState<PlaceholderSpec>(() =>
    initialSpecFromConfig(externalConfig || DEFAULT_PLACEHOLDER_CONFIG),
  );
  const [origin, setOrigin] = useState('');
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(2);
  const [showChecker, setShowChecker] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [iconFilter, setIconFilter] = useState<'all' | 'medical' | 'business' | 'tech' | 'general'>('all');
  const [activePanel, setActivePanel] = useState<'content' | 'style' | 'icon' | 'canvas'>('content');

  // Superposition image/logo exclusive Canvas
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [overlayMode, setOverlayMode] = useState<'icon' | 'cover' | 'watermark'>('icon');
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [overlayScale, setOverlayScale] = useState(1);

  // Sauvegarde Médiathèque (GED)
  const [uploadFolder, setUploadFolder] = useState('logo');
  const [savingMedia, setSavingMedia] = useState(false);
  const [savedMediaUrl, setSavedMediaUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (externalConfig) {
      setConfig(externalConfig);
      return;
    }
    let cancelled = false;
    fetch('/api/admin/placeholder-settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok && data.config) {
          setConfig(data.config);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [externalConfig]);

  const effectiveOrigin = config.baseUrl || origin;
  const relativeUrl = useMemo(() => buildPlaceholderPath(spec), [spec]);
  const fullUrl = useMemo(() => buildPlaceholderUrl(spec, effectiveOrigin), [spec, effectiveOrigin]);

  // Rendu Canvas en temps réel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPlaceholderToCanvas(canvas, spec, {
      scale: exportScale,
      overlayImage: overlayImg,
      overlayMode,
      overlayOpacity,
      overlayScale,
      showGuides,
    });
  }, [spec, exportScale, overlayImg, overlayMode, overlayOpacity, overlayScale, showGuides]);

  const patchSpec = useCallback((patch: Partial<PlaceholderSpec>) => {
    setSpec((prev) => ({ ...prev, ...patch }));
  }, []);

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast(t('copied'), 'success');
      setTimeout(() => setCopiedKey((cur) => (cur === key ? '' : cur)), 1800);
    } catch {
      showToast(t('copyError'), 'error');
    }
  };

  const renderCleanExportCanvas = (): HTMLCanvasElement => {
    const off = document.createElement('canvas');
    renderPlaceholderToCanvas(off, spec, {
      scale: exportScale,
      overlayImage: overlayImg,
      overlayMode,
      overlayOpacity,
      overlayScale,
      showGuides: false,
    });
    return off;
  };

  const fileSlug = () => {
    const base = (spec.text || 'visuel')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `${base || 'logo'}-${spec.width}x${spec.height}`;
  };

  const downloadRaster = (format: 'png' | 'webp') => {
    const off = renderCleanExportCanvas();
    const mime = format === 'webp' ? 'image/webp' : 'image/png';
    const dataUrl = off.toDataURL(mime, 0.94);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileSlug()}${exportScale > 1 ? `@${exportScale}x` : ''}.${format}`;
    a.click();
    showToast(t('downloaded', { format: format.toUpperCase() }), 'success');
  };

  const downloadSvg = () => {
    const svg = renderPlaceholderSvg(spec);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileSlug()}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t('downloaded', { format: 'SVG' }), 'success');
  };

  const saveToMediaLibrary = async () => {
    setSavingMedia(true);
    try {
      const off = renderCleanExportCanvas();
      const dataUrl = off.toDataURL('image/png');
      const csrf = getClientCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrf) headers['x-csrf-token'] = csrf;

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          dataUrl,
          extension: 'png',
          module: uploadFolder,
          name: fileSlug(),
          title: spec.text || `${spec.width}x${spec.height}`,
          alt: [spec.text, spec.sub].filter(Boolean).join(' — '),
          tags: ['logo-studio', uploadFolder],
          kind: 'image',
        }),
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || t('saveMediaError'));
      }
      setSavedMediaUrl(json.url);
      showToast(t('savedToMedia'), 'success');
      onSavedToMedia?.(json.url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('saveMediaError'), 'error');
    } finally {
      setSavingMedia(false);
    }
  };

  const handleOverlayFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('invalidImage'), 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setOverlayImg(img);
        setOverlayName(file.name);
        setOverlayOpacity(overlayMode === 'icon' ? 1 : 0.3);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const visibleIcons = useMemo(
    () => (iconFilter === 'all' ? PLACEHOLDER_ICONS : PLACEHOLDER_ICONS.filter((i) => i.category === iconFilter)),
    [iconFilter],
  );

  const imgTag = `<img src="${fullUrl}" alt="${(spec.text || 'Image').replace(/"/g, '&quot;')}" width="${spec.width}" height="${spec.height}" />`;

  return (
    <div className="space-y-5">
      {/* Modèles rapides 1-clic */}
      <div className="ad-card p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--ad-muted)' }}>
            <Wand2 className="w-3.5 h-3.5" style={{ color: 'var(--ad-accent)' }} />
            {t('quickTemplates')}
          </span>
          <button
            type="button"
            className="ad-btn ad-btn-ghost !py-1 !px-2.5 text-xs"
            onClick={() => {
              setSpec(initialSpecFromConfig(config));
              setOverlayImg(null);
              setOverlayName('');
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('resetDesign')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => patchSpec(tpl.patch)}
              className="ad-btn ad-btn-ghost !py-1.5 !px-3 text-xs"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border"
                style={{ background: tpl.patch.bg, borderColor: 'var(--ad-line)' }}
              />
              {t(`template_${tpl.id}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Grille principale : Aperçu Canvas + Sorties à gauche, Contrôles à droite */}
      <div className={`grid gap-5 ${compact ? 'xl:grid-cols-12' : 'lg:grid-cols-12'}`}>
        {/* Colonne Aperçu Canvas & Exports */}
        <div className={`${compact ? 'xl:col-span-7' : 'lg:col-span-7'} space-y-4`}>
          <div className="ad-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider">{t('canvasPreview')}</span>
                <span className="ad-chip ad-chip-acc tabular-nums">
                  {spec.width} × {spec.height} px
                </span>
                <span className="ad-chip ad-chip-mute tabular-nums">
                  Export @{exportScale}x ({spec.width * exportScale}×{spec.height * exportScale})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {([1, 2, 3] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setExportScale(sc)}
                    className={`ad-btn !py-1 !px-2 text-xs ${exportScale === sc ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                  >
                    @{sc}x
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowGuides((v) => !v)}
                  className={`ad-btn !py-1 !px-2 text-xs ${showGuides ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                  title={t('toggleGuides')}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowChecker((v) => !v)}
                  className={`ad-btn !py-1 !px-2 text-xs ${showChecker ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                  title={t('toggleChecker')}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Zone d'affichage du Canvas */}
            <div
              className="rounded-xl border flex items-center justify-center p-6 min-h-[260px] max-h-[480px] overflow-auto"
              style={{
                borderColor: 'var(--ad-line)',
                background: showChecker
                  ? 'repeating-conic-gradient(rgba(128,128,128,0.14) 0% 25%, transparent 0% 50%) 50% / 18px 18px'
                  : 'var(--ad-surface-2)',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%',
                  maxHeight: '420px',
                  width: spec.width > 560 ? '100%' : `${spec.width}px`,
                  height: 'auto',
                  display: 'block',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                }}
              />
            </div>

            {/* Actions d'export Canvas */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" className="ad-btn ad-btn-primary" onClick={() => downloadRaster('png')}>
                <Download className="w-4 h-4" /> PNG (@{exportScale}x)
              </button>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => downloadRaster('webp')}>
                <Download className="w-4 h-4" /> WebP
              </button>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={downloadSvg}>
                <Download className="w-4 h-4" /> SVG
              </button>

              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <select
                  className="ad-input !w-auto !py-1.5 text-xs"
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  aria-label={t('targetFolder')}
                >
                  <option value="logo">{t('folderLogo')}</option>
                  <option value="ged">{t('folderGed')}</option>
                  <option value="partners">{t('folderPartners')}</option>
                  <option value="products">{t('folderProducts')}</option>
                  <option value="events">{t('folderEvents')}</option>
                </select>
                <button
                  type="button"
                  disabled={savingMedia}
                  className="ad-btn ad-btn-primary"
                  onClick={saveToMediaLibrary}
                >
                  {savingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  {t('saveToMedia')}
                </button>
              </div>
            </div>

            {savedMediaUrl && (
              <div
                className="p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs"
                style={{
                  borderColor: 'color-mix(in srgb, #10b981 45%, transparent)',
                  background: 'color-mix(in srgb, #10b981 10%, transparent)',
                }}
              >
                <div className="min-w-0">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300">{t('savedMediaReady')}</div>
                  <code className="break-all opacity-90">{savedMediaUrl}</code>
                </div>
                <button
                  type="button"
                  className="ad-btn ad-btn-ghost !py-1 text-xs shrink-0"
                  onClick={() => copyText(savedMediaUrl, 'media')}
                >
                  {copiedKey === 'media' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {t('copyUrl')}
                </button>
              </div>
            )}
          </div>

          {/* URL dynamique hébergée sur la vitrine */}
          <div className="ad-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--ad-accent)' }} />
                  {t('dynamicUrlTitle')}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                  {t('dynamicUrlDesc')}
                </p>
              </div>
              {!config.enabled && (
                <span className="ad-chip ad-chip-warn">{t('endpointDisabled')}</span>
              )}
            </div>

            <div className="p-2.5 rounded-lg font-mono text-xs break-all border select-all" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
              {fullUrl}
            </div>

            {overlayImg && (
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                {t('canvasOverlayNote')}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ad-btn ad-btn-primary !py-1.5 text-xs"
                onClick={() => copyText(fullUrl, 'fullUrl')}
              >
                {copiedKey === 'fullUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {t('copyUrl')}
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-ghost !py-1.5 text-xs"
                onClick={() => copyText(relativeUrl, 'relUrl')}
              >
                {copiedKey === 'relUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {t('copyRelative')}
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-ghost !py-1.5 text-xs"
                onClick={() => copyText(imgTag, 'imgTag')}
              >
                {copiedKey === 'imgTag' ? <Check className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
                {t('copyImgTag', { tag: '<img>' })}
              </button>
              <a
                href={relativeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ad-btn ad-btn-ghost !py-1.5 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {t('openLive')}
              </a>
            </div>
          </div>
        </div>

        {/* Colonne Contrôles */}
        <div className={`${compact ? 'xl:col-span-5' : 'lg:col-span-5'} ad-card p-4 space-y-4`}>
          {/* Onglets de personnalisation */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg" style={{ background: 'var(--ad-surface-2)' }}>
            {([
              { id: 'content', icon: Type, label: t('tabContent') },
              { id: 'style', icon: Palette, label: t('tabColors') },
              { id: 'icon', icon: Sparkles, label: t('tabIcons') },
              { id: 'canvas', icon: ImageIcon, label: t('tabCanvas') },
            ] as const).map((item) => {
              const Icon = item.icon;
              const on = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePanel(item.id)}
                  className={`py-2 px-1.5 rounded-md text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    on ? 'ad-btn-primary' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* PANEL 1 : Texte & Dimensions */}
          {activePanel === 'content' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('sizePresets')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {config.sizePresets.map((p) => {
                    const active = spec.width === p.width && spec.height === p.height;
                    return (
                      <button
                        key={`${p.name}-${p.width}x${p.height}`}
                        type="button"
                        onClick={() => patchSpec({ width: p.width, height: p.height })}
                        className={`ad-btn !py-1 !px-2 text-[11px] ${active ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                      >
                        {p.name} ({p.width}×{p.height})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('width')} (px)
                  </span>
                  <input
                    type="number"
                    min={32}
                    max={config.maxWidth}
                    className="ad-input"
                    value={spec.width}
                    onChange={(e) => patchSpec({ width: Math.max(32, Math.min(config.maxWidth, Number(e.target.value) || 32)) })}
                  />
                </label>
                <button
                  type="button"
                  className="ad-btn ad-btn-ghost !px-2.5 mb-0.5"
                  onClick={() => patchSpec({ width: spec.height, height: spec.width })}
                  title={t('swapDims')}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('height')} (px)
                  </span>
                  <input
                    type="number"
                    min={32}
                    max={config.maxHeight}
                    className="ad-input"
                    value={spec.height}
                    onChange={(e) => patchSpec({ height: Math.max(32, Math.min(config.maxHeight, Number(e.target.value) || 32)) })}
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('mainTitle')}
                </span>
                <textarea
                  rows={2}
                  className="ad-input"
                  value={spec.text}
                  onChange={(e) => patchSpec({ text: e.target.value })}
                  placeholder="SURGICARE"
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('subtitleField')}
                  </span>
                  <input
                    className="ad-input"
                    value={spec.sub}
                    onChange={(e) => patchSpec({ sub: e.target.value })}
                    placeholder={t('medicalSubtitle')}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('cornerBadge')}
                  </span>
                  <input
                    className="ad-input"
                    maxLength={24}
                    value={spec.badge}
                    onChange={(e) => patchSpec({ badge: e.target.value })}
                    placeholder="PRO / ISO / 2026"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('fontFamily')}
                  </span>
                  <select
                    className="ad-input"
                    value={spec.font}
                    onChange={(e) => patchSpec({ font: e.target.value as FontKind })}
                  >
                    <option value="sans">{t('fontSans')}</option>
                    <option value="geometric">{t('fontGeometric')}</option>
                    <option value="serif">{t('fontSerif')}</option>
                    <option value="mono">{t('fontMono')}</option>
                    <option value="display">{t('fontDisplay')}</option>
                  </select>
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('fontWeight')}
                  </span>
                  <select
                    className="ad-input"
                    value={spec.weight}
                    onChange={(e) => patchSpec({ weight: Number(e.target.value) })}
                  >
                    <option value={400}>{t('regular')}</option>
                    <option value={600}>{t('semibold')}</option>
                    <option value={700}>{t('bold')}</option>
                    <option value={800}>{t('extraBold')}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('fontSize')} ({spec.fontSize === 0 ? t('automatic') : `${spec.fontSize}px`})
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={140}
                    value={spec.fontSize}
                    onChange={(e) => patchSpec({ fontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('letterSpacing')} ({spec.letterSpacing}px)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={spec.letterSpacing}
                    onChange={(e) => patchSpec({ letterSpacing: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spec.uppercase} onChange={(e) => patchSpec({ uppercase: e.target.checked })} />
                  <span>{t('uppercase')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spec.shadow} onChange={(e) => patchSpec({ shadow: e.target.checked })} />
                  <span>{t('dropShadow')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spec.showDims} onChange={(e) => patchSpec({ showDims: e.target.checked })} />
                  <span>{t('showDims')}</span>
                </label>
              </div>
            </div>
          )}

          {/* PANEL 2 : Couleurs, Dégradés & Motifs */}
          {activePanel === 'style' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('brandPalette')}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {config.palette.map((sw) => (
                    <button
                      key={`${sw.name}-${sw.bg}`}
                      type="button"
                      onClick={() =>
                        patchSpec({
                          bg: sw.bg,
                          bg2: sw.bg2 || sw.bg,
                          fg: sw.fg,
                          accent: sw.fg,
                          borderColor: sw.fg,
                        })
                      }
                      className="ad-btn ad-btn-ghost !py-1.5 !px-2 text-xs justify-start"
                    >
                      <span
                        className="w-5 h-5 rounded-md shrink-0 border flex items-center justify-center text-[9px] font-black"
                        style={{
                          background: sw.bg2 ? `linear-gradient(135deg, ${sw.bg}, ${sw.bg2})` : sw.bg,
                          color: sw.fg,
                          borderColor: 'var(--ad-line)',
                        }}
                      >
                        Aa
                      </span>
                      <span className="truncate">{sw.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ColorInput label={t('bgColor')} value={spec.bg} onChange={(bg) => patchSpec({ bg })} />
                <ColorInput label={t('fgColor')} value={spec.fg} onChange={(fg) => patchSpec({ fg })} />
                <ColorInput label={t('bg2Color')} value={spec.bg2} onChange={(bg2) => patchSpec({ bg2 })} />
                <ColorInput label={t('accentColor')} value={spec.accent} onChange={(accent) => patchSpec({ accent })} />
              </div>

              <button
                type="button"
                className="ad-btn ad-btn-ghost !py-1 text-xs"
                onClick={() => {
                  const autoFg = pickContrastColor(spec.bg);
                  patchSpec({ fg: autoFg, accent: autoFg });
                }}
              >
                {t('autoContrast')}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('gradient')}
                  </span>
                  <select
                    className="ad-input"
                    value={spec.gradientDir}
                    onChange={(e) => patchSpec({ gradientDir: e.target.value as GradientDir })}
                  >
                    <option value="none">{t('gradNone')}</option>
                    <option value="diagonal">{t('gradDiagonal')}</option>
                    <option value="horizontal">{t('gradHorizontal')}</option>
                    <option value="vertical">{t('gradVertical')}</option>
                    <option value="radial">{t('gradRadial')}</option>
                  </select>
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('pattern')}
                  </span>
                  <select
                    className="ad-input"
                    value={spec.pattern}
                    onChange={(e) => patchSpec({ pattern: e.target.value as PatternKind })}
                  >
                    <option value="none">{t('patNone')}</option>
                    <option value="dots">{t('patDots')}</option>
                    <option value="grid">{t('patGrid')}</option>
                    <option value="diagonal">{t('patDiagonal')}</option>
                    <option value="waves">{t('patWaves')}</option>
                    <option value="rings">{t('patRings')}</option>
                    <option value="mesh">{t('patMesh')}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('radius')} ({spec.radius}px)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.min(200, Math.round(Math.min(spec.width, spec.height) / 2))}
                    value={spec.radius}
                    onChange={(e) => patchSpec({ radius: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                    {t('borderWidth')} ({spec.border}px)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={16}
                    value={spec.border}
                    onChange={(e) => patchSpec({ border: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
              </div>

              {spec.border > 0 && (
                <ColorInput
                  label={t('borderColor')}
                  value={spec.borderColor}
                  onChange={(borderColor) => patchSpec({ borderColor })}
                />
              )}
            </div>
          )}

          {/* PANEL 3 : Icônes vectorielles */}
          {activePanel === 'icon' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'medical', 'business', 'tech', 'general'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setIconFilter(cat)}
                    className={`ad-btn !py-1 !px-2 text-[11px] ${iconFilter === cat ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                  >
                    {t(`iconCat_${cat}`)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => patchSpec({ icon: 'none' })}
                  className={`p-2 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-1 ${
                    spec.icon === 'none' ? 'ad-btn-primary' : 'ad-btn-ghost'
                  }`}
                >
                  <span>∅</span>
                  <span>{t('noIcon')}</span>
                </button>
                {visibleIcons.map((ic) => {
                  const selected = spec.icon === ic.id;
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      title={t(`icon_${ic.id}`)}
                      onClick={() => patchSpec({ icon: ic.id })}
                      className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                        selected ? 'ad-btn-primary' : 'ad-btn-ghost'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {ic.paths.map((d, i) => (
                          <path key={i} d={d} />
                        ))}
                      </svg>
                      <span className="text-[10px] truncate max-w-full">{t(`icon_${ic.id}`)}</span>
                    </button>
                  );
                })}
              </div>

              {spec.icon !== 'none' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 block">
                      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                        {t('iconPosition')}
                      </span>
                      <select
                        className="ad-input"
                        value={spec.iconPos}
                        onChange={(e) => patchSpec({ iconPos: e.target.value as IconPosition })}
                      >
                        <option value="left">{t('posLeft')}</option>
                        <option value="top">{t('posTop')}</option>
                        <option value="right">{t('posRight')}</option>
                        <option value="badge">{t('posBadge')}</option>
                        <option value="only">{t('posOnly')}</option>
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                        {t('iconSize')} ({spec.iconSize === 0 ? t('automatic') : `${spec.iconSize}px`})
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={spec.iconSize}
                        onChange={(e) => patchSpec({ iconSize: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={spec.iconBg} onChange={(e) => patchSpec({ iconBg: e.target.checked })} />
                    <span>{t('iconBoxBg')}</span>
                  </label>
                </>
              )}
            </div>
          )}

          {/* PANEL 4 : Superposition Canvas (image/logo importé) */}
          {activePanel === 'canvas' && (
            <div className="space-y-4">
              <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                {t('canvasOverlayIntro')}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleOverlayFile}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ad-btn ad-btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" /> {t('uploadOverlay')}
                </button>
                {overlayImg && (
                  <button
                    type="button"
                    className="ad-btn ad-btn-ghost text-red-500"
                    onClick={() => {
                      setOverlayImg(null);
                      setOverlayName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <Trash2 className="w-4 h-4" /> {t('removeOverlay')}
                  </button>
                )}
              </div>

              {overlayImg && (
                <div className="space-y-3 p-3 rounded-lg border" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
                  <div className="text-xs font-bold truncate">{overlayName}</div>

                  <label className="space-y-1 block">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                      {t('overlayMode')}
                    </span>
                    <select
                      className="ad-input"
                      value={overlayMode}
                      onChange={(e) => {
                        const m = e.target.value as 'icon' | 'cover' | 'watermark';
                        setOverlayMode(m);
                        setOverlayOpacity(m === 'icon' ? 1 : m === 'cover' ? 0.35 : 0.18);
                      }}
                    >
                      <option value="icon">{t('overlayIcon')}</option>
                      <option value="cover">{t('overlayCover')}</option>
                      <option value="watermark">{t('overlayWatermark')}</option>
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                      {t('overlayOpacity')} ({Math.round(overlayOpacity * 100)}%)
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(overlayOpacity * 100)}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                      className="w-full"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                      {t('overlayScale')} ({Math.round(overlayScale * 100)}%)
                    </span>
                    <input
                      type="range"
                      min={40}
                      max={200}
                      value={Math.round(overlayScale * 100)}
                      onChange={(e) => setOverlayScale(Number(e.target.value) / 100)}
                      className="w-full"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#169EC9'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-9 h-9 rounded-md border cursor-pointer shrink-0 p-0.5"
          style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}
        />
        <input
          className="ad-input font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          maxLength={7}
        />
      </div>
    </label>
  );
}
