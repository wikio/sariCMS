// lib/colors.ts
/**
 * Résolution des couleurs stockées en base (module Solutions, etc.).
 *
 * En base on peut trouver :
 *   - un jeton de la charte    : "sari-blue", "sari-lime", "sari-dark"…
 *   - un jeton Tailwind        : "red-500", "purple-500", "cyan-500"…
 *   - une couleur CSS brute    : "#1e40af", "#fff", "rgb(20 30 40)", "hsl(…)"
 *
 * Les pages vitrine ne peuvent PAS composer de classes Tailwind à la volée
 * (`bg-${color}` est purgé au build) ni utiliser `var(--red-500)` : ces
 * variables n'existent pas. On convertit donc systématiquement le jeton en
 * couleur CSS réelle, avec un helper d'opacité utilisable en style inline.
 */

/** Palette maison (doit rester synchronisée avec tailwind.config.ts). */
export const BRAND_COLORS: Record<string, string> = {
  'sari-blue': '#169EC9',
  'sari-lime': '#C6DA34',
  'sari-yellow': '#EAB616',
  'sari-gray': '#EEEEEE',
  'sari-dark': '#333333',
};

/** Jetons Tailwind courants proposés par le sélecteur de couleur de l'admin. */
export const TAILWIND_COLORS: Record<string, string> = {
  'slate-500': '#64748b',
  'gray-500': '#6b7280',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'orange-500': '#f97316',
  'amber-500': '#f59e0b',
  'yellow-500': '#eab308',
  'lime-500': '#84cc16',
  'green-500': '#22c55e',
  'emerald-500': '#10b981',
  'teal-500': '#14b8a6',
  'cyan-500': '#06b6d4',
  'sky-500': '#0ea5e9',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-800': '#1e40af',
  'indigo-500': '#6366f1',
  'violet-500': '#8b5cf6',
  'purple-500': '#a855f7',
  'fuchsia-500': '#d946ef',
  'pink-500': '#ec4899',
  'rose-500': '#f43f5e',
};

export const COLOR_TOKENS: Record<string, string> = { ...TAILWIND_COLORS, ...BRAND_COLORS };

/** Couleur par défaut lorsque la fiche n'en définit aucune. */
export const DEFAULT_COLOR_TOKEN = 'sari-blue';
export const DEFAULT_COLOR = BRAND_COLORS['sari-blue'];

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_FN_RE = /^(rgb|rgba|hsl|hsla|color|oklch|lab)\(/i;

/**
 * Convertit une valeur stockée en couleur CSS exploitable.
 * Retourne toujours une couleur valide (fallback charte).
 */
export function resolveColor(token?: string | null, fallback: string = DEFAULT_COLOR): string {
  const raw = String(token ?? '').trim();
  if (!raw) return fallback;

  // Jeton connu (charte ou Tailwind)
  const known = COLOR_TOKENS[raw] || COLOR_TOKENS[raw.toLowerCase()];
  if (known) return known;

  // Couleur CSS déjà écrite en dur
  if (HEX_RE.test(raw)) return raw;
  if (CSS_FN_RE.test(raw)) return raw;

  // "bg-red-500" / "text-red-500" → "red-500"
  const stripped = raw.replace(/^(bg|text|border|from|to|via)-/, '');
  if (stripped !== raw) {
    const strippedKnown = COLOR_TOKENS[stripped] || COLOR_TOKENS[stripped.toLowerCase()];
    if (strippedKnown) return strippedKnown;
  }

  // Nom de couleur CSS natif ("teal", "tomato"…)
  if (/^[a-z]+$/i.test(raw)) return raw;

  return fallback;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function expandHex(hex: string): string | null {
  const value = hex.replace('#', '');
  if (value.length === 3 || value.length === 4) {
    return value
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (value.length === 6 || value.length === 8) return value.slice(0, 6);
  return null;
}

/**
 * Retourne la couleur avec un canal alpha — utilisable en style inline.
 * `withAlpha('sari-blue', 0.1)` → "rgba(22, 158, 201, 0.1)"
 */
export function withAlpha(token?: string | null, alpha = 1, fallback: string = DEFAULT_COLOR): string {
  const color = resolveColor(token, fallback);
  const a = clamp01(alpha);
  if (a >= 1) return color;

  if (HEX_RE.test(color)) {
    const hex = expandHex(color);
    if (hex) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  // rgb()/hsl()/nom natif → on délègue à color-mix (supporté par tous les navigateurs modernes)
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
}

/**
 * Choisit un texte lisible (clair ou foncé) sur un fond donné.
 * Utile pour les blocs CTA dont la couleur vient de la base.
 */
export function readableTextOn(token?: string | null, light = '#ffffff', dark = '#111827'): string {
  const color = resolveColor(token);
  if (!HEX_RE.test(color)) return light;
  const hex = expandHex(color);
  if (!hex) return light;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.55 ? dark : light;
}

/** Liste utilisée par le sélecteur de couleur de l'admin. */
export const COLOR_PRESETS: Array<{ name: string; value: string }> = [
  ...Object.entries(BRAND_COLORS).map(([name, value]) => ({ name, value })),
  ...Object.entries(TAILWIND_COLORS).map(([name, value]) => ({ name, value })),
];
