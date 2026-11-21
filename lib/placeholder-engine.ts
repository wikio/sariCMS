/**
 * Moteur partagé de génération d'images et de logos personnalisés (SVG serveur + HTML5 Canvas).
 *
 * Remplace avantageusement les services tiers (`via.placeholder.com`) par un
 * générateur hébergé sur l'URL de la vitrine (`/api/placeholder/...`) et un
 * atelier Canvas interactif haute résolution.
 *
 * Aucune dépendance externe : fonctionne à l'identique côté Node.js (route API
 * SVG) et côté navigateur (rendu HTML5 Canvas 1x/2x/3x, export PNG/WebP/SVG).
 */

export type GradientDir = 'none' | 'horizontal' | 'vertical' | 'diagonal' | 'radial';
export type PatternKind = 'none' | 'dots' | 'grid' | 'diagonal' | 'waves' | 'rings' | 'mesh';
export type FontKind = 'sans' | 'geometric' | 'serif' | 'mono' | 'display';
export type IconPosition = 'left' | 'top' | 'right' | 'only' | 'badge';

export interface VectorIconDef {
  id: string;
  label: string;
  category: 'medical' | 'business' | 'tech' | 'general';
  /** Chemins SVG dans un viewBox 0 0 24 24 (stroke-based, style Lucide). */
  paths: readonly string[];
}

