'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Check, Copy, ExternalLink, Loader2, Palette, Plus, RotateCcw, Save,
  Sliders, Sparkles, Trash2, Wand2,
} from 'lucide-react';
import {
  DEFAULT_PLACEHOLDER_CONFIG,
  PLACEHOLDER_ICONS,
  type FontKind,
  type GradientDir,
  type PatternKind,
  type PlaceholderConfig,
} from '@/lib/placeholder-engine';
import { getClientCsrfToken } from '@/lib/csrf';
import { useToast } from '@/components/admin/Toast';
import ImageLogoStudio from '@/components/admin/ImageLogoStudio';

export default function PlaceholderSettingsSection() {
  const locale = useLocale();
  const t = useTranslations('admin.placeholderStudio');
  const { showToast } = useToast();

  const [config, setConfig] = useState<PlaceholderConfig>(DEFAULT_PLACEHOLDER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<'config' | 'studio'>('config');
  const [origin, setOrigin] = useState('');
  const [copiedEx, setCopiedEx] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
    let cancelled = false;
    fetch('/api/admin/placeholder-settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok && data.config) {
          setConfig(data.config);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (reset = false) => {
    setSaving(true);
    try {
      const csrf = getClientCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrf) headers['x-csrf-token'] = csrf;
      const res = await fetch('/api/admin/placeholder-settings', {
        method: 'PUT',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(reset ? { reset: true } : { config }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; config?: PlaceholderConfig; error?: string } | null;
      if (!res.ok || !json?.ok || !json.config) {
        throw new Error(json?.error || t('saveError'));
      }
      setConfig(json.config);
      showToast(reset ? t('resetDone') : t('settingsSaved'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const effectiveOrigin = config.baseUrl || origin;
  const exampleUrls = [
    {
      id: 'classic',
      label: t('exampleClassic'),
      path: '/api/placeholder/150x80/169EC9/FFFFFF?text=SURGICARE',
    },
    {
      id: 'icon',
      label: t('exampleIcon'),
      path: '/api/placeholder/300x120/169EC9/FFFFFF?text=SURGICARE&sub=Medical&icon=heart-pulse&grad=diagonal&bg2=0B5F86&pattern=dots&radius=14',
    },
    {
      id: 'badge',
      label: t('exampleCard'),
      path: '/api/placeholder/400x200/1B2A4A/FFFFFF?text=SARI+SYSTEME&icon=shield-plus&iconBg=1&accent=C6DA34&badge=PRO&pattern=rings&radius=16',
    },
  ];

  const copyExample = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedEx(id);
      showToast(t('copied'), 'success');
      setTimeout(() => setCopiedEx((c) => (c === id ? '' : c)), 1600);
    } catch {
      showToast(t('copyError'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="ad-card p-8 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--ad-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-5 ad-rise">
      {/* Barre de navigation interne Paramètres ↔ Atelier Canvas */}
      <div className="ad-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--ad-accent)' }}>
            <Sparkles className="w-3.5 h-3.5" /> {t('settingsEyebrow')}
          </div>
          <h2 className="font-black text-lg mt-0.5">{t('settingsTitle')}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
            {t('settingsSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('config')}
            className={`ad-btn ${subTab === 'config' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          >
            <Sliders className="w-4 h-4" /> {t('subTabConfig')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('studio')}
            className={`ad-btn ${subTab === 'studio' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          >
            <Wand2 className="w-4 h-4" /> {t('subTabStudio')}
          </button>
          <Link href={`/${locale}/admin/media/studio`} className="ad-btn ad-btn-ghost">
            <ExternalLink className="w-4 h-4" /> {t('openFullStudio')}
          </Link>
        </div>
      </div>

      {subTab === 'studio' ? (
        <ImageLogoStudio config={config} compact />
      ) : (
        <div className="space-y-5">
          {/* Activation, URL publique & Sécurité */}
          <section className="ad-card p-5 space-y-4">
            <h3 className="font-black text-base">{t('sectionGeneral')}</h3>

            <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--ad-line)' }}>
              <div className="space-y-0.5">
                <div className="text-sm font-bold">{t('enableEndpoint')}</div>
                <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('enableEndpointHint')}</div>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`ad-toggle ${config.enabled ? 'is-on' : ''}`}
                aria-pressed={config.enabled}
                role="switch"
              >
                {config.enabled ? (
                  <>
                    <span className="ad-toggle-label">{t('enabledLabel')}</span>
                    <span className="ad-toggle-knob" />
                  </>
                ) : (
                  <>
                    <span className="ad-toggle-knob" />
                    <span className="ad-toggle-label">{t('disabledLabel')}</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--ad-line)' }}>
              <div className="space-y-0.5">
                <div className="text-sm font-bold">{t('allowHotlink')}</div>
                <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('allowHotlinkHint')}</div>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, allowExternalReferer: !config.allowExternalReferer })}
                className={`ad-toggle ${config.allowExternalReferer ? 'is-on' : ''}`}
                aria-pressed={config.allowExternalReferer}
                role="switch"
              >
                {config.allowExternalReferer ? (
                  <>
                    <span className="ad-toggle-label">{t('enabledLabel')}</span>
                    <span className="ad-toggle-knob" />
                  </>
                ) : (
                  <>
                    <span className="ad-toggle-knob" />
                    <span className="ad-toggle-label">{t('disabledLabel')}</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('baseUrlLabel')}
                </span>
                <input
                  className="ad-input"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder={origin || 'https://sarisysteme.com'}
                />
                <span className="text-[11px] block" style={{ color: 'var(--ad-muted)' }}>
                  {t('baseUrlHint')}
                </span>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('cacheMaxAge')} (s)
                </span>
                <input
                  type="number"
                  min={0}
                  max={31536000}
                  className="ad-input"
                  value={config.cacheMaxAge}
                  onChange={(e) => setConfig({ ...config, cacheMaxAge: Math.max(0, Number(e.target.value) || 0) })}
                />
                <span className="text-[11px] block" style={{ color: 'var(--ad-muted)' }}>
                  {t('cacheMaxAgeHint')}
                </span>
              </label>
            </div>
          </section>

          {/* Valeurs par défaut & Bornes */}
          <section className="ad-card p-5 space-y-4">
            <h3 className="font-black text-base">{t('sectionDefaults')}</h3>

            <div className="grid sm:grid-cols-4 gap-3">
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('defaultWidth')}
                </span>
                <input
                  type="number"
                  min={32}
                  max={config.maxWidth}
                  className="ad-input"
                  value={config.defaultWidth}
                  onChange={(e) => setConfig({ ...config, defaultWidth: Number(e.target.value) || 400 })}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('defaultHeight')}
                </span>
                <input
                  type="number"
                  min={32}
                  max={config.maxHeight}
                  className="ad-input"
                  value={config.defaultHeight}
                  onChange={(e) => setConfig({ ...config, defaultHeight: Number(e.target.value) || 240 })}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('maxWidth')}
                </span>
                <input
                  type="number"
                  min={200}
                  max={4096}
                  className="ad-input"
                  value={config.maxWidth}
                  onChange={(e) => setConfig({ ...config, maxWidth: Number(e.target.value) || 2400 })}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('maxHeight')}
                </span>
                <input
                  type="number"
                  min={200}
                  max={4096}
                  className="ad-input"
                  value={config.maxHeight}
                  onChange={(e) => setConfig({ ...config, maxHeight: Number(e.target.value) || 2400 })}
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <ColorField label={t('bgColor')} value={config.defaultBg} onChange={(v) => setConfig({ ...config, defaultBg: v })} />
              <ColorField label={t('bg2Color')} value={config.defaultBg2} onChange={(v) => setConfig({ ...config, defaultBg2: v })} />
              <ColorField label={t('fgColor')} value={config.defaultFg} onChange={(v) => setConfig({ ...config, defaultFg: v })} />
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('gradient')}
                </span>
                <select
                  className="ad-input"
                  value={config.defaultGradient}
                  onChange={(e) => setConfig({ ...config, defaultGradient: e.target.value as GradientDir })}
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
                  value={config.defaultPattern}
                  onChange={(e) => setConfig({ ...config, defaultPattern: e.target.value as PatternKind })}
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

              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('fontFamily')}
                </span>
                <select
                  className="ad-input"
                  value={config.defaultFont}
                  onChange={(e) => setConfig({ ...config, defaultFont: e.target.value as FontKind })}
                >
                  <option value="sans">Sans-serif</option>
                  <option value="geometric">Géométrique</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                  <option value="display">Display</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('defaultIcon')}
                </span>
                <select
                  className="ad-input"
                  value={config.defaultIcon}
                  onChange={(e) => setConfig({ ...config, defaultIcon: e.target.value })}
                >
                  <option value="none">{t('noIcon')}</option>
                  {PLACEHOLDER_ICONS.map((ic) => (
                    <option key={ic.id} value={ic.id}>{ic.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('defaultText')}
                </span>
                <input
                  className="ad-input"
                  value={config.defaultText}
                  onChange={(e) => setConfig({ ...config, defaultText: e.target.value })}
                  placeholder="SARI"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                  {t('radius')} (px)
                </span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  className="ad-input"
                  value={config.defaultRadius}
                  onChange={(e) => setConfig({ ...config, defaultRadius: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            </div>
          </section>

          {/* Palette de marque éditable */}
          <section className="ad-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <Palette className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
                  {t('brandPalette')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('brandPaletteHint')}</p>
              </div>
              <button
                type="button"
                className="ad-btn ad-btn-ghost !py-1.5 text-xs"
                onClick={() =>
                  setConfig({
                    ...config,
                    palette: [...config.palette, { name: 'Nouvelle couleur', bg: '#169EC9', bg2: '#0B5F86', fg: '#FFFFFF' }],
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" /> {t('addColor')}
              </button>
            </div>

            <div className="space-y-2">
              {config.palette.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
                  <input
                    className="ad-input !py-1.5 text-xs"
                    value={item.name}
                    onChange={(e) => {
                      const next = [...config.palette];
                      next[idx] = { ...item, name: e.target.value };
                      setConfig({ ...config, palette: next });
                    }}
                  />
                  <input
                    type="color"
                    title={t('bgColor')}
                    value={item.bg}
                    onChange={(e) => {
                      const next = [...config.palette];
                      next[idx] = { ...item, bg: e.target.value.toUpperCase() };
                      setConfig({ ...config, palette: next });
                    }}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="color"
                    title={t('bg2Color')}
                    value={item.bg2 || item.bg}
                    onChange={(e) => {
                      const next = [...config.palette];
                      next[idx] = { ...item, bg2: e.target.value.toUpperCase() };
                      setConfig({ ...config, palette: next });
                    }}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="color"
                    title={t('fgColor')}
                    value={item.fg}
                    onChange={(e) => {
                      const next = [...config.palette];
                      next[idx] = { ...item, fg: e.target.value.toUpperCase() };
                      setConfig({ ...config, palette: next });
                    }}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <button
                    type="button"
                    disabled={config.palette.length <= 1}
                    className="ad-btn ad-btn-ghost !p-1.5 text-red-500 disabled:opacity-30"
                    onClick={() => setConfig({ ...config, palette: config.palette.filter((_, i) => i !== idx) })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Préréglages de dimensions éditables */}
          <section className="ad-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-base">{t('sizePresets')}</h3>
                <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('sizePresetsHint')}</p>
              </div>
              <button
                type="button"
                className="ad-btn ad-btn-ghost !py-1.5 text-xs"
                onClick={() =>
                  setConfig({
                    ...config,
                    sizePresets: [...config.sizePresets, { name: 'Format personnalisé', width: 600, height: 300, category: 'web' }],
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" /> {t('addSize')}
              </button>
            </div>

            <div className="space-y-2">
              {config.sizePresets.map((preset, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_92px_92px_auto] gap-2 items-center">
                  <input
                    className="ad-input !py-1.5 text-xs"
                    value={preset.name}
                    onChange={(e) => {
                      const next = [...config.sizePresets];
                      next[idx] = { ...preset, name: e.target.value };
                      setConfig({ ...config, sizePresets: next });
                    }}
                  />
                  <input
                    type="number"
                    min={32}
                    max={config.maxWidth}
                    className="ad-input !py-1.5 text-xs"
                    value={preset.width}
                    onChange={(e) => {
                      const next = [...config.sizePresets];
                      next[idx] = { ...preset, width: Number(e.target.value) || 150 };
                      setConfig({ ...config, sizePresets: next });
                    }}
                  />
                  <input
                    type="number"
                    min={32}
                    max={config.maxHeight}
                    className="ad-input !py-1.5 text-xs"
                    value={preset.height}
                    onChange={(e) => {
                      const next = [...config.sizePresets];
                      next[idx] = { ...preset, height: Number(e.target.value) || 80 };
                      setConfig({ ...config, sizePresets: next });
                    }}
                  />
                  <button
                    type="button"
                    disabled={config.sizePresets.length <= 1}
                    className="ad-btn ad-btn-ghost !p-1.5 text-red-500 disabled:opacity-30"
                    onClick={() => setConfig({ ...config, sizePresets: config.sizePresets.filter((_, i) => i !== idx) })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Exemples d'URLs prêtes à l'emploi sur la vitrine */}
          <section className="ad-card p-5 space-y-3">
            <h3 className="font-black text-base">{t('liveExamplesTitle')}</h3>
            <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('liveExamplesDesc')}</p>
            <div className="grid md:grid-cols-3 gap-3">
              {exampleUrls.map((ex) => {
                const full = effectiveOrigin ? `${effectiveOrigin}${ex.path}` : ex.path;
                return (
                  <div
                    key={ex.id}
                    className="rounded-lg border p-3 space-y-2.5 flex flex-col justify-between"
                    style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}
                  >
                    <div className="text-xs font-bold">{ex.label}</div>
                    <div className="flex items-center justify-center py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ex.path} alt={ex.label} className="max-h-24 max-w-full rounded shadow-sm" />
                    </div>
                    <code className="text-[10px] break-all block opacity-80">{full}</code>
                    <button
                      type="button"
                      className="ad-btn ad-btn-ghost !py-1 text-xs w-full justify-center"
                      onClick={() => copyExample(full, ex.id)}
                    >
                      {copiedEx === ex.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {t('copyUrl')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Actions de sauvegarde */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={saving}
              className="ad-btn ad-btn-ghost"
              onClick={() => {
                if (confirm(t('confirmReset'))) void save(true);
              }}
            >
              <RotateCcw className="w-4 h-4" /> {t('resetDefaults')}
            </button>
            <button
              type="button"
              disabled={saving}
              className="ad-btn ad-btn-primary"
              onClick={() => void save(false)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('saveSettings')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
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
          className="w-9 h-9 rounded border cursor-pointer shrink-0 p-0.5"
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
