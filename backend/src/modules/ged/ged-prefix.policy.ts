/**
 * La politique de nommage de la GED, côté backend.
 *
 * Elle est écrite deux fois, et c'est assumé : la source de vérité côté interface est
 * `lib/ged/prefix.mjs`, en JavaScript nu, que le back-office Next, l'atelier et un
 * script Node relisent sans transpilateur. `nest build` (`rootDir: ./src`) refuse un
 * import hors de `src` : la copie s'impose donc. Le risque d'oubli est réel, alors il
 * est tenu par un test — `ged-prefix.policy.spec.ts` relit le `.mjs` du frontend,
 * compare les tables et vérifie que toute extension admise là-bas l'est ici.
 *
 * Trois règles, ici comme là-bas :
 * - un type connu (`canvas`, `image`, `svg`, `doc`) a son préfixe et son dossier ;
 * - un type inconnu devient son propre dossier ET son propre préfixe (`audio` →
 *   `AUDIO_` dans `audio/`) — c'est ainsi qu'on étend la GED sans toucher au schéma ;
 * - une extension hors liste est refusée pour un contenu généré (`html` en particulier,
 *   parce que `public/uploads` est servi statiquement).
 */

export interface PrefixEntry {
  prefix: string;
  module: string;
  extensions: string[];
}

export const PREFIX_TABLE: Readonly<Record<string, PrefixEntry>> = Object.freeze({
  /** Visuel produit par l'éditeur canvas (rendu + JSON éditable). */
  canvas: Object.freeze({ prefix: 'CANVA_', module: 'canvas', extensions: Object.freeze(['png', 'svg', 'webp', 'jpg']) as string[] }),
  /** Image importée ou retouchée (recadrage, filtres, détourage). */
  image: Object.freeze({ prefix: 'IMG_', module: 'ged', extensions: Object.freeze(['png', 'jpg', 'webp', 'gif', 'avif']) as string[] }),
  /** Fichier SVG manipulé seul. */
  svg: Object.freeze({ prefix: 'SVG_', module: 'ged', extensions: Object.freeze(['svg']) as string[] }),
  /** Document téléchargeable (fiche, plan). */
  doc: Object.freeze({ prefix: 'DOC_', module: 'ged', extensions: Object.freeze(['pdf', 'zip', 'csv', 'xlsx', 'doc', 'docx']) as string[] }),
});

/** Le préfixe posé quand rien n'est déclaré : celui du module, comme avant l'atelier. */
export const FALLBACK_PREFIX = 'GED_';

/** Les extensions qu'un contenu généré a le droit d'écrire. `html` en est absent volontairement. */
export const WRITABLE_EXTENSIONS: readonly string[] = Object.freeze(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'pdf']);

export function isWritableExtension(extension: string): boolean {
  return WRITABLE_EXTENSIONS.includes(String(extension || '').toLowerCase().replace(/^\.*/, ''));
}

/** Une extension, minuscule et sans point ; chaîne vide si le nom n'en a pas. */
export function extensionOf(name: string): string {
  const clean = String(name || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return '';
  return clean.slice(dot + 1).toLowerCase();
}

/** Un nom de module GED : minuscule, court, sans point (sinon l'URL ment sur l'extension). */
export function slugifyModule(value: string): string {
  const slug = String(value || 'ged')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'ged';
}

const SAFE = /[^a-z0-9._-]+/g;

/** Une graine de nom à partir d'un titre libre (accents retirés, espaces → tirets). */
export function slugifyLabel(value: string | undefined, fallback = 'visuel'): string {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, '-')
    .replace(/'/g, '')
    .replace(SAFE, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return (base || fallback).slice(0, 48);
}

/** Le type de contenu d'un fichier d'après son extension. */
export function kindFromName(name: string): string {
  const extension = extensionOf(name);
  if (extension === 'svg') return 'svg';
  if (['pdf', 'zip', 'csv', 'xlsx', 'doc', 'docx'].includes(extension)) return 'doc';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].includes(extension)) return 'image';
  return 'doc';
}

