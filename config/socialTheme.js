import { DEFAULT_THEME, SOCIAL_FORMATS } from './socialTemplates.js';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function parseColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  let match = color.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (match) {
    let hex = match[1];
    if (hex.length <= 4) hex = [...hex].map((part) => part + part).join('');
    const hasAlpha = hex.length === 8;
    const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const alpha = hasAlpha ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return `rgba(${channels.join(', ')}, ${Number(alpha.toFixed(3))})`;
  }
  match = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
  if (!match) return fallback;
  const [r, g, b] = match.slice(1, 4).map((part) => Number(part));
  if ([r, g, b].some((channel) => channel > 255)) return fallback;
  const alpha = match[4] === undefined ? 1 : clamp(Number(match[4]), 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbChannels(color) {
  const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (match) return match.slice(1, 4).map(Number);
  return [11, 13, 16];
}

function relativeLuminance(color) {
  const linear = rgbChannels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastText(color) {
  return relativeLuminance(parseColor(color, DEFAULT_THEME.background)) > 0.42 ? '#0B0D10' : '#FFFFFF';
}

function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function resolveDimensions(format = 'square', overrides = {}) {
  const preset = SOCIAL_FORMATS[format] || SOCIAL_FORMATS.square;
  const width = clamp(Math.round(Number(overrides.width) || preset.width), 320, 2560);
  const height = clamp(Math.round(Number(overrides.height) || preset.height), 320, 2560);
  return { width, height };
}

/** Convert a site's design tokens into a safe, contrast-aware renderer theme. */
export function convertThemeConfig(siteTheme = {}, format = 'square', dimensions = {}) {
  const mode = siteTheme.mode === 'light' ? 'light' : 'dark';
  const fallbackBackground = mode === 'light' ? '#FFFFFF' : DEFAULT_THEME.background;
  const background = parseColor(siteTheme.background || siteTheme.surface || fallbackBackground, fallbackBackground);
  const primary = parseColor(siteTheme.primary || siteTheme.primaryColor, DEFAULT_THEME.primary);
  const secondary = parseColor(siteTheme.secondary || siteTheme.secondaryColor, DEFAULT_THEME.secondary);
  const accent = parseColor(siteTheme.accent || siteTheme.accentColor, DEFAULT_THEME.accent);
  const specifiedForeground = siteTheme.foreground || siteTheme.text || siteTheme.textColor;
  const contrastForeground = relativeLuminance(background) > 0.42 ? '#0B0D10' : '#FFFFFF';
  const requestedForeground = specifiedForeground
    ? parseColor(specifiedForeground, contrastForeground)
    : contrastForeground;
  const foreground = contrastRatio(background, requestedForeground) >= 4.5
    ? requestedForeground
    : contrastForeground;
  const fontFamily = typeof siteTheme.fontFamily === 'string'
    && /^[\w\s,\-'".]{1,80}$/.test(siteTheme.fontFamily)
    ? siteTheme.fontFamily
    : 'sans-serif';

  return {
    primary, secondary, accent, background, foreground, mode, fontFamily,
    transparent: siteTheme.transparent === true,
    ...resolveDimensions(format, dimensions),
  };
}
