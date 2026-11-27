export const SOCIAL_FORMATS = Object.freeze({
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1200, height: 630 },
  widescreen: { width: 1600, height: 900 },
  story: { width: 1080, height: 1920 },
});

export const SOCIAL_STYLE_PRESETS = Object.freeze({
  'modular-grid': { grid: true, pixelAccents: true, fullBleed: false, gridOpacity: 0.065, gridColor: 'foreground' },
  'editorial-grid': { grid: true, pixelAccents: false, fullBleed: false, gridOpacity: 0.045, gridColor: 'secondary' },
  'blueprint-grid': { grid: true, pixelAccents: false, fullBleed: false, gridOpacity: 0.12, gridColor: 'secondary' },
  press: { grid: false, pixelAccents: false, fullBleed: true, gradientOverlay: true },
  'rassd-news': { grid: false, pixelAccents: false, fullBleed: true, gradientOverlay: true },
  'press-grid': { grid: true, pixelAccents: false, fullBleed: true, gradientOverlay: true, gridOverlay: true, gridOpacity: 0.035, gridColor: 'foreground' },
});

export const DEFAULT_THEME = Object.freeze({
  primary: 'rgb(15, 159, 110)',
  secondary: 'rgb(22, 158, 201)',
  accent: 'rgb(234, 182, 22)',
  background: '#0B0D10',
  foreground: '#FFFFFF',
  mode: 'dark',
  style: 'modular-grid',
  direction: 'ltr',
  fontFamily: 'sans-serif',
  transparent: false,
});

// Templates contain layout/visibility choices only; rendering remains content-agnostic.
export const TEMPLATES_CONFIG = Object.freeze({
  article: {
    label: 'Article', image: true, topic: true, title: true, summary: true,
    date: true, location: true, qr: true, networks: true, accent: 'primary',
  },
  event: {
    label: 'Événement', image: true, topic: true, title: true, summary: true,
    date: true, location: true, qr: true, networks: true, accent: 'secondary',
    emphasize: ['date', 'location'],
  },
  product: {
    label: 'Produit', image: true, topic: true, title: true, summary: true,
    date: false, location: false, qr: true, networks: true, accent: 'accent',
  },
  announcement: {
    label: 'Annonce', image: true, topic: true, title: true, summary: true,
    date: true, location: false, qr: true, networks: true, accent: 'accent',
  },
  job: {
    label: 'Offre d’emploi', image: true, topic: true, title: true, summary: true,
    date: true, location: true, qr: true, networks: true, accent: 'primary',
    emphasize: ['location', 'date'],
  },
  default: {
    label: 'Contenu', image: true, topic: true, title: true, summary: true,
    date: true, location: true, qr: true, networks: true, accent: 'primary',
  },
});

export const KIND_ALIASES = Object.freeze({
  news: 'article', articles: 'article', event: 'event', events: 'event',
  products: 'product', announcements: 'announcement', careers: 'job', jobs: 'job',
});

export function resolveSocialTemplate(kind) {
  const normalized = String(kind || 'default').trim().toLowerCase();
  const canonical = KIND_ALIASES[normalized] || normalized;
  return { kind: canonical, template: TEMPLATES_CONFIG[canonical] || TEMPLATES_CONFIG.default };
}
