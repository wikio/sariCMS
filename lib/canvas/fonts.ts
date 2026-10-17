/**
 * lib/canvas/fonts.ts — les polices de l'atelier.
 *
 * L'atelier propose des polices Google, comme demandé. Trois contraintes règlent la
 * façon dont elles arrivent, et elles se contredisent joliment :
 *
 * 1. **Le texte doit être posÉ avant d'être mesuré.** Fabric calcule la largeur d'une
 *    ligne avec `measureText` : si la fonte n'est pas encore chargée, le texte est
 *    mesuré dans la police de repli, encadré au mauvais endroit — et l'export garde
 *    cette géométrie. Toute modification typographique attend donc `document.fonts.ready`
 *    avant de redessiner.
 * 2. **Un atelier peut être hors ligne.** Une feuille de style Google qui ne répond
 *    pas ne doit pas bloquer l'éditeur : le lien est inséré, jamais attendu à l'init ;
 *    seule la fonte demandée par un objet en cours d'édition est attendue, avec délai.
 * 3. **Le visuel publié doit ressembler à son édition.** Les pages du site chargent
 *    leurs propres fontes ; l'export PNG, lui, est rendu ici. On garantit donc que la
 *    famille utilisée est chargée *avant* l'export, sinon le PNG montrerait le repli
 *    là où l'éditeur montrait la vraie fonte.
 */

/** La liste est courte et volontaire : ce sont les familles qui tiennent une charte de santé. */
export const FONT_LIBRARY = [
  { family: 'Inter', label: 'Inter', weights: [400, 500, 600, 700], category: 'bâton', fallback: 'system-ui, sans-serif' },
  { family: 'Manrope', label: 'Manrope', weights: [400, 600, 800], category: 'bâton', fallback: 'system-ui, sans-serif' },
  { family: 'Poppins', label: 'Poppins', weights: [400, 600, 700], category: 'bâton', fallback: 'system-ui, sans-serif' },
  { family: 'Sora', label: 'Sora', weights: [400, 600, 800], category: 'bâton', fallback: 'system-ui, sans-serif' },
  { family: 'Outfit', label: 'Outfit', weights: [300, 500, 700], category: 'bâton', fallback: 'system-ui, sans-serif' },
  { family: 'Playfair Display', label: 'Playfair Display', weights: [400, 700, 900], category: 'empattements', fallback: 'Georgia, serif' },
  { family: 'Lora', label: 'Lora', weights: [400, 600, 700], category: 'empattements', fallback: 'Georgia, serif' },
  { family: 'Cormorant Garamond', label: 'Cormorant Garamond', weights: [400, 600, 700], category: 'empattements', fallback: 'Georgia, serif' },
  { family: 'DM Serif Display', label: 'DM Serif Display', weights: [400], category: 'titre', fallback: 'Georgia, serif' },
  { family: 'Space Grotesk', label: 'Space Grotesk', weights: [400, 500, 700], category: 'moderne', fallback: 'system-ui, sans-serif' },
  { family: 'Spline Sans Mono', label: 'Spline Sans Mono', weights: [400, 600], category: 'chiffres', fallback: 'ui-monospace, monospace' },
  { family: 'Archivo Expanded', label: 'Archivo Expanded', weights: [600, 800], category: 'titre', fallback: 'system-ui, sans-serif' },
] as const;

/** Celles qu'on charge sans qu'on les demande : la première seconde de l'atelier doit déjà être typographiée. */
const EAGER = ['Inter', 'Playfair Display', 'Poppins'] as const;

const STYLE_ID = 'sari-canvas-fonts';
const requested = new Set<string>();
const sheet = { families: new Set<string>() };

/**
 * Insère (une seule fois) la feuille de styles Google Fonts de l'atelier.
 *
 * La feuille est accumulée : demander « Lora » puis « Sora » ajoute une famille au
 * `css2?family=…` plutôt que d'empiler six `<link>`, parce que chaque requête de
 * feuille est une requête bloquante pour le premier rendu du texte.
 */
