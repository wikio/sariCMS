/**
 * lib/ged/manifest.mjs — le fichier `.sari.json` qui accompagne un asset.
 *
 * La GED ne connaît que des fichiers : pas de table, pas de base, et un
 * `PATCH /api/admin/upload` qui ne sait que renommer. Tout ce que l'atelier
 * graphique a besoin de garder attaché à un visuel — l'état éditable du canvas,
 * la liste des versions, les légendes, d'où vient le fichier — n'a donc
 * d'autre endroit que le disque, à côté du fichier lui-même.
 *
 * Le manifeste est un JSON posé à côté de l'asset (`x.png` → `x.sari.json`). Ce
 * module en définit la forme et les opérations, **sans aucun accès au disque** :
 * il fusionne, borner, valider. La lecture et l'écriture des fichiers appartiennent
 * au magasin (`lib/ged/store.ts` côté Next, `ged-canvas.service.ts` côté NestJS),
 * et cette séparation est ce qui permet de tester la règle sans serveur.
 *
 * La forme est volontairement extensible : une clé inconnue lue sur le disque est
 * conservée telle quelle au prochain écriture (`mergeManifest` ne jette rien), de
 * sorte qu'un module ajouté plus tard — un `crop` enregistré, un `alt` traduit —
 * ne casse pas ce qui est déjà écrit.
 */

import { extensionOf, isVisual, kindFromName, parseAssetName } from './prefix.mjs';

/** La version du format de manifeste. Un lecteur doit tolérer les plus anciennes. */
export const MANIFEST_VERSION = 1;

/** Ce que pèse au maximum l'état éditable inline dans un manifeste (1,5 Mo). */
export const MAX_INLINE_STATE_BYTES = 1_500_000;

/** Le nombre de versions gardées en trace dans `history` (la 1 est implicite). */
export const MAX_HISTORY = 20;

/** Les états éditables reconnus, et leur extension de fichier. */
export const EDITABLE_FORMATS = Object.freeze({
  fabric: { extension: 'canvas.json', label: 'Canvas (Fabric.js)' },
  svg: { extension: 'svg', label: 'SVG' },
});

/**
 * Un manifeste neuf, complet : toutes les clés présentes, même vides. Un écran
 * qui lit un manifeste ne doit jamais avoir à demander « est-ce que `alt` existe ? ».
 *
 * @param {string} file `module/x.png`
 * @param {{ title?: string, alt?: string, module?: string, kind?: string, source?: object, author?: object, tags?: string[] }} [seed]
 */
export function createManifest(file, seed = {}) {
  const parsed = parseAssetName(file);
  const now = new Date().toISOString();
  return {
    version: MANIFEST_VERSION,
    file: parsed.file,
    kind: seed.kind || parsed.kind || kindFromName(parsed.name),
    prefix: parsed.prefix || '',
    title: seed.title || parsed.title,
    alt: seed.alt ?? '',
    tags: normalizeTags(seed.tags),
    width: Number(seed.width || 0) || 0,
    height: Number(seed.height || 0) || 0,
    bytes: Number(seed.bytes || 0) || 0,
    createdAt: now,
    updatedAt: now,
    source: normalizeSource(seed.source),
    author: normalizePerson(seed.author),
    editable: normalizeEditable(seed.editable),
    render: normalizeRender(seed.render, parsed),
    history: Array.isArray(seed.history) ? seed.history.slice(-MAX_HISTORY) : [],
    extra: {},
  };
}

/**
 * La fusion d'un patch sur un manifeste existant.
 *
 * C'est la seule façon d'écrire : `PATCH /api/admin/upload` ne persiste rien, les
 * écrans envoient donc un patch partiel (« juste l'alternative textuelle ») et le
 * magasin relit le manifeste pour ne pas perdre le reste. Les clés inconnues sont
 * conservées dans `extra`. Une clé explicitement à `null` l'efface.
 *
 * @param {object|null|undefined} current le manifeste lu sur disque, ou rien
 * @param {object} patch ce que l'écran veut changer
 */
