/**
 * lib/canvas/document.ts — les règles de l'atelier, sans Fabric et sans DOM.
 *
 * Tout ce qui ici se décide sur des nombres et des chaînes — une position
 * d'alignement, un dégradé, une entrée d'historique, une zone de gabarit — est écrit
 * à part du moteur Fabric pour une raison précise : c'est la partie qui doit rester
 * exacte. Un alignement mal arrondi se voit à l'écran, un historique mal borné coûte
 * un navigateur, et une couleur mal convertie se retrouve sur le visuel publié.
 *
 * Le moteur (`engine.ts`) ne fait qu'appliquer ce que ce module calcule.
 */

import type { ChartSpec, ColorStop, GradientSpec, SlotValue } from '@/lib/canvas/types';

/** Les formats de plan de travail proposés à l'ouverture. */
export const ARTBOARDS = [
  { id: 'post-carre', label: 'Post carré', width: 1080, height: 1080, hint: 'Réseaux' },
  { id: 'story', label: 'Story', width: 1080, height: 1920, hint: 'Vertical' },
  { id: 'banniere', label: 'Bannière web', width: 1600, height: 640, hint: 'Large' },
  { id: 'banniere-728', label: 'Bandeau 728', width: 728, height: 90, hint: 'Display' },
  { id: 'affiche-a4', label: 'Affiche A4', width: 2480, height: 3508, hint: '300 ppp' },
  { id: 'affiche-a3', label: 'Affiche A3', width: 3508, height: 4961, hint: '300 ppp' },
  { id: 'carte-visite', label: 'Carte de visite', width: 1050, height: 600, hint: '90 × 50 mm' },
] as const;

/** Un plan de travail ne se laisse pas exploser : au-delà, l'export sature la mémoire. */
export const MAX_ARTBOARD_SIDE = 6000;
export const MIN_ARTBOARD_SIDE = 64;

/** Une échelle d'export : ce que « hi-res ×2/×3 » veut dire, et sa borne haute. */
export const EXPORT_SCALES = [1, 2, 3, 4] as const;

/** Le nombre d'allers-retours gardés — au-delà, la mémoire et le coût d'un `toJSON` non plus. */
export const HISTORY_LIMIT = 60;

/** Deux modifications portant le même nom dans ce délai ne font qu'une entrée. */
export const HISTORY_COALESCE_MS = 700;

/** Les polices chargées à l'ouverture : les seules garanties d'être là au premier rendu. */
export const DEFAULT_FONT_STACK = [
  { family: 'Inter', weights: [400, 600, 700] },
  { family: 'Playfair Display', weights: [400, 700] },
  { family: 'Poppins', weights: [400, 600] },
] as const;

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Un côté de plan de travail, borné et entier — un canvas aux côtés fractionnaires rend mal. */
export function sanitizeSide(value: number) {
  return Math.round(clamp(Number(value) || MIN_ARTBOARD_SIDE, MIN_ARTBOARD_SIDE, MAX_ARTBOARD_SIDE));
}

/* --------------------------------------------------------------------- couleurs */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*[\d.]+%?\s*[\s,]+[\d.]+%?\s*[\s,]+[\d.]+%?\s*(?:[,\s/]+[\d.]+%?\s*)?\)$/i;
const HSL = /^hsla?\(/i;
const NAMED = /^[a-z]+$/i;

/**
 * Une couleur CSS exploitable par Fabric.
 *
 * `#rgb` est développé, `#rrggbbaa` est rendu en `rgba()` — Fabric 6 lit les deux,
 * mais l'export SVG, lui, ne garde que la forme longue et un canal alpha en hexadécimal
 * y passerait pour une chaîne invalide sur certains navigateurs. Une valeur non reconnue
 * (un `var(--x)`, un mot-clé exotique) est rejetée : mieux vaut une couleur vide
 * qu'un texte noir involontaire.
 */
export function normalizeColor(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (HEX.test(raw)) {
    const hex = raw.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split('');
      const full = `${r}${r}${g}${g}${b}${b}`;
      return a && a !== 'f' ? `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${parseInt(a + a, 16) / 255})` : `#${full.toLowerCase()}`;
    }
    return `#${hex.slice(0, 6).toLowerCase()}`;
  }
  if (RGB.test(raw) || HSL.test(raw)) return raw.replace(/\s+/g, ' ');
  if (NAMED.test(raw)) return raw.toLowerCase();
  return null;
}