export const PLACEHOLDER_ICONS: readonly VectorIconDef[] = [
  // Médical & Santé
  {
    id: 'heart-pulse',
    label: 'Cœur / Médical',
    category: 'medical',
    paths: [
      'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
      'M3.22 12H9.5l1.5-3 2 6 1.5-3h6.28',
    ],
  },
  {
    id: 'stethoscope',
    label: 'Stéthoscope',
    category: 'medical',
    paths: [
      'M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3',
      'M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4',
      'M22 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    ],
  },
  {
    id: 'shield-plus',
    label: 'Bouclier Santé',
    category: 'medical',
    paths: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      'M9 12h6',
      'M12 9v6',
    ],
  },
  {
    id: 'pill',
    label: 'Pharma / Gélule',
    category: 'medical',
    paths: [
      'm10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z',
      'm8.5 8.5 7 7',
    ],
  },
  {
    id: 'microscope',
    label: 'Laboratoire',
    category: 'medical',
    paths: [
      'M6 18h8',
      'M3 22h18',
      'M14 22a7 7 0 1 0 0-14h-1',
      'M9 14h2',
      'M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z',
      'M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3',
    ],
  },
  {
    id: 'activity',
    label: 'Monitoring',
    category: 'medical',
    paths: ['M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'],
  },
  {
    id: 'cross',
    label: 'Croix Médicale',
    category: 'medical',
    paths: ['M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z'],
  },

  // Business & Industrie
  {
    id: 'building',
    label: 'Entreprise',
    category: 'business',
    paths: [
      'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
      'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
      'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
      'M10 6h4',
      'M10 10h4',
      'M10 14h4',
      'M10 18h4',
    ],
  },
  {
    id: 'briefcase',
    label: 'Partenaire / Pro',
    category: 'business',
    paths: [
      'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
      'M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Z',
    ],
  },
  {
    id: 'award',
    label: 'Certification',
    category: 'business',
    paths: [
      'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
      'M8.21 13.89 7 23l5-3 5 3-1.21-9.12',
    ],
  },
  {
    id: 'check-badge',
    label: 'Qualité Vérifiée',
    category: 'business',
    paths: [
      'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z',
      'm9 12 2 2 4-4',
    ],
  },
  {
    id: 'chart',
    label: 'Croissance',
    category: 'business',
    paths: [
      'M3 3v18h18',
      'm19 9-5 5-4-4-3 3',
    ],
  },
  {
    id: 'box',
    label: 'Produit / Stock',
    category: 'business',
    paths: [
      'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
      'm3.3 7 8.7 5 8.7-5',
      'M12 22V12',
    ],
  },
  {
    id: 'truck',
    label: 'Logistique',
    category: 'business',
    paths: [
      'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2',
      'M15 18H9',
      'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14',
      'M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
      'M19 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    ],
  },

  // Tech & Innovation
  {
    id: 'cpu',
    label: 'Technologie',
    category: 'tech',
    paths: [
      'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z',
      'M9 9h6v6H9z',
      'M15 2v2',
      'M15 20v2',
      'M2 15h2',
      'M2 9h2',
      'M20 15h2',
      'M20 9h2',
      'M9 2v2',
      'M9 20v2',
    ],
  },
  {
    id: 'globe',
    label: 'International',
    category: 'tech',
    paths: [
      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
      'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20',
      'M2 12h20',
    ],
  },
  {
    id: 'layers',
    label: 'Plateforme',
    category: 'tech',
    paths: [
      'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
      'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
      'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
    ],
  },
  {
    id: 'zap',
    label: 'Énergie / Rapide',
    category: 'tech',
    paths: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  },
  {
    id: 'lock',
    label: 'Sécurité',
    category: 'tech',
    paths: [
      'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z',
      'M7 11V7a5 5 0 0 1 10 0v4',
    ],
  },
  {
    id: 'rocket',
    label: 'Innovation',
    category: 'tech',
    paths: [
      'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z',
      'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
      'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0',
      'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
    ],
  },
  {
    id: 'wrench',
    label: 'Maintenance',
    category: 'tech',
    paths: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  },

  // Général
  {
    id: 'sparkles',
    label: 'Premium / Éclat',
    category: 'general',
    paths: [
      'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
      'M20 3v4',
      'M22 5h-4',
    ],
  },
  {
    id: 'star',
    label: 'Étoile',
    category: 'general',
    paths: ['M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'],
  },
  {
    id: 'compass',
    label: 'Boussole / Guide',
    category: 'general',
    paths: [
      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
      'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z',
    ],
  },
  {
    id: 'calendar',
    label: 'Événement',
    category: 'general',
    paths: [
      'M8 2v4',
      'M16 2v4',
      'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z',
      'M3 10h18',
    ],
  },
  {
    id: 'users',
    label: 'Équipe / Communauté',
    category: 'general',
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
  },
  {
    id: 'leaf',
    label: 'Éco / Nature',
    category: 'general',
    paths: [
      'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
      'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
    ],
  },
  {
    id: 'flame',
    label: 'Énergie / Feu',
    category: 'general',
    paths: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  },
];

export const PLACEHOLDER_ICON_MAP = new Map<string, VectorIconDef>(
  PLACEHOLDER_ICONS.map((icon) => [icon.id, icon]),
);

export interface PlaceholderPaletteItem {
  name: string;
  bg: string;
  bg2?: string;
  fg: string;
}

export interface PlaceholderSizePreset {
  name: string;
  width: number;
  height: number;
  category?: string;
}

export interface PlaceholderConfig {
  enabled: boolean;
  /** URL publique de la vitrine (ex. https://sarisysteme.com). Vide = origine courante. */
  baseUrl: string;
  defaultWidth: number;
  defaultHeight: number;
  maxWidth: number;
  maxHeight: number;
  defaultBg: string;
  defaultBg2: string;
  defaultFg: string;
  defaultGradient: GradientDir;
  defaultPattern: PatternKind;
  defaultFont: FontKind;
  defaultRadius: number;
  defaultIcon: string;
  defaultText: string;
  cacheMaxAge: number;
  allowExternalReferer: boolean;
  palette: PlaceholderPaletteItem[];
  sizePresets: PlaceholderSizePreset[];
}

export const DEFAULT_PLACEHOLDER_CONFIG: PlaceholderConfig = {
  enabled: true,
  baseUrl: '',
  defaultWidth: 400,
  defaultHeight: 240,
  maxWidth: 2400,
  maxHeight: 2400,
  defaultBg: '#169EC9',
  defaultBg2: '#0D5C82',
  defaultFg: '#FFFFFF',
  defaultGradient: 'none',
  defaultPattern: 'none',
  defaultFont: 'sans',
  defaultRadius: 0,
  defaultIcon: 'none',
  defaultText: 'SARI',
  cacheMaxAge: 86400,
  allowExternalReferer: true,
  palette: [
    { name: 'SARI Bleu', bg: '#169EC9', bg2: '#0B5F86', fg: '#FFFFFF' },
    { name: 'SARI Lime', bg: '#C6DA34', bg2: '#8FA81B', fg: '#1F2937' },
    { name: 'SARI Or', bg: '#EAB616', bg2: '#C78A08', fg: '#1F2937' },
    { name: 'SARI Nuit', bg: '#1B2A4A', bg2: '#0F172A', fg: '#FFFFFF' },
    { name: 'Médical Émeraude', bg: '#0F766E', bg2: '#115E59', fg: '#FFFFFF' },
    { name: 'Ardoise Pro', bg: '#334155', bg2: '#1E293B', fg: '#FFFFFF' },
    { name: 'Corail Santé', bg: '#E11D48', bg2: '#9F1239', fg: '#FFFFFF' },
    { name: 'Clair Minimal', bg: '#F1F5F9', bg2: '#E2E8F0', fg: '#0F172A' },
  ],
  sizePresets: [
    { name: 'Logo Partenaire', width: 150, height: 80, category: 'logo' },
    { name: 'Logo HD', width: 400, height: 200, category: 'logo' },
    { name: 'Icône Carrée', width: 512, height: 512, category: 'logo' },
    { name: 'Avatar', width: 256, height: 256, category: 'logo' },
    { name: 'Carte Produit', width: 800, height: 600, category: 'web' },
    { name: 'Open Graph / Partage', width: 1200, height: 630, category: 'social' },
    { name: 'Bannière Hero', width: 1600, height: 500, category: 'web' },
    { name: 'Post Social', width: 1080, height: 1080, category: 'social' },
  ],
};

export interface PlaceholderSpec {
  width: number;
  height: number;
  bg: string;
  bg2: string;
  gradientDir: GradientDir;
  fg: string;
  accent: string;
  text: string;
  sub: string;
  badge: string;
  font: FontKind;
  weight: number;
  fontSize: number; // 0 = auto
  letterSpacing: number;
  uppercase: boolean;
  icon: string;
  iconPos: IconPosition;
  iconSize: number; // 0 = auto
  iconBg: boolean;
  pattern: PatternKind;
  radius: number;
  border: number;
  borderColor: string;
  shadow: boolean;
  showDims: boolean;
}

const VALID_GRADIENTS: readonly GradientDir[] = ['none', 'horizontal', 'vertical', 'diagonal', 'radial'];
const VALID_PATTERNS: readonly PatternKind[] = ['none', 'dots', 'grid', 'diagonal', 'waves', 'rings', 'mesh'];
const VALID_FONTS: readonly FontKind[] = ['sans', 'geometric', 'serif', 'mono', 'display'];
const VALID_ICON_POS: readonly IconPosition[] = ['left', 'top', 'right', 'only', 'badge'];

export function sanitizeHex(raw: unknown, fallback: string): string {
  const s = String(raw || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return `#${s}`.toUpperCase();
  }
  return fallback;
}

export function stripHash(hex: string): string {
  return sanitizeHex(hex, '#169EC9').replace(/^#/, '');
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = sanitizeHex(hex, '#169EC9').slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Choisit automatiquement blanc ou ardoise foncée selon la luminance WCAG. */
export function pickContrastColor(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1F2937' : '#FFFFFF';
}

export function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

export function fontFamilyStack(font: FontKind): string {
  switch (font) {
    case 'geometric':
      return '"Plus Jakarta Sans", "Montserrat", "Avenir Next", "Segoe UI", system-ui, sans-serif';
    case 'serif':
      return 'Georgia, "Times New Roman", "Cambria", serif';
    case 'mono':
      return 'ui-monospace, "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace';
    case 'display':
      return '"Trebuchet MS", "Arial Black", "Impact", system-ui, sans-serif';
    case 'sans':
    default:
      return 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  }
}

export function sanitizePlaceholderConfig(raw: unknown): PlaceholderConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const maxWidth = clampNum(obj.maxWidth, 200, 4096, DEFAULT_PLACEHOLDER_CONFIG.maxWidth);
  const maxHeight = clampNum(obj.maxHeight, 200, 4096, DEFAULT_PLACEHOLDER_CONFIG.maxHeight);
  const defaultWidth = clampNum(obj.defaultWidth, 32, maxWidth, DEFAULT_PLACEHOLDER_CONFIG.defaultWidth);
  const defaultHeight = clampNum(obj.defaultHeight, 32, maxHeight, DEFAULT_PLACEHOLDER_CONFIG.defaultHeight);

  const rawBase = typeof obj.baseUrl === 'string' ? obj.baseUrl.trim().replace(/\/+$/, '') : '';
  const baseUrl = /^https?:\/\/[^/\s]+/i.test(rawBase) ? rawBase.slice(0, 200) : '';

  const palette = Array.isArray(obj.palette)
    ? obj.palette
        .slice(0, 24)
        .map((item) => {
          const p = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          const bg = sanitizeHex(p.bg, '#169EC9');
          return {
            name: String(p.name || bg).trim().slice(0, 40) || bg,
            bg,
            bg2: p.bg2 ? sanitizeHex(p.bg2, bg) : undefined,
            fg: sanitizeHex(p.fg, pickContrastColor(bg)),
          };
        })
    : DEFAULT_PLACEHOLDER_CONFIG.palette;

  const sizePresets = Array.isArray(obj.sizePresets)
    ? obj.sizePresets
        .slice(0, 24)
        .map((item) => {
          const s = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            name: String(s.name || 'Format').trim().slice(0, 48) || 'Format',
            width: clampNum(s.width, 32, maxWidth, 400),
            height: clampNum(s.height, 32, maxHeight, 240),
            category: typeof s.category === 'string' ? s.category.slice(0, 24) : 'web',
          };
        })
    : DEFAULT_PLACEHOLDER_CONFIG.sizePresets;

  const defaultBg = sanitizeHex(obj.defaultBg, DEFAULT_PLACEHOLDER_CONFIG.defaultBg);
  const defaultBg2 = sanitizeHex(obj.defaultBg2, DEFAULT_PLACEHOLDER_CONFIG.defaultBg2);
  const defaultFg = sanitizeHex(obj.defaultFg, DEFAULT_PLACEHOLDER_CONFIG.defaultFg);
  const defaultIconStr = String(obj.defaultIcon || 'none').trim().toLowerCase();

  return {
    enabled: obj.enabled !== undefined ? Boolean(obj.enabled) : DEFAULT_PLACEHOLDER_CONFIG.enabled,
    baseUrl,
    defaultWidth,
    defaultHeight,
    maxWidth,
    maxHeight,
    defaultBg,
    defaultBg2,
    defaultFg,
    defaultGradient: VALID_GRADIENTS.includes(obj.defaultGradient as GradientDir)
      ? (obj.defaultGradient as GradientDir)
      : DEFAULT_PLACEHOLDER_CONFIG.defaultGradient,
    defaultPattern: VALID_PATTERNS.includes(obj.defaultPattern as PatternKind)
      ? (obj.defaultPattern as PatternKind)
      : DEFAULT_PLACEHOLDER_CONFIG.defaultPattern,
    defaultFont: VALID_FONTS.includes(obj.defaultFont as FontKind)
      ? (obj.defaultFont as FontKind)
      : DEFAULT_PLACEHOLDER_CONFIG.defaultFont,
    defaultRadius: clampNum(obj.defaultRadius, 0, 200, DEFAULT_PLACEHOLDER_CONFIG.defaultRadius),
    defaultIcon: defaultIconStr === 'none' || PLACEHOLDER_ICON_MAP.has(defaultIconStr) ? defaultIconStr : 'none',
    defaultText: String(obj.defaultText ?? DEFAULT_PLACEHOLDER_CONFIG.defaultText).slice(0, 80),
    cacheMaxAge: clampNum(obj.cacheMaxAge, 0, 31_536_000, DEFAULT_PLACEHOLDER_CONFIG.cacheMaxAge),
    allowExternalReferer:
      obj.allowExternalReferer !== undefined
        ? Boolean(obj.allowExternalReferer)
        : DEFAULT_PLACEHOLDER_CONFIG.allowExternalReferer,
    palette: palette.length ? palette : DEFAULT_PLACEHOLDER_CONFIG.palette,
    sizePresets: sizePresets.length ? sizePresets : DEFAULT_PLACEHOLDER_CONFIG.sizePresets,
  };
}

/** Décode un segment de taille (`150x80`, `300`, `150x80.svg`). */
export function parseSizeSegment(
  seg: string | undefined,
  maxW: number,
  maxH: number,
): { width: number; height: number } | null {
  if (!seg) return null;
  const clean = seg.replace(/\.(svg|png|webp|jpg|jpeg)$/i, '').trim();
  const rect = /^(\d{1,6})[xX×](\d{1,6})$/.exec(clean);
  if (rect) {
    return {
      width: clampNum(rect[1], 32, maxW, 400),
      height: clampNum(rect[2], 32, maxH, 240),
    };
  }
  const sq = /^(\d{1,6})$/.exec(clean);
  if (sq) {
    const n = clampNum(sq[1], 32, Math.min(maxW, maxH), 300);
    return { width: n, height: n };
  }
  return null;
}

/**
 * Construit un `PlaceholderSpec` complet depuis les segments d'URL + paramètres query
 * en appliquant les valeurs par défaut configurées dans l'administration.
 *
 * Exemples supportés :
 *   /api/placeholder/150x80/169EC9/FFFFFF?text=SURGICARE
 *   /api/placeholder/300x120/169EC9/FFFFFF?text=SURGICARE&icon=heart-pulse&bg2=0D5C82&pattern=dots&radius=12
 *   /api/placeholder/300
 *   /api/placeholder?w=600&h=300&bg=169EC9&fg=FFFFFF&text=SARI
 */
export function parsePlaceholderRequest(
  segments: string[],
  searchParams: URLSearchParams,
  config: PlaceholderConfig = DEFAULT_PLACEHOLDER_CONFIG,
): PlaceholderSpec {
  const cleanedSegs = segments.map((s) => decodeURIComponent(s).trim()).filter(Boolean);

  let width = config.defaultWidth;
  let height = config.defaultHeight;
  let bg = config.defaultBg;
  let fgExplicit = false;
  let fg = config.defaultFg;

  // Segment 0 : taille (`150x80` ou `300`)
  const parsedSize = parseSizeSegment(cleanedSegs[0], config.maxWidth, config.maxHeight);
  let colorStartIdx = 0;
  if (parsedSize) {
    width = parsedSize.width;
    height = parsedSize.height;
    colorStartIdx = 1;
  }

  // Segment couleur fond (ex. `169EC9`)
  const segBg = cleanedSegs[colorStartIdx]?.replace(/\.(svg|png|webp)$/i, '');
  if (segBg && /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(segBg)) {
    bg = sanitizeHex(segBg, bg);
    const segFg = cleanedSegs[colorStartIdx + 1]?.replace(/\.(svg|png|webp)$/i, '');
    if (segFg && /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(segFg)) {
      fg = sanitizeHex(segFg, fg);
      fgExplicit = true;
    } else {
      fg = pickContrastColor(bg);
    }
  }

  // Surcharges par query params (`w`, `h`, `bg`, `bg2`, `fg`, etc.)
  if (searchParams.has('w')) width = clampNum(searchParams.get('w'), 32, config.maxWidth, width);
  if (searchParams.has('h')) height = clampNum(searchParams.get('h'), 32, config.maxHeight, height);
  if (searchParams.has('bg')) {
    bg = sanitizeHex(searchParams.get('bg'), bg);
    if (!fgExplicit && !searchParams.has('fg')) fg = pickContrastColor(bg);
  }
  if (searchParams.has('fg')) {
    fg = sanitizeHex(searchParams.get('fg'), fg);
  }

  const hasBg2 = searchParams.has('bg2') && Boolean(searchParams.get('bg2')?.trim());
  const bg2 = hasBg2 ? sanitizeHex(searchParams.get('bg2'), config.defaultBg2) : config.defaultBg2;

  const rawGrad = (searchParams.get('grad') || searchParams.get('gradient') || '').trim().toLowerCase();
  const gradientDir: GradientDir = VALID_GRADIENTS.includes(rawGrad as GradientDir)
    ? (rawGrad as GradientDir)
    : hasBg2
      ? 'diagonal'
      : config.defaultGradient;

  const accent = searchParams.has('accent') ? sanitizeHex(searchParams.get('accent'), fg) : fg;

  // Texte principal (compatibilité `text` — les `+` sont déjà décodés en espace par URLSearchParams)
  const hasTextParam = searchParams.has('text') || searchParams.has('title');
  const rawText = hasTextParam
    ? String(searchParams.get('text') ?? searchParams.get('title') ?? '')
    : config.defaultText || `${width} × ${height}`;
  const text = rawText.replace(/\\n/g, '\n').slice(0, 140);
  const sub = String(searchParams.get('sub') || searchParams.get('subtitle') || '').slice(0, 120);
  const badge = String(searchParams.get('badge') || '').trim().slice(0, 32);

  const rawFont = (searchParams.get('font') || '').trim().toLowerCase();
  const font: FontKind = VALID_FONTS.includes(rawFont as FontKind) ? (rawFont as FontKind) : config.defaultFont;
  const weight = clampNum(searchParams.get('weight'), 300, 900, 700);
  const fontSize = clampNum(searchParams.get('fs') ?? searchParams.get('fontSize'), 0, 300, 0);
  const letterSpacing = clampNum(searchParams.get('ls') ?? searchParams.get('letterSpacing'), 0, 20, 0);
  const uppercase = searchParams.get('upper') === '1' || searchParams.get('uppercase') === 'true';

  const rawIcon = (searchParams.get('icon') ?? config.defaultIcon ?? 'none').trim().toLowerCase();
  const icon = rawIcon === 'none' || !rawIcon ? 'none' : PLACEHOLDER_ICON_MAP.has(rawIcon) ? rawIcon : 'none';
  const rawIconPos = (searchParams.get('iconPos') || 'left').trim().toLowerCase();
  const iconPos: IconPosition = VALID_ICON_POS.includes(rawIconPos as IconPosition)
    ? (rawIconPos as IconPosition)
    : 'left';
  const iconSize = clampNum(searchParams.get('iconSize'), 0, 400, 0);
  const iconBg = searchParams.get('iconBg') === '1' || searchParams.get('iconBg') === 'true';

  const rawPattern = (searchParams.get('pattern') || '').trim().toLowerCase();
  const pattern: PatternKind = VALID_PATTERNS.includes(rawPattern as PatternKind)
    ? (rawPattern as PatternKind)
    : config.defaultPattern;

  const radius = clampNum(searchParams.get('radius') ?? searchParams.get('r'), 0, Math.min(width, height) / 2, config.defaultRadius);
  const border = clampNum(searchParams.get('border'), 0, 24, 0);
  const borderColor = searchParams.has('borderColor') ? sanitizeHex(searchParams.get('borderColor'), fg) : fg;
  const shadow = searchParams.get('shadow') === '1' || searchParams.get('shadow') === 'true';
  const showDims = searchParams.get('dims') === '1' || searchParams.get('showDims') === 'true';

  return {
    width,
    height,
    bg,
    bg2,
    gradientDir,
    fg,
    accent,
    text,
    sub,
    badge,
    font,
    weight,
    fontSize,
    letterSpacing,
    uppercase,
    icon,
    iconPos,
    iconSize,
    iconBg,
    pattern,
    radius,
    border,
    borderColor,
    shadow,
    showDims,
  };
}

/** Construit le chemin relatif propre `/api/placeholder/150x80/169EC9/FFFFFF?text=...`. */
export function buildPlaceholderPath(spec: PlaceholderSpec): string {
  const size = `${Math.round(spec.width)}x${Math.round(spec.height)}`;
  const bg = stripHash(spec.bg);
  const fg = stripHash(spec.fg);
  const qs = new URLSearchParams();

  if (spec.text !== '') qs.set('text', spec.text.replace(/\n/g, '\\n'));
  if (spec.sub) qs.set('sub', spec.sub);
  if (spec.badge) qs.set('badge', spec.badge);
  if (spec.gradientDir && spec.gradientDir !== 'none') {
    qs.set('grad', spec.gradientDir);
    qs.set('bg2', stripHash(spec.bg2));
  }
  if (spec.accent && stripHash(spec.accent) !== fg) qs.set('accent', stripHash(spec.accent));
  if (spec.icon && spec.icon !== 'none') {
    qs.set('icon', spec.icon);
    if (spec.iconPos !== 'left') qs.set('iconPos', spec.iconPos);
    if (spec.iconSize > 0) qs.set('iconSize', String(Math.round(spec.iconSize)));
    if (spec.iconBg) qs.set('iconBg', '1');
  }
  if (spec.pattern && spec.pattern !== 'none') qs.set('pattern', spec.pattern);
  if (spec.font && spec.font !== 'sans') qs.set('font', spec.font);
  if (spec.weight && spec.weight !== 700) qs.set('weight', String(spec.weight));
  if (spec.fontSize > 0) qs.set('fs', String(Math.round(spec.fontSize)));
  if (spec.letterSpacing > 0) qs.set('ls', String(spec.letterSpacing));
  if (spec.uppercase) qs.set('upper', '1');
  if (spec.radius > 0) qs.set('radius', String(Math.round(spec.radius)));
  if (spec.border > 0) {
    qs.set('border', String(spec.border));
    if (stripHash(spec.borderColor) !== fg) qs.set('borderColor', stripHash(spec.borderColor));
  }
  if (spec.shadow) qs.set('shadow', '1');
  if (spec.showDims) qs.set('dims', '1');

  const query = qs.toString();
  return `/api/placeholder/${size}/${bg}/${fg}${query ? `?${query}` : ''}`;
}

export function buildPlaceholderUrl(spec: PlaceholderSpec, origin?: string): string {
  const rel = buildPlaceholderPath(spec);
  const cleanOrigin = String(origin || '').trim().replace(/\/+$/, '');
  return cleanOrigin ? `${cleanOrigin}${rel}` : rel;
}

function escapeXml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ComputedLayout {
  lines: string[];
  titleSize: number;
  subSize: number;
  lineHeight: number;
  hasIcon: boolean;
  iconBoxSize: number;
  iconInnerSize: number;
  iconX: number;
  iconY: number;
  textAnchor: 'middle' | 'start' | 'end';
  textX: number;
  textStartY: number;
  subY: number;
  showText: boolean;
}

/** Calcule le placement équilibré icône + titre + sous-titre (partagé SVG & Canvas). */
function computeLayout(spec: PlaceholderSpec): ComputedLayout {
  const W = spec.width;
  const H = spec.height;
  const minDim = Math.min(W, H);
  const padX = Math.max(10, W * 0.08);
  const padY = Math.max(8, H * 0.1);
  const usableW = Math.max(20, W - padX * 2);
  const usableH = Math.max(20, H - padY * 2);

  const hasIcon = spec.icon !== 'none' && PLACEHOLDER_ICON_MAP.has(spec.icon);
  const showText = !(hasIcon && spec.iconPos === 'only');

  const rawText = (spec.uppercase ? spec.text.toUpperCase() : spec.text).trim();
  const lines = showText && rawText ? rawText.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4) : [];
  const longestChars = lines.reduce((m, l) => Math.max(m, l.length), 0);

  // Taille de l'icône
  let iconBoxSize = 0;
  if (hasIcon) {
    if (spec.iconSize > 0) {
      iconBoxSize = Math.min(spec.iconSize, usableH * 0.85, usableW * 0.85);
    } else if (spec.iconPos === 'only') {
      iconBoxSize = Math.max(20, minDim * 0.48);
    } else if (spec.iconPos === 'top') {
      iconBoxSize = Math.max(18, Math.min(usableH * 0.36, usableW * 0.28, 96));
    } else if (spec.iconPos === 'badge') {
      iconBoxSize = Math.max(16, Math.min(minDim * 0.24, 52));
    } else {
      iconBoxSize = Math.max(18, Math.min(usableH * 0.48, usableW * 0.24, 84));
    }
  }
  const iconInnerSize = spec.iconBg ? iconBoxSize * 0.56 : iconBoxSize;
  const gap = hasIcon && lines.length > 0 ? Math.max(8, Math.min(24, minDim * 0.09)) : 0;

  // Espace disponible pour le texte
  const textMaxW =
    hasIcon && (spec.iconPos === 'left' || spec.iconPos === 'right')
      ? Math.max(24, usableW - iconBoxSize - gap)
      : usableW;
  const textMaxH =
    hasIcon && spec.iconPos === 'top' ? Math.max(20, usableH - iconBoxSize - gap) : usableH;

  // Calcul auto de la taille de police pour ne jamais déborder
  let titleSize = spec.fontSize > 0 ? spec.fontSize : Math.max(11, Math.min(textMaxH * (lines.length > 1 ? 0.34 : 0.48), W * 0.14, 92));
  if (spec.fontSize <= 0 && longestChars > 0) {
    const charWidthFactor = spec.font === 'mono' ? 0.64 : spec.uppercase ? 0.66 : 0.58;
    const widthFit = textMaxW / (longestChars * charWidthFactor + Math.max(0, longestChars - 1) * (spec.letterSpacing / Math.max(12, titleSize)));
    titleSize = Math.max(10, Math.min(titleSize, widthFit));
  }
  if (spec.sub && spec.fontSize <= 0) {
    titleSize = Math.min(titleSize, textMaxH * 0.42);
  }
  titleSize = Math.round(Math.max(9, titleSize));

  const subSize = spec.sub ? Math.round(Math.max(8, Math.min(titleSize * 0.48, textMaxH * 0.2, 28))) : 0;
  const lineHeight = titleSize * 1.18;
  const textBlockH =
    lines.length * lineHeight + (spec.sub ? subSize * 1.45 : 0);

  let iconX = W / 2 - iconBoxSize / 2;
  let iconY = H / 2 - iconBoxSize / 2;
  let textAnchor: 'middle' | 'start' | 'end' = 'middle';
  let textX = W / 2;
  let textStartY = H / 2 - textBlockH / 2 + titleSize * 0.85;

  if (hasIcon && spec.iconPos === 'only') {
    iconX = W / 2 - iconBoxSize / 2;
    iconY = H / 2 - iconBoxSize / 2;
  } else if (hasIcon && spec.iconPos === 'top') {
    const totalH = iconBoxSize + gap + textBlockH;
    const topY = H / 2 - totalH / 2;
    iconX = W / 2 - iconBoxSize / 2;
    iconY = topY;
    textAnchor = 'middle';
    textX = W / 2;
    textStartY = topY + iconBoxSize + gap + titleSize * 0.85;
  } else if (hasIcon && (spec.iconPos === 'left' || spec.iconPos === 'right') && lines.length > 0) {
    const estTextW = Math.min(
      textMaxW,
      Math.max(
        longestChars * titleSize * (spec.uppercase ? 0.63 : 0.56) + Math.max(0, longestChars - 1) * spec.letterSpacing,
        spec.sub ? spec.sub.length * subSize * 0.54 : 0,
      ),
    );
    const totalW = iconBoxSize + gap + estTextW;
    const startX = W / 2 - totalW / 2;
    if (spec.iconPos === 'left') {
      iconX = startX;
      iconY = H / 2 - iconBoxSize / 2;
      textAnchor = 'start';
      textX = startX + iconBoxSize + gap;
    } else {
      iconX = startX + estTextW + gap;
      iconY = H / 2 - iconBoxSize / 2;
      textAnchor = 'end';
      textX = startX + estTextW;
    }
    textStartY = H / 2 - textBlockH / 2 + titleSize * 0.85;
  } else if (hasIcon && spec.iconPos === 'badge') {
    iconX = padX;
    iconY = padY;
    textAnchor = 'middle';
    textX = W / 2;
    textStartY = H / 2 - textBlockH / 2 + titleSize * 0.85;
  }

  const subY = textStartY + (lines.length - 1) * lineHeight + subSize * 1.45;

  return {
    lines,
    titleSize,
    subSize,
    lineHeight,
    hasIcon,
    iconBoxSize,
    iconInnerSize,
    iconX,
    iconY,
    textAnchor,
    textX,
    textStartY,
    subY,
    showText,
  };
}