export function mergeManifest(current, patch) {
  const base = current && typeof current === 'object' ? current : createManifest(patch?.file || '');
  const next = { ...base };
  const known = ['file', 'kind', 'prefix', 'title', 'alt', 'width', 'height', 'bytes', 'createdAt', 'updatedAt'];
  for (const key of known) {
    if (!(key in (patch || {}))) continue;
    const value = patch[key];
    if (value === null || value === undefined) {
      if (key === 'title' || key === 'alt') next[key] = '';
      continue;
    }
    next[key] = key === 'file' ? String(value).replace(/^\/+/, '') : value;
  }
  if (Array.isArray(patch?.tags)) next.tags = normalizeTags(patch.tags);
  if (patch?.source) next.source = { ...normalizeSource(base.source), ...normalizeSource(patch.source) };
  if (patch?.author !== undefined) next.author = normalizePerson(patch.author);
  if (patch?.editable) next.editable = normalizeEditable(patch.editable);
  if (patch?.render) next.render = { ...normalizeRender(base.render), ...normalizeRender(patch.render) };
  if (Array.isArray(patch?.history)) next.history = clampHistory(patch.history, next.file);
  if (patch?.extra && typeof patch.extra === 'object') next.extra = { ...(base.extra || {}), ...patch.extra };
  for (const [key, value] of Object.entries(patch || {})) {
    if (known.includes(key) || ['tags', 'source', 'author', 'editable', 'render', 'history', 'extra', 'version'].includes(key)) continue;
    next.extra = { ...(next.extra || {}), [key]: value };
  }
  next.version = MANIFEST_VERSION;
  next.updatedAt = new Date().toISOString();
  return next;
}

/** Un historique borné, trié, sans doublon du fichier courant. */
export function clampHistory(entries, currentFile) {
  const list = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && (entry.file || entry.url))
    .map((entry) => ({
      file: entry.file || fileFromUrl(entry.url),
      url: entry.url || '',
      at: entry.at || new Date().toISOString(),
      by: entry.by || '',
      label: entry.label || '',
      width: Number(entry.width || 0) || 0,
      height: Number(entry.height || 0) || 0,
    }));
  const unique = [];
  const seen = new Set([currentFile]);
  for (const entry of list.reverse()) {
    if (!entry.file || seen.has(entry.file)) continue;
    seen.add(entry.file);
    unique.push(entry);
    if (unique.length >= MAX_HISTORY) break;
  }
  return unique.reverse();
}

/**
 * La version qu'on vient d'écraser, rangée dans l'historique.
 *
 * C'est toute la politique de versionnage (§ C du besoin) : le fichier courant
 * reste l'asset actif sous le même nom, l'ancien passe en `history`, et les deux
 * restent des fichiers réels — donc supprimables, téléchargeables, et réexploitables
 * dans n'importe quel écran qui ne connaît pas ce module.
 */
export function pushHistory(manifest, previous) {
  if (!previous || !previous.file) return manifest;
  const entry = {
    file: previous.file,
    url: previous.url || '',
    at: previous.updatedAt || previous.at || new Date().toISOString(),
    by: previous.by || previous.author?.email || manifest.author?.email || '',
    label: previous.label || 'version précédente',
    width: Number(previous.width || 0) || 0,
    height: Number(previous.height || 0) || 0,
    extension: extensionOf(previous.file),
  };
  return { ...manifest, history: clampHistory([entry, ...(manifest.history || [])], manifest.file) };
}

/**
 * La taille en octets de l'état éditable inline (pour la borne d'écriture).
 *
 * Le calcul est fait à la main, et non avec `Buffer.byteLength` : ce module est
 * aussi importé par le client du back-office, qui n'a pas de `Buffer`.
 */