export function isColorLike(value: unknown) {
  return normalizeColor(value) !== null;
}

/**
 * Un dégradé est-il une valeur exploitable telle quelle ?
 *
 * Le prédicat de type n'est pas un ornement : `GradientSpec` est relu du disque et
 * d'un champ de formulaire, et tout ce qui en découle (coordonnées, angle, bornes)
 * suppose au moins deux arrêts. Un seul arrêt ne rend rien dans Fabric, et un objet
 * sans `stops` est une chaîne saisie à la main — mieux vaut le savoir ici qu'au
 * moment où l'export tombe en panne.
 */
export function isGradientLike(value: unknown): value is GradientSpec & { stops: ColorStop[] } {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as GradientSpec).stops) && (value as GradientSpec).stops.length >= 2);
}

/**
 * Le dégradé d'Fabric, construit depuis notre description.
 *
 * Les coordonnées sont relatives à la boîte englobante de l'objet (`gradientUnits:
 * 'percentage'`), ce qui est ce qu'on veut dans un éditeur : déplacer ou redimensionner
 * l'objet ne doit pas décrocher le dégradé de sa forme.
 */
export function gradientToFabric(input: GradientSpec | null | undefined) {
  if (!isGradientLike(input)) return null;
  const gradient = input as GradientSpec & { stops: ColorStop[] };
  const stops: ColorStop[] = gradient.stops.map((stop) => ({
    offset: clamp(Math.round(Number(stop.offset) || 0), 0, 100),
    color: normalizeColor(stop.color) || '#000000',
  }));
  const type = gradient.type === 'radial' ? 'radial' : 'linear';
  return {
    type,
    // `gradientUnits: 'percentage'` est ce qui rend le dégradé solidaire de la boîte
    // de l'objet : déplacer ou redimensionner ne le décroche pas.
    gradientUnits: 'percentage',
    coords:
      type === 'radial'
        ? {
            x1: clamp(gradient.radialX ?? 50, 0, 100) / 100,
            y1: clamp(gradient.radialY ?? 50, 0, 100) / 100,
            r1: 0,
            x2: clamp(gradient.radialX ?? 50, 0, 100) / 100,
            y2: clamp(gradient.radialY ?? 50, 0, 100) / 100,
            r2: clamp(gradient.radialR ?? 70, 1, 150) / 100,
          }
        : {
            x1: angleToX(gradient.angle ?? 90),
            y1: angleToY(gradient.angle ?? 90),
            x2: angleToX(gradient.angle ?? 90 + 180),
            y2: angleToY(gradient.angle ?? 90 + 180),
          },
    colorStops: stops,
  };
}

/** L'angle d'un dégradé linéaire en points de départ/arrivée (unités relatives). */
function angleToX(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return 0.5 - Math.cos(rad) / 2;
}
function angleToY(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return 0.5 - Math.sin(rad) / 2;
}