/** `brand` → `BRAND_` ; rien d'exploitable → le préfixe par défaut. */
export function prefixFromModule(module: string): string {
  const upper = String(module || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return PREFIX.test(`${upper}_`) ? `${upper}_` : FALLBACK_PREFIX;
}

/** Un préfixe de GED : trois majuscules minimum, terminé par un tiret bas. */
const PREFIX = /^[A-Z][A-Z0-9]{2,11}_$/;

function normalizePrefix(raw: string, module: string): string {
  const value = String(raw || '').toUpperCase();
  if (PREFIX.test(value)) return value;
  const withUnderscore = value.endsWith('_') ? value : `${value}_`;
  if (PREFIX.test(withUnderscore)) return withUnderscore;
  return prefixFromModule(module);
}

export type PrefixOverrides = Record<string, Partial<PrefixEntry> | undefined>;

/**
 * La table effective : celle du dépôt augmentée des surcharges éventuelles.
 *
 * Côté backend, les surcharges viennent de l'environnement (`GED_PREFIX_OVERRIDES`,
 * JSON) ; côté back-office, de la clé `ged.prefixes` des réglages. Même forme, même
 * contrainte : un préfixe et un module.
 */
export function resolvePrefixes(overrides: PrefixOverrides = {}): Record<string, PrefixEntry> {
  const out: Record<string, PrefixEntry> = {};
  for (const [kind, def] of Object.entries(PREFIX_TABLE)) {
    out[kind] = { module: def.module, prefix: def.prefix, extensions: [...def.extensions] };
  }
  for (const [kind, def] of Object.entries(overrides)) {
    if (!def || typeof def !== 'object') continue;
    const entry = out[kind] || { module: kind, prefix: '', extensions: [] };
    out[kind] = {
      ...entry,
      module: slugifyModule(def.module || entry.module || kind),
      prefix: String(def.prefix || entry.prefix || '').toUpperCase(),
      extensions: Array.isArray(def.extensions) && def.extensions.length ? def.extensions.map((ext) => String(ext).toLowerCase().replace(/^\./, '')) : entry.extensions,
    };
  }
  return out;
}

export function prefixForKind(kind: string, overrides: PrefixOverrides = {}): string {
  const entry = resolvePrefixes(overrides)[String(kind || '').toLowerCase()];
  return entry?.prefix || prefixFromModule(kind || 'ged');
}

export function moduleForKind(kind: string, overrides: PrefixOverrides = {}): string {
  const key = String(kind || '').toLowerCase();
  return slugifyModule(resolvePrefixes(overrides)[key]?.module || key || 'ged');
}

/**
 * La graine unique posée entre le préfixe et le nom lisible.
 *
 * La même forme qu'à l'interface (`Date.now().toString(36)` + quatre caractères
 * d'aléa) : courte, lisible d'un coup d'œil, triable chronologiquement.
 */
export function newStamp(seed: { now?: number; random?: number } = {}): string {
  const now = seed.now ?? Date.now();
  const rand = seed.random ?? Math.random();
  const time = now.toString(36);
  const salt = Math.floor(rand * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
    .slice(0, 4);
  return `${time}${salt}`;
}

export interface BuiltAssetName {
  module: string;
  prefix: string;
  stamp: string;
  label: string;
  extension: string;
  file: string;
}

/**
 * Le nom de fichier d'un contenu généré : `PRE_<stamp>_<slug>.<ext>`.
 *
 * Un type absent de la table n'est pas une erreur : il devient son propre module et son
 * propre préfixe — c'est ce qui permet à un autre module du projet (`CARTE_`,
 * `FACTURE_`…) d'écrire dans la GED avant même d'être déclaré ici.
 */
export function buildAssetName(kind: string, input: { name?: string; extension?: string; stamp?: string; prefix?: string; module?: string; version?: number } = {}, overrides: PrefixOverrides = {}): BuiltAssetName {
  const table = resolvePrefixes(overrides);
  const key = String(kind || '').toLowerCase();
  const entry = table[key] || { prefix: prefixFromModule(key), module: slugifyModule(key), extensions: [] as string[] };
  const prefix = input.prefix ? normalizePrefix(input.prefix, entry.module) : entry.prefix;
  const extension = String(input.extension || entry.extensions[0] || 'png').toLowerCase().replace(/^\./, '');
  if (!isWritableExtension(extension)) {
    throw new Error(`Extension refusée par la GED : ${extension}`);
  }
  const stamp = input.stamp || newStamp();
  const label = slugifyLabel(input.name, key);
  const version = Number(input.version || 0);
  const tail = version > 1 ? `-v${version}` : '';
  return {
    module: entry.module || slugifyModule(key),
    prefix,
    stamp,
    label: `${label}${tail}`,
    extension,
    file: `${prefix}${stamp}_${label}${tail}.${extension}`,
  };
}

export interface ParsedAssetName {
  file: string;
  name: string;
  /** Le dossier du module, tel qu'écrit — vide pour un fichier posé à la racine. */
  module: string;
  prefix: string;
  kind: string;
  stamp: string;
  label: string;
  title: string;
  version: number;
  extension: string;
}

/** `-v3` en fin de nom lisible → 3 ; rien → 1 (la première écriture est la version 1). */
function versionOf(label: string): number {
  const match = /-v(\d{1,4})$/.exec(String(label || ''));
  return match ? Number(match[1]) : 1;
}

/** `post-campagne` → `Post campagne` : le libellé montré dans les listes. */
function humanize(value: string): string {
  const words = String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Le nom d'un fichier décomposé. Lecture symétrique de `buildAssetName`, tolérante aux
 * trois écritures trouvées sur le terrain : le format historique (`product_1_x.png`),
 * le format généré (`CANVA_lz5k1_post.png`), et un fichier posé à la main sans convention.
 */
export function parseAssetName(file: string): ParsedAssetName {
  const raw = String(file || '').replace(/^\/+/, '').split('?')[0];
  const slash = raw.lastIndexOf('/');
  const folder = slash >= 0 ? raw.slice(0, slash) : '';
  const name = slash >= 0 ? raw.slice(slash + 1) : raw;
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  const extension = extensionOf(name);
  const parts = withoutExtension.split('_');
  const hasPrefix = parts.length >= 2 && /^[A-Z][A-Z0-9]{2,11}$/.test(parts[0]);
  const looksLikeStamp = parts.length >= 2 && /^[0-9a-z]{6,14}$/i.test(parts[1]);

  if (hasPrefix && looksLikeStamp) {
    const label = parts.slice(2).join('_') || parts[1];
    return { file: raw, name, module: folder, prefix: `${parts[0]}_`, kind: kindOfPrefix(parts[0]), stamp: parts[1], label, title: humanize(label), version: versionOf(label), extension };
  }
  if (hasPrefix) {
    const label = parts.slice(1).join('_');
    return { file: raw, name, module: folder, prefix: `${parts[0]}_`, kind: kindOfPrefix(parts[0]), stamp: '', label, title: humanize(label), version: versionOf(label), extension };
  }
  return { file: raw, name, module: folder, prefix: '', kind: kindFromName(name), stamp: '', label: withoutExtension, title: humanize(withoutExtension), version: versionOf(withoutExtension), extension };
}

/** Le type d'un contenu d'après son préfixe — ou son extension, à défaut. */
export function kindOfPrefix(prefixOrPart: string, fallback = 'doc'): string {
  const needle = String(prefixOrPart || '').toUpperCase().replace(/_$/, '');
  for (const [kind, def] of Object.entries(PREFIX_TABLE)) {
    if (String(def.prefix).toUpperCase().replace(/_$/, '') === needle) return kind;
  }
  return fallback;
}

/** `x.png` → `x.sari.json` : la fiche posée à côté du fichier. */
export function manifestName(file: string): string {
  return `${String(file || '').replace(/\.[^.]+$/, '')}.sari.json`;
}

export function isManifestFile(file: string): boolean {
  return /\.sari\.json$/i.test(String(file || ''));
}

/**
 * L'URL publique d'un fichier de la GED, telle que la sert le serveur Next.
 *
 * Copie fidèle de `lib/ged/prefix.mjs` (le miroir est vérifié par
 * `ged-prefix.policy.spec.ts`) : un fichier posé à la racine de `public/uploads`
 * s'adresse `/uploads/<fichier>`, jamais `/uploads/ged/<fichier>` — une URL
 * reconstruite depuis le module pointersait un fichier absent.
 */
export function assetUrl(module: string, file: string): string {
  const clean = String(file || '').replace(/^\/+/, '');
  if (!String(module || '').trim()) return `/uploads/${clean}`;
  const folder = slugifyModule(module);
  return clean.startsWith(`${folder}/`) ? `/uploads/${clean}` : `/uploads/${folder}/${clean}`;
}

/** Le dossier d'un asset tel qu'il est écrit sur le disque (`''` pour la racine). */
export function folderOf(ref: string): string {
  const clean = String(ref || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?uploads\//, '')
    .replace(/^\/+/, '')
    .split('?')[0];
  const slash = clean.lastIndexOf('/');
  return slash < 0 ? '' : clean.slice(0, slash);
}