export function byteLength(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function inlineStateSize(editable) {
  if (!editable || !editable.inline) return 0;
  return byteLength(editable.inline);
}

/**
 * Ce qui doit rester dans le manifeste, et ce qui part dans son propre fichier.
 *
 * Une page peut stocker des centaines d'objets canvas ; garder tout le JSON dans
 * le `.sari.json` rendrait la liste de la GED lente à parcourir (elle lit chaque
 * manifeste pour afficher les légendes). Au-dessus de la borne, l'état est écrit
 * dans `x.png.sari.canvas.json` et le manifeste n'en garde que le chemin.
 *
 * @returns {{ manifest: object, stateFile: string|null, stateBody: string|null }}
 */
export function splitForWrite(manifest) {
  const editable = manifest.editable || {};
  const size = inlineStateSize(editable);
  if (!editable.inline || size <= MAX_INLINE_STATE_BYTES) {
    return { manifest: { ...manifest }, stateFile: null, stateBody: null };
  }
  // Un seul nom pour l'état éditable, quel que soit le format : la liste de la GED
  // sait ainsi l'isoler d'un coup d'œil (`isStateFile`) sans connaître les formats.
  const stateFile = `${String(manifest.file || '').replace(/\.[^.]+$/, '')}.sari.canvas.json`;
  return {
    manifest: {
      ...manifest,
      editable: { ...editable, inline: null, file: stateFile },
    },
    stateFile,
    stateBody: JSON.stringify(editable.inline),
  };
}

/** La réciproque : recoller un fichier d'état dans le manifeste qu'on vient de lire. */
export function attachState(manifest, stateBody) {
  if (!manifest || !stateBody) return manifest;
  let parsed = stateBody;
  if (typeof stateBody === 'string') {
    try {
      parsed = JSON.parse(stateBody);
    } catch {
      return manifest;
    }
  }
  return { ...manifest, editable: { ...(manifest.editable || {}), inline: parsed } };
}

/** Les données que la liste de la GED affiche, réduites au strict nécessaire. */
export function summarizeManifest(manifest, file) {
  const target = manifest?.file || file;
  return {
    file: target,
    title: manifest?.title || parseAssetName(target).title,
    alt: manifest?.alt || '',
    kind: manifest?.kind || kindFromName(target),
    prefix: manifest?.prefix || parseAssetName(target).prefix,
    tags: manifest?.tags || [],
    width: manifest?.width || 0,
    height: manifest?.height || 0,
    bytes: manifest?.bytes || 0,
    updatedAt: manifest?.updatedAt || '',
    createdAt: manifest?.createdAt || '',
    version: 1 + (manifest?.history?.length || 0),
    editable: Boolean(manifest?.editable?.inline || manifest?.editable?.file),
    editableFormat: manifest?.editable?.format || null,
    stateFile: manifest?.editable?.file || null,
    render: manifest?.render || null,
    source: manifest?.source || null,
    history: manifest?.history || [],
    isVisual: isVisual(target),
    extra: manifest?.extra || {},
  };
}

/** Un nom de fichier depuis une URL de la GED (`/uploads/canvas/x.png` → `canvas/x.png`). */
export function fileFromUrl(url) {
  const raw = String(url || '').split('?')[0].split('#')[0];
  const marker = '/uploads/';
  const index = raw.indexOf(marker);
  if (index >= 0) return raw.slice(index + marker.length);
  return raw.replace(/^\/+/, '');
}

/** Un fichier est-il l'état éditable d'un asset ? (jamais listé comme un asset) */
export function isStateFile(file) {
  return /\.sari\.canvas\.json$/i.test(String(file || ''));
}

/** Un manifeste est-il lisible comme tel ? (le disque contient n'importe quoi) */
export function looksLikeManifest(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof value.file === 'string');
}

function normalizeTags(tags) {
  if (!tags) return [];
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const tag = String(raw || '').trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag.slice(0, 32));
    if (out.length >= 24) break;
  }
  return out;
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object') {
    return { origin: 'atelier', pageId: '', pageSlug: '', componentId: '', field: '' };
  }
  return {
    origin: ['builder', 'atelier', 'media', 'import'].includes(source.origin) ? source.origin : 'atelier',
    pageId: String(source.pageId ?? ''),
    pageSlug: String(source.pageSlug ?? ''),
    componentId: String(source.componentId ?? ''),
    field: String(source.field ?? ''),
  };
}

function normalizePerson(author) {
  if (!author || typeof author !== 'object') return { id: null, email: '' };
  return { id: author.id ?? null, email: String(author.email || '') };
}

function normalizeEditable(editable) {
  if (!editable || typeof editable !== 'object') return { format: 'fabric', inline: null, file: null, size: 0 };
  const format = EDITABLE_FORMATS[editable.format] ? editable.format : 'fabric';
  return {
    format,
    inline: editable.inline ?? editable.state ?? null,
    file: editable.file || null,
    size: Number(editable.size || 0) || 0,
  };
}

function normalizeRender(render, parsed) {
  const base = render && typeof render === 'object' ? render : {};
  return {
    png: base.png || (parsed?.extension === 'png' ? parsed.file : ''),
    svg: base.svg || (parsed?.extension === 'svg' ? parsed.file : ''),
    webp: base.webp || '',
  };
}