/** L'inverse : un gradient Fabric relu du disque, ramené à notre description. */
export function fabricGradientToSpec(gradient: unknown): GradientSpec | null {
  if (!gradient || typeof gradient !== 'object') return null;
  const raw = gradient as { type?: unknown; colorStops?: unknown; coords?: Record<string, unknown> };
  if (!Array.isArray(raw.colorStops)) return null;
  const stops: ColorStop[] = raw.colorStops.map((entry) => {
    const stop = (entry || {}) as { offset?: unknown; color?: unknown };
    return { offset: clamp(Math.round((Number(stop.offset) || 0) * 100), 0, 100), color: normalizeColor(stop.color) || '#000000' };
  });
  const coords = raw.coords || {};
  const type = raw.type === 'radial' ? 'radial' : 'linear';
  if (type === 'radial') {
    return {
      type,
      stops,
      radialX: Math.round((Number(coords.x1) || 0) * 100),
      radialY: Math.round((Number(coords.y1) || 0) * 100),
      radialR: Math.round((Number(coords.r2) || 0.7) * 100),
    };
  }
  const dx = (Number(coords.x2) || 1) - (Number(coords.x1) || 0);
  const dy = (Number(coords.y2) || 1) - (Number(coords.y1) || 0);
  return { type, stops, angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90) };
}

/** Une valeur de remplissage — couleur ou dégradé — prête pour le panneau latéral. */
export function describeFill(value: unknown): { color: string; gradient: GradientSpec | null } {
  const fromGradient = fabricGradientToSpec(value);
  if (fromGradient) return { color: fromGradient.stops[0]?.color || '#000000', gradient: fromGradient };
  return { color: normalizeColor(value) || '', gradient: null };
}

/* -------------------------------------------------------------------- géométrie */

export type AlignMode = 'gauche' | 'centre-h' | 'droite' | 'haut' | 'centre-v' | 'bas' | 'caler';

const ALIGN_LABELS: Record<AlignMode, string> = {
  gauche: 'Aligner à gauche',
  'centre-h': 'Centrer horizontalement',
  droite: 'Aligner à droite',
  'centre-v': 'Centrer verticalement',
  haut: 'Aligner en haut',
  bas: 'Aligner en bas',
  caler: 'Centrer sur le plan de travail',
};

export function alignLabel(mode: AlignMode) {
  return ALIGN_LABELS[mode];
}

/**
 * Les positions alignées d'une sélection.
 *
 * Calculees sur les boîtes englobantes réelles (ce que Fabric expose en `getBoundingRect`),
 * arrondies à l'entier : un objet posé à `x = 41.3331` rend flou sur un écran à densité 1,
 * et un alignement qui laisse un demi-pixel se voit immédiatement à l'écran.
 *
 * @param boxes les boîtes `{left, top, width, height}` des objets sélectionnés
 * @param frame la zone de référence (le plan de travail, ou la sélection si multi-objets)
 */
export function alignBoxes(
  mode: AlignMode,
  boxes: { left: number; top: number; width: number; height: number }[],
  frame: { left: number; top: number; width: number; height: number },
) {
  if (!boxes.length) return [];
  const reference = mode === 'caler' || boxes.length === 1 ? frame : unionOf(boxes);
  const targets = boxes.map((box, index) => {
    const position = { left: box.left, top: box.top };
    if (mode === 'gauche') position.left = reference.left;
    else if (mode === 'droite') position.left = reference.left + reference.width - box.width;
    else if (mode === 'centre-h' || mode === 'caler') position.left = reference.left + (reference.width - box.width) / 2;
    if (mode === 'haut') position.top = reference.top;
    else if (mode === 'bas') position.top = reference.top + reference.height - box.height;
    else if (mode === 'centre-v' || mode === 'caler') position.top = reference.top + (reference.height - box.height) / 2;
    return { index, left: Math.round(position.left), top: Math.round(position.top) };
  });
  return targets;
}

/** Répartir équitablement sur un axe, bords à bords compris dans la zone de référence. */
export function distributeBoxes(
  axis: 'x' | 'y',
  boxes: { left: number; top: number; width: number; height: number }[],
): { index: number; left: number; top: number }[] {
  if (boxes.length < 3) return [];
  const key = axis === 'x' ? 'left' : 'top';
  const size = axis === 'x' ? 'width' : 'height';
  const ordered = boxes.map((box, index) => ({ box, index })).sort((a, b) => a.box[key] - b.box[key]);
  const first = ordered[0].box;
  const last = ordered[ordered.length - 1].box;
  const span = last[key] + last[size] - first[key];
  const total = ordered.reduce((sum, entry) => sum + entry.box[size], 0);
  const gap = (span - total) / (ordered.length - 1);
  let cursor = first[key];
  return ordered.map((entry) => {
    const value = cursor;
    cursor += entry.box[size] + gap;
    const position = { index: entry.index, left: entry.box.left, top: entry.box.top };
    if (axis === 'x') position.left = Math.round(value);
    else position.top = Math.round(value);
    return position;
  });
}