function svgGradientDef(spec: PlaceholderSpec): { def: string; fill: string } {
  if (spec.gradientDir === 'none') {
    return { def: '', fill: spec.bg };
  }
  if (spec.gradientDir === 'radial') {
    return {
      def: `<radialGradient id="bgGrad" cx="30%" cy="25%" r="85%"><stop offset="0%" stop-color="${spec.bg}"/><stop offset="100%" stop-color="${spec.bg2}"/></radialGradient>`,
      fill: 'url(#bgGrad)',
    };
  }
  const coords =
    spec.gradientDir === 'horizontal'
      ? 'x1="0%" y1="0%" x2="100%" y2="0%"'
      : spec.gradientDir === 'vertical'
        ? 'x1="0%" y1="0%" x2="0%" y2="100%"'
        : 'x1="0%" y1="0%" x2="100%" y2="100%"';
  return {
    def: `<linearGradient id="bgGrad" ${coords}><stop offset="0%" stop-color="${spec.bg}"/><stop offset="100%" stop-color="${spec.bg2}"/></linearGradient>`,
    fill: 'url(#bgGrad)',
  };
}

function svgPatternDef(spec: PlaceholderSpec): { def: string; layer: string } {
  const color = spec.fg;
  switch (spec.pattern) {
    case 'dots':
      return {
        def: `<pattern id="pat" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="${color}" fill-opacity="0.14"/></pattern>`,
        layer: `<rect width="${spec.width}" height="${spec.height}" fill="url(#pat)"/>`,
      };
    case 'grid':
      return {
        def: `<pattern id="pat" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="${color}" stroke-opacity="0.11" stroke-width="1"/></pattern>`,
        layer: `<rect width="${spec.width}" height="${spec.height}" fill="url(#pat)"/>`,
      };
    case 'diagonal':
      return {
        def: `<pattern id="pat" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="16" stroke="${color}" stroke-opacity="0.11" stroke-width="2"/></pattern>`,
        layer: `<rect width="${spec.width}" height="${spec.height}" fill="url(#pat)"/>`,
      };
    case 'waves':
      return {
        def: `<pattern id="pat" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 Q12 2 24 12 T48 12" fill="none" stroke="${color}" stroke-opacity="0.12" stroke-width="1.5"/></pattern>`,
        layer: `<rect width="${spec.width}" height="${spec.height}" fill="url(#pat)"/>`,
      };
    case 'rings': {
      const cx = Math.round(spec.width * 0.85);
      const cy = Math.round(spec.height * 0.18);
      const maxR = Math.round(Math.max(spec.width, spec.height) * 0.8);
      const circles = [0.22, 0.42, 0.65, 0.9]
        .map((k) => `<circle cx="${cx}" cy="${cy}" r="${Math.round(maxR * k)}" fill="none" stroke="${color}" stroke-opacity="0.1" stroke-width="1.5"/>`)
        .join('');
      return { def: '', layer: `<g>${circles}</g>` };
    }
    case 'mesh': {
      const r1 = Math.round(Math.max(spec.width, spec.height) * 0.55);
      return {
        def: `<radialGradient id="meshA" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${color}" stop-opacity="0.18"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
        layer: `<g><circle cx="${Math.round(spec.width * 0.15)}" cy="${Math.round(spec.height * 0.15)}" r="${r1}" fill="url(#meshA)"/><circle cx="${Math.round(spec.width * 0.88)}" cy="${Math.round(spec.height * 0.85)}" r="${Math.round(r1 * 0.85)}" fill="url(#meshA)"/></g>`,
      };
    }
    case 'none':
    default:
      return { def: '', layer: '' };
  }
}

/** Génère un SVG vectoriel autonome, propre et sûr (XSS-safe). */
export function renderPlaceholderSvg(spec: PlaceholderSpec): string {
  const W = spec.width;
  const H = spec.height;
  const layout = computeLayout(spec);
  const grad = svgGradientDef(spec);
  const pat = svgPatternDef(spec);
  const r = Math.min(spec.radius, Math.min(W, H) / 2);
  const clipDef = r > 0 ? `<clipPath id="clip"><rect x="0" y="0" width="${W}" height="${H}" rx="${r}" ry="${r}"/></clipPath>` : '';
  const shadowDef = spec.shadow
    ? `<filter id="sh" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.28"/></filter>`
    : '';
  const filterAttr = spec.shadow ? ' filter="url(#sh)"' : '';
  const fontStack = escapeXml(fontFamilyStack(spec.font));

  // Icône vectorielle
  let iconLayer = '';
  if (layout.hasIcon) {
    const def = PLACEHOLDER_ICON_MAP.get(spec.icon)!;
    const scale = layout.iconInnerSize / 24;
    const innerX = layout.iconX + (layout.iconBoxSize - layout.iconInnerSize) / 2;
    const innerY = layout.iconY + (layout.iconBoxSize - layout.iconInnerSize) / 2;
    const bgRect = spec.iconBg
      ? `<rect x="${layout.iconX.toFixed(1)}" y="${layout.iconY.toFixed(1)}" width="${layout.iconBoxSize.toFixed(1)}" height="${layout.iconBoxSize.toFixed(1)}" rx="${Math.round(layout.iconBoxSize * 0.24)}" fill="${spec.fg}" fill-opacity="0.16" stroke="${spec.fg}" stroke-opacity="0.28" stroke-width="1"/>`
      : '';
    const paths = def.paths
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="${spec.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
      .join('');
    iconLayer = `<g${filterAttr}>${bgRect}<g transform="translate(${innerX.toFixed(1)}, ${innerY.toFixed(1)}) scale(${scale.toFixed(4)})">${paths}</g></g>`;
  }

  // Titre + sous-titre
  let textLayer = '';
  if (layout.showText && (layout.lines.length > 0 || spec.sub)) {
    const rtl = isArabicText(spec.text) || isArabicText(spec.sub);
    const dirAttr = rtl ? ' direction="rtl" unicode-bidi="plaintext"' : '';
    const lsAttr = spec.letterSpacing > 0 ? ` letter-spacing="${spec.letterSpacing}"` : '';
    const titleElems = layout.lines
      .map((line, idx) => {
        const y = layout.textStartY + idx * layout.lineHeight;
        return `<text x="${layout.textX.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${layout.textAnchor}" fill="${spec.fg}" font-family="${fontStack}" font-size="${layout.titleSize}" font-weight="${spec.weight}"${lsAttr}${dirAttr}>${escapeXml(line)}</text>`;
      })
      .join('');
    const subElem = spec.sub
      ? `<text x="${layout.textX.toFixed(1)}" y="${layout.subY.toFixed(1)}" text-anchor="${layout.textAnchor}" fill="${spec.fg}" fill-opacity="0.82" font-family="${fontStack}" font-size="${layout.subSize}" font-weight="500"${dirAttr}>${escapeXml(spec.sub)}</text>`
      : '';
    textLayer = `<g${filterAttr}>${titleElems}${subElem}</g>`;
  }

  // Badge d'angle (ex. PRO, NEW, ISO)
  let badgeLayer = '';
  if (spec.badge) {
    const bFont = Math.max(9, Math.min(13, Math.round(Math.min(W, H) * 0.085)));
    const bPadX = Math.round(bFont * 0.85);
    const bW = Math.round(spec.badge.length * bFont * 0.64 + bPadX * 2);
    const bH = Math.round(bFont * 1.9);
    const bX = W - bW - Math.max(8, Math.round(W * 0.04));
    const bY = Math.max(8, Math.round(H * 0.06));
    badgeLayer =
      `<g>` +
      `<rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="${Math.round(bH / 2)}" fill="${spec.fg}" fill-opacity="0.18" stroke="${spec.fg}" stroke-opacity="0.35" stroke-width="1"/>` +
      `<text x="${(bX + bW / 2).toFixed(1)}" y="${(bY + bH / 2 + bFont * 0.35).toFixed(1)}" text-anchor="middle" fill="${spec.fg}" font-family="${fontStack}" font-size="${bFont}" font-weight="700" letter-spacing="0.6">${escapeXml(spec.badge.toUpperCase())}</text>` +
      `</g>`;
  }

  // Filigrane dimensions optionnel
  let dimsLayer = '';
  if (spec.showDims) {
    const dFont = Math.max(9, Math.min(12, Math.round(Math.min(W, H) * 0.065)));
    dimsLayer = `<text x="${(W - 10).toFixed(0)}" y="${(H - 8).toFixed(0)}" text-anchor="end" fill="${spec.fg}" fill-opacity="0.55" font-family="ui-monospace, monospace" font-size="${dFont}" font-weight="600">${W} × ${H}</text>`;
  }

  // Bordure intérieure
  const borderLayer =
    spec.border > 0
      ? `<rect x="${(spec.border / 2).toFixed(1)}" y="${(spec.border / 2).toFixed(1)}" width="${(W - spec.border).toFixed(1)}" height="${(H - spec.border).toFixed(1)}" rx="${Math.max(0, r - spec.border / 2).toFixed(1)}" ry="${Math.max(0, r - spec.border / 2).toFixed(1)}" fill="none" stroke="${spec.borderColor}" stroke-width="${spec.border}"/>`
      : '';

  const defs = [grad.def, pat.def, clipDef, shadowDef].filter(Boolean).join('');
  const clipAttr = r > 0 ? ' clip-path="url(#clip)"' : '';
  const aria = escapeXml(spec.text || `${W}x${H}`);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">` +
    `<title>${aria}</title>` +
    (defs ? `<defs>${defs}</defs>` : '') +
    `<g${clipAttr}>` +
    `<rect width="${W}" height="${H}" fill="${grad.fill}"/>` +
    pat.layer +
    iconLayer +
    textLayer +
    badgeLayer +
    dimsLayer +
    `</g>` +
    borderLayer +
    `</svg>`
  );
}

export interface CanvasRenderOptions {
  /** Facteur de densité Retina (1, 2 ou 3). */
  scale?: number;
  /** Image/logo personnalisé superposé sur le canvas (fonctionnalité exclusive Canvas). */
  overlayImage?: HTMLImageElement | null;
  overlayMode?: 'icon' | 'cover' | 'watermark';
  overlayOpacity?: number;
  overlayScale?: number;
  /** Afficher un quadrillage discret d'aide au centrage (aperçu uniquement). */
  showGuides?: boolean;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Rendu natif HTML5 Canvas haute résolution (1x/2x/3x) pour l'atelier de création.
 * Offre un aperçu instantané à 60 FPS + superposition d'image/logo + export PNG/WebP.
 */
export function renderPlaceholderToCanvas(
  canvas: HTMLCanvasElement,
  spec: PlaceholderSpec,
  opts: CanvasRenderOptions = {},
): void {
  const scale = Math.max(1, Math.min(4, opts.scale || 1));
  const W = spec.width;
  const H = spec.height;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, W, H);

  const r = Math.min(spec.radius, Math.min(W, H) / 2);
  ctx.save();
  if (r > 0) {
    drawRoundedRectPath(ctx, 0, 0, W, H, r);
    ctx.clip();
  }

  // 1. Fond uni ou dégradé
  if (spec.gradientDir === 'none') {
    ctx.fillStyle = spec.bg;
  } else if (spec.gradientDir === 'radial') {
    const g = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
    g.addColorStop(0, spec.bg);
    g.addColorStop(1, spec.bg2);
    ctx.fillStyle = g;
  } else {
    const [x1, y1] =
      spec.gradientDir === 'horizontal'
        ? [W, 0]
        : spec.gradientDir === 'vertical'
          ? [0, H]
          : [W, H];
    const g = ctx.createLinearGradient(0, 0, x1, y1);
    g.addColorStop(0, spec.bg);
    g.addColorStop(1, spec.bg2);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, W, H);

  // 2. Image de fond / filigrane Canvas si présente
  if (opts.overlayImage && (opts.overlayMode === 'cover' || opts.overlayMode === 'watermark')) {
    const img = opts.overlayImage;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, opts.overlayOpacity ?? (opts.overlayMode === 'cover' ? 0.35 : 0.18)));
    if (opts.overlayMode === 'cover') {
      const ratio = Math.max(W / img.width, H / img.height) * (opts.overlayScale || 1);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const maxDim = Math.min(W, H) * 0.55 * (opts.overlayScale || 1);
      const ratio = Math.min(maxDim / img.width, maxDim / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    ctx.restore();
  }

  // 3. Motifs géométriques
  const [fgR, fgG, fgB] = hexToRgb(spec.fg);
  if (spec.pattern === 'dots') {
    ctx.fillStyle = `rgba(${fgR},${fgG},${fgB},0.14)`;
    for (let y = 3; y < H; y += 18) {
      for (let x = 3; x < W; x += 18) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (spec.pattern === 'grid') {
    ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.11)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 24) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  } else if (spec.pattern === 'diagonal') {
    ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.11)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = -H; i < W + H; i += 20) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
    }
    ctx.stroke();
  } else if (spec.pattern === 'waves') {
    ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.12)`;
    ctx.lineWidth = 1.5;
    for (let y = 12; y < H + 24; y += 24) {
      ctx.beginPath();
      for (let x = 0; x <= W + 48; x += 48) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 12, y - 10, x + 24, y);
        ctx.quadraticCurveTo(x + 36, y + 10, x + 48, y);
      }
      ctx.stroke();
    }
  } else if (spec.pattern === 'rings') {
    ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.11)`;
    ctx.lineWidth = 1.5;
    const cx = W * 0.85;
    const cy = H * 0.18;
    const maxR = Math.max(W, H) * 0.8;
    for (const k of [0.22, 0.42, 0.65, 0.9]) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (spec.pattern === 'mesh') {
    const r1 = Math.max(W, H) * 0.55;
    const g1 = ctx.createRadialGradient(W * 0.15, H * 0.15, 0, W * 0.15, H * 0.15, r1);
    g1.addColorStop(0, `rgba(${fgR},${fgG},${fgB},0.18)`);
    g1.addColorStop(1, `rgba(${fgR},${fgG},${fgB},0)`);
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.88, H * 0.85, 0, W * 0.88, H * 0.85, r1 * 0.85);
    g2.addColorStop(0, `rgba(${fgR},${fgG},${fgB},0.16)`);
    g2.addColorStop(1, `rgba(${fgR},${fgG},${fgB},0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }

  const layout = computeLayout(spec);

  const applyShadow = () => {
    if (spec.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  };

  // 4. Icône vectorielle OU logo importé en mode 'icon'
  const hasCustomIcon = Boolean(opts.overlayImage && opts.overlayMode === 'icon');
  if (layout.hasIcon || hasCustomIcon) {
    ctx.save();
    applyShadow();
    if (spec.iconBg && layout.iconBoxSize > 0) {
      drawRoundedRectPath(
        ctx,
        layout.iconX,
        layout.iconY,
        layout.iconBoxSize,
        layout.iconBoxSize,
        layout.iconBoxSize * 0.24,
      );
      ctx.fillStyle = `rgba(${fgR},${fgG},${fgB},0.16)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.28)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (hasCustomIcon && opts.overlayImage) {
      const box = layout.iconBoxSize > 0 ? layout.iconInnerSize : Math.min(W, H) * 0.42;
      const cx = layout.iconBoxSize > 0 ? layout.iconX + layout.iconBoxSize / 2 : W / 2;
      const cy = layout.iconBoxSize > 0 ? layout.iconY + layout.iconBoxSize / 2 : H / 2;
      const ratio = Math.min(box / opts.overlayImage.width, box / opts.overlayImage.height) * (opts.overlayScale || 1);
      const dw = opts.overlayImage.width * ratio;
      const dh = opts.overlayImage.height * ratio;
      ctx.globalAlpha = Math.max(0.1, Math.min(1, opts.overlayOpacity ?? 1));
      ctx.drawImage(opts.overlayImage, cx - dw / 2, cy - dh / 2, dw, dh);
    } else if (layout.hasIcon) {
      const def = PLACEHOLDER_ICON_MAP.get(spec.icon)!;
      const sc = layout.iconInnerSize / 24;
      const innerX = layout.iconX + (layout.iconBoxSize - layout.iconInnerSize) / 2;
      const innerY = layout.iconY + (layout.iconBoxSize - layout.iconInnerSize) / 2;
      ctx.translate(innerX, innerY);
      ctx.scale(sc, sc);
      ctx.strokeStyle = spec.accent;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const d of def.paths) {
        if (typeof Path2D !== 'undefined') {
          ctx.stroke(new Path2D(d));
        }
      }
    }
    ctx.restore();
  }

  // 5. Titre + sous-titre
  if (layout.showText && (layout.lines.length > 0 || spec.sub)) {
    ctx.save();
    applyShadow();
    const stack = fontFamilyStack(spec.font);
    const rtl = isArabicText(spec.text) || isArabicText(spec.sub);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = layout.textAnchor === 'middle' ? 'center' : layout.textAnchor === 'start' ? 'left' : 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = spec.fg;
    ctx.font = `${spec.weight} ${layout.titleSize}px ${stack}`;

    const drawTextWithSpacing = (txt: string, x: number, y: number, spacing: number) => {
      if (spacing <= 0 || rtl) {
        ctx.fillText(txt, x, y);
        return;
      }
      const chars = Array.from(txt);
      const widths = chars.map((c) => ctx.measureText(c).width);
      const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
      let cursor =
        ctx.textAlign === 'center' ? x - total / 2 : ctx.textAlign === 'right' ? x - total : x;
      const prevAlign = ctx.textAlign;
      ctx.textAlign = 'left';
      for (let i = 0; i < chars.length; i += 1) {
        ctx.fillText(chars[i], cursor, y);
        cursor += widths[i] + spacing;
      }
      ctx.textAlign = prevAlign;
    };

    layout.lines.forEach((line, idx) => {
      drawTextWithSpacing(line, layout.textX, layout.textStartY + idx * layout.lineHeight, spec.letterSpacing);
    });

    if (spec.sub) {
      ctx.fillStyle = `rgba(${fgR},${fgG},${fgB},0.82)`;
      ctx.font = `500 ${layout.subSize}px ${stack}`;
      ctx.fillText(spec.sub, layout.textX, layout.subY);
    }
    ctx.restore();
  }

  // 6. Badge d'angle
  if (spec.badge) {
    ctx.save();
    const stack = fontFamilyStack(spec.font);
    const bFont = Math.max(9, Math.min(13, Math.round(Math.min(W, H) * 0.085)));
    const label = spec.badge.toUpperCase();
    ctx.font = `700 ${bFont}px ${stack}`;
    const bPadX = Math.round(bFont * 0.85);
    const bW = Math.round(ctx.measureText(label).width + bPadX * 2);
    const bH = Math.round(bFont * 1.9);
    const bX = W - bW - Math.max(8, Math.round(W * 0.04));
    const bY = Math.max(8, Math.round(H * 0.06));
    drawRoundedRectPath(ctx, bX, bY, bW, bH, bH / 2);
    ctx.fillStyle = `rgba(${fgR},${fgG},${fgB},0.18)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.35)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = spec.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bX + bW / 2, bY + bH / 2 + 0.5);
    ctx.restore();
  }

  // 7. Dimensions optionnelles
  if (spec.showDims) {
    ctx.save();
    const dFont = Math.max(9, Math.min(12, Math.round(Math.min(W, H) * 0.065)));
    ctx.fillStyle = `rgba(${fgR},${fgG},${fgB},0.55)`;
    ctx.font = `600 ${dFont}px ui-monospace, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${W} × ${H}`, W - 10, H - 8);
    ctx.restore();
  }

  // 8. Repères d'alignement (aperçu studio uniquement)
  if (opts.showGuides) {
    ctx.save();
    ctx.strokeStyle = `rgba(${fgR},${fgG},${fgB},0.3)`;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.strokeRect(W * 0.08, H * 0.1, W * 0.84, H * 0.8);
    ctx.restore();
  }

  ctx.restore(); // fin clip

  // 9. Bordure extérieure
  if (spec.border > 0) {
    ctx.save();
    drawRoundedRectPath(
      ctx,
      spec.border / 2,
      spec.border / 2,
      W - spec.border,
      H - spec.border,
      Math.max(0, r - spec.border / 2),
    );
    ctx.strokeStyle = spec.borderColor;
    ctx.lineWidth = spec.border;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