function ensureSheet() {
  if (typeof document === 'undefined') return null;
  let link = document.getElementById(STYLE_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  return link;
}

/** L'URL de la feuille, reconstruite depuis les familles déjà réclamées. */
function refreshSheet() {
  const link = ensureSheet();
  if (!link) return;
  const families = [...sheet.families].sort();
  if (!families.length) return;
  const query = families.map((family) => `family=${family.replace(/ /g, '+')}:wght@${fontWeightsFor(family).join(';')}`).join('&');
  const url = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  if (link.getAttribute('href') !== url) link.setAttribute('href', url);
}

function fontWeightsFor(family: string) {
  const found = FONT_LIBRARY.find((entry) => entry.family === family);
  return found ? [...found.weights] : [400, 700];
}

/** Charge une famille (tous ses poids) — sans attendre, pour l'ouverture de l'atelier. */
export function ensureFonts(families: readonly string[] = EAGER) {
  if (typeof document === 'undefined') return;
  let changed = false;
  for (const family of families) {
    if (sheet.families.has(family)) continue;
    sheet.families.add(family);
    changed = true;
  }
  if (!changed) return;
  refreshSheet();
  // `document.fonts.load` demande le chargement réel : la feuille seule ne charge un
  // poids que si quelqu'un l'utilise, et un poids non chargé se dessine en repli.
  for (const family of families) {
    for (const weight of fontWeightsFor(family)) {
      const spec = `${weight} 32px "${family}"`;
      if (requested.has(spec)) continue;
      requested.add(spec);
      document.fonts?.load?.(spec).catch(() => undefined);
    }
  }
}

/**
 * La fonte est-elle posable tout de suite ?
 *
 * Résout même en cas d'échec : un atelier bloqué sur un réseau lent serait pire
 * qu'un atelier qui dessine un instant dans la police de repli.
 */
export async function waitForFont(family: string, size = 32, weight: string | number = 400, timeoutMs = 1200): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  ensureFonts([family]);
  const spec = `${weight} ${size}px "${family}"`;
  const fonts = (document as Document).fonts;
  if (!fonts) return;
  const loading = Promise.resolve()
    .then(() => fonts.load(spec))
    .then(() => fonts.ready)
    .catch(() => undefined);
  await Promise.race([loading, new Promise((resolve) => window.setTimeout(resolve, timeoutMs))]);
}

/** Le groupe générique à écrire dans l'objet, pour qu'un repli reste lisible. */
export function fontStackOf(family: string) {
  const found = FONT_LIBRARY.find((entry) => entry.family === family);
  return found ? `${found.family}, ${found.fallback}` : `${family || 'Inter'}, system-ui, sans-serif`;
}

/** Une famille hors bibliothèque (celle d'un gabarit importé) est-elle au moins nommée ? */
export function isKnownFamily(family: string) {
  return FONT_LIBRARY.some((entry) => entry.family === family);
}

/** Les familles groupées par usage, pour un sélecteur qui se lit plutôt qu'il ne se parcourt. */
export function fontGroups(): { category: string; fonts: { family: string; label: string; weights: number[] }[] }[] {
  const groups: { category: string; fonts: { family: string; label: string; weights: number[] }[] }[] = [];
  for (const entry of FONT_LIBRARY) {
    const view = { family: entry.family, label: entry.label, weights: [...entry.weights] };
    const group = groups.find((candidate) => candidate.category === entry.category);
    if (group) group.fonts.push(view);
    else groups.push({ category: entry.category, fonts: [view] });
  }
  return groups;
}

/** La liste plate, telle que la consomme un `<select>`. */
export function fontOptions() {
  return FONT_LIBRARY.map((entry) => ({ value: entry.family, label: `${entry.label} · ${entry.category}`, weights: [...entry.weights] }));
}