export function unionOf(boxes: { left: number; top: number; width: number; height: number }[]) {
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return { left, top, width: right - left, height: bottom - top };
}

/** L'échelle qui fait tenir un contenu dans un cadre, sans le déformer. */
export function fitScale(source: { width: number; height: number }, frame: { width: number; height: number }, mode: 'contain' | 'cover' = 'contain') {
  if (!source.width || !source.height || !frame.width || !frame.height) return 1;
  const ratioX = frame.width / source.width;
  const ratioY = frame.height / source.height;
  const value = mode === 'cover' ? Math.max(ratioX, ratioY) : Math.min(ratioX, ratioY);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Un ratio lisible (`16:9`), pour l'affichage des presets de recadrage. */
export function ratioLabel(width: number, height: number) {
  if (!width || !height) return 'libre';
  const ratio = width / height;
  const candidates: [string, number][] = [['1:1', 1], ['4:5', 0.8], ['3:4', 0.75], ['9:16', 0.5625], ['16:9', 1.7778], ['3:2', 1.5], ['A4', 0.7071]];
  const best = candidates.reduce((acc, [label, value]) => (Math.abs(value - ratio) < Math.abs(acc[1] - ratio) ? [label, value] : acc), candidates[0]);
  return Math.abs(best[1] - ratio) < 0.06 ? best[0] : `${Math.round(ratio * 100) / 100}`;
}

/* --------------------------------------------------------------------- calques */

/**
 * La nouvelle position d'un calque.
 *
 * `haut`/`bas` = premier/dernier ; `avant`/`après` = un crant. Les indices sont
 * bornés : un panneau qui appelle « monter » sur le calque du dessus ne doit pas
 * faire tomber Fabric dans un `splice(-1, 1)`.
 */
export function moveIndex(from: number, to: number, count: number, mode: 'haut' | 'bas' | 'avant' | 'après') {
  const size = Math.max(count, 1);
  const current = clamp(from, 0, size - 1);
  const target = mode === 'haut' ? size - 1 : mode === 'bas' ? 0 : mode === 'avant' ? current + 1 : current - 1;
  return { from: current, to: clamp(target, 0, size - 1) };
}

/* -------------------------------------------------------------------- gabarits */

/**
 * Les zones modifiables d'un gabarit, résolues depuis son JSON.
 *
 * Un gabarit se décrit lui-même : chaque objet porteur d'un `slotId` devient une zone
 * du panneau « Propriétés du template ». On ne derive pas ces zones d'un tableau à
 * part, sinon la liste et le dessin dérivent l'un de l'autre dès qu'un objet est
 * renommé ou supprimé du JSON.
 *
 * Le champ `slotLabel` (posée par l'auteur du gabarit) sert de libellé ; à défaut,
 * c'est l'objet lui-même qui parle : le texte pour une zone de texte, le nom du champ
 * pour une image, la couleur pour un aplat.
 */
export function resolveSlots(template: unknown): { id: string; type: 'text' | 'image' | 'color'; label: string; current: string; maxLength?: number }[] {
  const objects = collectObjects(template);
  const slots: { id: string; type: 'text' | 'image' | 'color'; label: string; current: string; maxLength?: number }[] = [];
  for (const object of objects) {
    const id = String(object.slotId ?? object.id ?? '').trim();
    if (!id) continue;
    const type: 'text' | 'image' | 'color' = object.type === 'image' ? 'image' : typeof object.text === 'string' ? 'text' : 'color';
    const current =
      type === 'text' ? String(object.text ?? '') : type === 'image' ? String(object.src ?? '') : String(describeFill(object.fill).color || describeFill(object.stroke).color || '');
    slots.push({
      id,
      type,
      label: String(object.slotLabel || object.name || labelFromId(id)),
      current,
      maxLength: type === 'text' ? Math.max(8, String(object.text ?? '').length * 3) : undefined,
    });
  }
  return slots;
}

function labelFromId(id: string) {
  return id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Les objets d'un JSON Fabric, récursivement (les `group` et `activeSelection` en cachent souvent). */
export function collectObjects(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const entry of node) collectObjects(entry, out);
    return out;
  }
  const raw = node as Record<string, unknown>;
  if (raw.version || raw.type || raw.objects) out.push(raw);
  if (Array.isArray(raw.objects)) collectObjects(raw.objects, out);
  const canvas = raw.canvas as { objects?: unknown } | undefined;
  if (canvas && Array.isArray(canvas.objects)) collectObjects(canvas.objects, out);
  if (raw.clipPath) collectObjects(raw.clipPath, out);
  return out;
}

/** Le pointeur d'un objet du gabarit sur lequel appliquer une valeur de zone. */
export function slotPatch(id: string, type: 'text' | 'image' | 'color', value: SlotValue): Record<string, unknown> {
  if (type === 'text') return { slotId: id, text: String(value) };
  if (type === 'image') return { slotId: id, src: String(value) };
  return { slotId: id, fill: normalizeColor(value) || String(value) };
}

/* -------------------------------------------------------------------- graphiques */

/** Un jeu de données saisi en clair (« 12, 8, 20 » ou une ligne par catégorie). */
export function parseChartData(input: string): { label: string; value: number }[] {
  const lines = String(input || '')
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  const series = lines
    .map((line) => {
      const parts = line.split(/\s*[,|:\t]\s*/).filter((part) => part !== '');
      if (!parts.length) return null;
      const numeric = Number(String(parts[parts.length - 1]).replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(numeric)) return null;
      const label = parts.length > 1 ? parts.slice(0, -1).join(' ') : `Série ${lines.indexOf(line) + 1}`;
      return { label, value: numeric };
    })
    .filter(Boolean) as { label: string; value: number }[];
  if (series.length) return series.slice(0, 24);
  const numbers = String(input || '')
    .split(/[\s,;]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  return numbers.slice(0, 24).map((value, index) => ({ label: `#${index + 1}`, value }));
}

/** Une palette de dégradé pour les séries : lisible sur fond clair comme sur fond sombre. */
export const CHART_PALETTES: Record<string, string[]> = {
  lime: ['#a3e635', '#4d7c0f', '#166534', '#052e16'],
  ocean: ['#38bdf8', '#0ea5e9', '#0369a1', '#082f49'],
  sunset: ['#fb7185', '#f97316', '#facc15', '#7c2d12'],
  ink: ['#e2e8f0', '#94a3b8', '#475569', '#0f172a'],
};

/** Les bornes d'un jeu de données, prêtes pour l'échelle (les négatifs descendent sous zéro). */
export function chartDomain(spec: Pick<ChartSpec, 'series' | 'type'>) {
  const values = spec.series.map((point) => Number(point.value) || 0);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  return { min, max, span: max - min || 1 };
}

/** Une valeur en pourcentage de l'échelle, bornée à la boîte du graphique. */
export function chartRatio(value: number, domain: { min: number; max: number; span: number }) {
  return clamp((value - domain.min) / domain.span, 0, 1);
}

/**
 * Le SVG d'un graphique, en coordonnées absolues sur le cadre demandé.
 *
 * Une barre, une courbe, un secteur — trois géométries, mais un seul principe : le
 * SVG est écrit à la main, avec des `<path>` nommés et un dégradé par série. C'est ce
 * qui permet à l'objet importé de rester **éditable** (chaque barre est une forme
 * autonome, le dégradé se règle) au lieu d'être une image collée.
 */
export function buildChartSvg(spec: ChartSpec, frame: { width: number; height: number }): string {
  const width = Math.max(80, Math.round(frame.width));
  const height = Math.max(60, Math.round(frame.height));
  const palette: string[] = (spec.palette ? CHART_PALETTES[spec.palette] : undefined) ?? CHART_PALETTES.lime;
  const domain = chartDomain(spec);
  const pad = { top: 28, right: 20, bottom: 40, left: 44 };
  const plot = { x: pad.left, y: pad.top, width: Math.max(40, width - pad.left - pad.right), height: Math.max(40, height - pad.top - pad.bottom) };
  const grid = spec.showGrid !== false;
  const axis = 'rgba(148,163,184,0.35)';
  const label = spec.textColor || '#e2e8f0';
  const defs: string[] = [];
  const body: string[] = [];

  palette.forEach((color, index) => {
    defs.push(
      `<linearGradient id="sari-c${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset="1" stop-color="${color}" stop-opacity="0.45"/></linearGradient>`,
    );
  });

  const push = (name: string, markup: string) => body.push(`<g name="${name}">${markup}</g>`);

  if (grid) {
    const lines: string[] = [];
    for (let step = 0; step <= 4; step++) {
      const y = Math.round(plot.y + (plot.height * step) / 4);
      lines.push(`<line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.width}" y2="${y}" stroke="${axis}" stroke-width="1"/>`);
      const value = domain.max - (domain.span * step) / 4;
      lines.push(
        `<text x="${plot.x - 8}" y="${y + 4}" text-anchor="end" font-family="Inter, sans-serif" font-size="11" fill="${label}">${formatTick(value)}</text>`,
      );
    }
    push('grille', lines.join(''));
  }

  if (spec.type === 'pie') {
    const total = spec.series.reduce((sum, point) => sum + Math.abs(Number(point.value) || 0), 0) || 1;
    const radius = Math.min(plot.width, plot.height) / 2;
    const center = { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 };
    let angle = -Math.PI / 2;
    const arcs = spec.series.map((point, index) => {
      const sweep = (Math.abs(Number(point.value) || 0) / total) * Math.PI * 2;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const x1 = center.x + radius * Math.cos(start);
      const y1 = center.y + radius * Math.sin(start);
      const x2 = center.x + radius * Math.cos(end);
      const y2 = center.y + radius * Math.sin(end);
      const large = sweep > Math.PI ? 1 : 0;
      const color = palette[index % palette.length];
      const mid = (start + end) / 2;
      const legendX = center.x + (radius + 16) * Math.cos(mid);
      const legendY = center.y + (radius + 16) * Math.sin(mid);
      return (
        `<path name="secteur-${slugName(point.label)}" d="M ${center.x} ${center.y} L ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${large} 1 ${round(x2)} ${round(y2)} Z" fill="${color}" fill-opacity="0.88"/>` +
        `<text x="${round(legendX)}" y="${round(legendY)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="${label}">${escapeXml(point.label)} ${Math.round(((Number(point.value) || 0) / total) * 100)}%</text>`
      );
    });
    push('secteurs', arcs.join(''));
    if (spec.innerRadius && spec.innerRadius > 0) {
      body.push(`<circle name="trou" cx="${round(center.x)}" cy="${round(center.y)}" r="${round(radius * clamp(spec.innerRadius, 0.1, 0.9))}" fill="${spec.backgroundColor || '#0f172a'}"/>`);
    }
  } else {
    const count = Math.max(1, spec.series.length);
    const stepX = plot.width / count;
    if (spec.type === 'line') {
      const points = spec.series.map((point, index) => ({
        x: plot.x + stepX * (index + 0.5),
        y: plot.y + plot.height * (1 - chartRatio(Number(point.value) || 0, domain)),
        point,
      }));
      const line = points.map((entry, index) => `${index ? 'L' : 'M'} ${round(entry.x)} ${round(entry.y)}`).join(' ');
      const area = `${line} L ${round(points[points.length - 1].x)} ${round(plot.y + plot.height)} L ${round(points[0].x)} ${round(plot.y + plot.height)} Z`;
      defs.push(`<linearGradient id="sari-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette[0]}" stop-opacity="0.55"/><stop offset="1" stop-color="${palette[0]}" stop-opacity="0"/></linearGradient>`);
      push('aire', `<path name="aire" d="${area}" fill="url(#sari-area)"/>`);
      push('courbe', `<path name="courbe" d="${line}" fill="none" stroke="${palette[0]}" stroke-width="${Math.max(2, spec.strokeWidth || 3)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      push(
        'points',
        points
          .map((entry) => `<circle name="point-${slugName(entry.point.label)}" cx="${round(entry.x)}" cy="${round(entry.y)}" r="${Math.max(3, (spec.strokeWidth || 3) + 1.5)}" fill="${palette[1] || palette[0]}" stroke="${label}" stroke-width="1"/>`)
          .join(''),
      );
      push(
        'labels',
        spec.series
          .map((point, index) => `<text x="${round(plot.x + stepX * (index + 0.5))}" y="${plot.y + plot.height + 18}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="${label}">${escapeXml(point.label)}</text>`)
          .join(''),
      );
    } else {
      const slot = stepX * 0.68;
      const bars = spec.series.map((point, index) => {
        const value = Number(point.value) || 0;
        const ratio = chartRatio(value, domain);
        const barHeight = Math.max(2, plot.height * ratio * (domain.max > 0 ? 1 : 1));
        const x = plot.x + stepX * index + (stepX - slot) / 2;
        const y = plot.y + plot.height - barHeight;
        const gradientIndex = index % palette.length;
        return (
          `<rect name="barre-${slugName(point.label)}" x="${round(x)}" y="${round(y)}" width="${round(slot)}" height="${round(barHeight)}" rx="4" fill="url(#sari-c${gradientIndex})"/>` +
          `<text x="${round(x + slot / 2)}" y="${round(y - 8)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${label}">${formatTick(value)}</text>` +
          `<text x="${round(x + slot / 2)}" y="${plot.y + plot.height + 18}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="${label}">${escapeXml(point.label)}</text>`
        );
      });
      push('barres', bars.join(''));
    }
  }

  const title = spec.title ? `<text name="titre" x="${plot.x}" y="18" font-family="Inter, sans-serif" font-size="15" font-weight="700" fill="${label}">${escapeXml(spec.title)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.join('')}</defs>${title}${body.join('')}</svg>`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function formatTick(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value * 100) / 100);
}

function slugName(value: string) {
  return String(value || 'valeur')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'valeur';
}

function escapeXml(value: string) {
  return String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] || char);
}

/* -------------------------------------------------------------------- histoire */

/**
 * Une entrée d'historique : l'état du document, sérialisé, et ce qui l'a produite.
 *
 * Le libellé n'est pas décoratif — c'est la clé de la fusion : deux modifications
 * portant le même nom dans un court intervalle ne comptent qu'une seule entrée.
 */
export interface HistoryEntry {
  label: string;
  at: number;
  snapshot: string;
}

/**
 * La pile d'annulation, bornée et à fusion temporelle.
 *
 * Une frappe au clavier émet un événement par caractère : sans fusion, il faut
 * cinquante `Ctrl+Z` pour effacer un mot, et surtout cinquante sérialisations
 * complètes en mémoire. Deux entrées portant le même nom dans la même seconde n'en
 * font donc qu'une — « texte » pendant la frappe ne pousse qu'une fois, puis
 * l'action suivante tranche.
 */
export function pushHistory(entries: HistoryEntry[], entry: HistoryEntry, limit = HISTORY_LIMIT): HistoryEntry[] {
  const last = entries[entries.length - 1];
  if (last && last.label === entry.label && entry.at - last.at < HISTORY_COALESCE_MS) {
    return [...entries.slice(0, -1), entry];
  }
  return [...entries, entry].slice(-Math.max(1, limit));
}
