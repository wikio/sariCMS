/**
 * lib/ged/prefix.mjs — ce qu'est un nom de fichier dans la GED, et qui a le droit
 * de le poser.
 *
 * La GED du projet range déjà ses fichiers en `public/uploads/<module>/<module>_<id>_<slug>.<ext>`
 * (`app/api/admin/upload/route.ts`) : le premier segment est lu comme un module,
 * le second comme l'identifiant, le reste comme le nom lisible. Les écrans
 * existants (`GedPicker`, la médiathèque) découpent le nom sur ce modèle, et
 * aucun ne connaît de table d'assets : **le nom du fichier EST l'index**.
 *
 * Les préfixes demandés pour les contenus générés (CANVA_, IMG_…) prennent donc
 * place exactement là, sans schéma à faire évoluer :
 *
 * ```
 * CANVA_lz5k1x9_post-campagne.png     ← export de l'éditeur canvas
 * IMG_lz5k2b4_echographe-crop.png     ← image recadrée/filtrée depuis la retouche
 * ```
 *
 * Un préfixe n'est pas un dossier : le dossier (le « module ») continue de
 * porter la destination du fichier (`canvas/`, `ged/`, `product/`…) et donc son
 * URL publique. Le préfixe, lui, porte la **nature** du contenu — c'est ce qui
 * permet de filtrer « les visuels issus du canvas » sans toucher à l'arborescence,
 * et d'ajouter un préfixe demain en ajoutant une ligne à `PREFIX_TABLE`.
 *
 * Le module est écrit en JavaScript nu, sans import : la règle doit pouvoir être
 * rejouée par `node scripts/test-ged.mjs` (aucun serveur, aucune base) et relue
 * côté NestJS (`backend/src/modules/ged/ged-prefix.policy.ts`) qui garde la même
 * table sous une forme typée. Les deux extrémités sont verrouillées par le même
 * jeu de cas (voir le test) : une table qui divergerait entre les deux moitiés de
 * l'application écraserait des fichiers au mauvais endroit.
 */

/** Types de contenus que la GED sait nommer. Étendre = ajouter une entrée ici. */
export const PREFIX_TABLE = Object.freeze({
  /** Visuel produit par l'éditeur canvas (rendu + JSON éditable). */
  canvas: { prefix: 'CANVA_', module: 'canvas', extensions: ['png', 'svg', 'webp', 'jpg'] },
  /** Image importée ou retouchée (crop, filtres, détourage). */
  image: { prefix: 'IMG_', module: 'ged', extensions: ['png', 'jpg', 'webp', 'gif', 'avif'] },
  /** Fichier SVG manipulé seul (vectoriel inséré ou modifié dans la page). */
  svg: { prefix: 'SVG_', module: 'ged', extensions: ['svg'] },
  /** Document (fiche PDF, visuel téléchargeable) — repris du comportement actuel. */
  doc: { prefix: 'DOC_', module: 'ged', extensions: ['pdf', 'zip', 'csv', 'xlsx', 'doc', 'docx'] },
});

/** Le préfixe posé quand rien n'est déclaré : celui du module, comme aujourd'hui. */
export const FALLBACK_PREFIX = 'GED_';

const MIME_BY_EXTENSION = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
});

/**
 * Les extensions qu'un contenu généré a le droit d'écrire dans la GED.
 *
 * La liste est courte et volontairement fermée : `/api/admin/upload` accepte déjà
 * n'importe quel fichier d'un utilisateur authentifié, ce qui est le comportement
 * attendu d'un back-office. Un export automatique, lui, n'a aucune raison d'écrire
 * autre chose qu'une image, un SVG ou un PDF — et c'est ce qui empêche l'atelier
 * d'envoyer `script.html` ou `.svg` piégé dans le dossier servi statiquement.
 */
export const WRITABLE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'pdf']);

/** Une extension peut-elle être écrite par un contenu généré ? */
export function isWritableExtension(extension) {
  return WRITABLE_EXTENSIONS.includes(String(extension || '').toLowerCase().replace(/^\./, ''));
}

/** Un préfixe de GED : trois majuscules minimum, terminés par un tiret bas. */
const PREFIX = /^[A-Z][A-Z0-9]{2,11}_$/;

/** Ce qu'un nom de fichier peut contenir une fois normalisé. */
const SAFE = /[^a-z0-9._-]+/g;

/**
 * La table effective : celle du dépôt augmentée de surcharges éventuelles.
 *
 * Les surcharges viennent de la configuration (`GED_PREFIXES` côté API,
 * `sari_config_<langue>.ged.prefixes` côté back-office) et suivent la même
 * contrainte de forme qu'une entrée de la table : un préfixe et un module.
 * Rien n'est ignoré silencieusement — une entrée mal formée est signalée par
 * `validateOverrides`, parce qu'un préfixe qui ne respecte pas la convention
 * rend le fichier illisible par les écrans qui découpent le nom.
 *
 * @param {Record<string, {prefix?: string, module?: string}>} [overrides]
 */
export function resolvePrefixes(overrides) {
  const out = {};
  for (const [kind, def] of Object.entries(PREFIX_TABLE)) {
    out[kind] = { module: def.module, prefix: def.prefix, extensions: [...def.extensions] };
  }
  for (const [kind, def] of Object.entries(overrides || {})) {
    if (!def || typeof def !== 'object') continue;
    const entry = out[kind] || { module: kind, prefix: '', extensions: [] };
    out[kind] = {
      ...entry,
      module: slugifyModule(def.module || entry.module || kind),
      prefix: String(def.prefix || entry.prefix || '').toUpperCase(),
      extensions: Array.isArray(def.extensions) && def.extensions.length
        ? def.extensions.map((e) => String(e).toLowerCase().replace(/^\./, ''))
        : entry.extensions,
    };
  }
  return out;
}

/** Les surcharges sont-elles jouables telles quelles ? Renvoie la liste des tords. */
export function validateOverrides(overrides) {
  const problems = [];
  for (const [kind, def] of Object.entries(overrides || {})) {
    if (!def || typeof def !== 'object') {
      problems.push(`${kind}: attendu un objet { prefix, module }.`);
      continue;
    }
    if (def.prefix !== undefined && !PREFIX.test(String(def.prefix).toUpperCase())) {
      problems.push(
        `${def.prefix}: un préfixe de GED compte 3 à 12 caractères, en majuscules, termine par « _ » (ex. CANVA_).`,
      );
    }
    if (def.module !== undefined && !/^[a-z0-9][a-z0-9-]{0,31}$/.test(String(def.module))) {
      problems.push(`${def.module}: un module GED est un segment de chemin minuscule (lettres, chiffres, tirets).`);
    }
  }
  return problems;
}

/** Le type de contenu d'un fichier d'après son extension (canvas.svg → svg, x.png → image). */
export function kindFromName(name) {
  const extension = extensionOf(name);
  if (extension === 'svg') return 'svg';
  if (extension === 'pdf' || extension === 'zip' || extension === 'csv' || extension === 'doc' || extension === 'docx') return 'doc';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].includes(extension)) return 'image';
  return 'doc';
}

/** L'extension, minuscule et sans point ; chaîne vide si le nom n'en a pas. */
export function extensionOf(name) {
  const clean = String(name || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return '';
  return clean.slice(dot + 1).toLowerCase();
}

/** Un nom de module GED : minuscule, court, sans point (sinon l'URL ment sur l'extension). */
export function slugifyModule(value) {
  const slug = String(value || 'ged').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'ged';
}

/**
 * Le nom lisible d'un fichier, sans préfixe ni extension : ce que montre la
 * médiathèque. Les tirets du bas sont rendus telles quelles — `parts.slice(2)`
 * dans la liste existante produit le même résultat, les deux écrans doivent
 * désigner la même chose sous le même libellé.
 */
export function labelOf(name) {
  const parsed = parseAssetName(name);
  return parsed.label || parsed.file || '';
}

/** Une graine de nom à partir d'un titre libre (accents retirés, espaces → tirets). */
export function slugifyLabel(value, fallback = 'visuel') {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, "-")
    .replace(/'/g, '')
    .replace(SAFE, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return (base || fallback).slice(0, 48);
}

/**
 * La graine unique posée entre le préfixe et le nom lisible.
 *
 * Elle reprend la fabrique déjà en place côté upload (`Date.now().toString(36)`
 * + aléatoire) pour que les deux moitiés de l'application engendrent des noms de
 * la même forme. Elle est courte (≈ 10 caractères) et se relit en base 36 :
 * c'est l'identifiant du fichier dans la GED quand il n'y a pas de table.
 */
export function newStamp(seed) {
  const now = seed && seed.now ? Number(seed.now) : Date.now();
  const rand = seed && seed.random != null ? Number(seed.random) : Math.random();
  const time = now.toString(36);
  const salt = Math.floor(rand * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
    .slice(0, 4);
  return `${time}${salt}`;
}

/**
 * Le nom de fichier d'un contenu généré : `PRE_<stamp>_<slug>.<ext>`.
 *
 * @param {string} kind `canvas` | `image` | `svg` | `doc`, ou une clé ajoutée à la table
 * @param {{ name?: string, extension?: string, stamp?: string, prefix?: string, module?: string, version?: number }} input
 * @param {Record<string, {prefix?: string, module?: string}>} [overrides]
 */
export function buildAssetName(kind, input = {}, overrides) {
  const table = resolvePrefixes(overrides);
  // Un type absent de la table n'est pas une erreur : il devient son propre module
  // et son propre préfixe. C'est ce qui permet à un autre module du projet
  // (« CARTE_, FACTURE_… ») d'écrire dans la GED avant même d'être déclaré ici.
  const entry = table[kind] || { prefix: prefixFromModule(kind), module: slugifyModule(kind), extensions: [] };
  const prefix = normalizePrefix(input.prefix || entry.prefix, entry.module);
  const extension = String(input.extension || entry.extensions[0] || 'png')
    .toLowerCase()
    .replace(/^\./, '');
  const stamp = input.stamp || newStamp();
  const label = slugifyLabel(input.name, kind);
  const version = Number(input.version || 0);
  const tail = version > 1 ? `-v${version}` : '';
  return {
    module: entry.module || slugifyModule(kind),
    prefix,
    stamp,
    label: `${label}${tail}`,
    extension,
    file: `${prefix}${stamp}_${label}${tail}.${extension}`,
  };
}

/** `brand` → `BRAND_` ; rien d'exploitable → le préfixe par défaut. */
export function prefixFromModule(module) {
  const upper = String(module || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return PREFIX.test(`${upper}_`) ? `${upper}_` : FALLBACK_PREFIX;
}

/** Un préfixe acceptable, ou celui du module en capitales si la table est muette. */
function normalizePrefix(raw, module) {
  const value = String(raw || '').toUpperCase();
  if (PREFIX.test(value)) return value;
  const withUnderscore = value.endsWith('_') ? value : `${value}_`;
  if (PREFIX.test(withUnderscore)) return withUnderscore;
  return prefixFromModule(module);
}

/**
 * Le nom d'un fichier décomposé. C'est la lecture symétrique de `buildAssetName`
 * et elle tolère les trois écritures trouvées sur le terrain :
 *
 * - `product_1_echographe.png` — le format historique (préfixe = nom du module) ;
 * - `CANVA_lz5k1_post.png` — le format des contenus générés ;
 * - `photo.png` — un fichier posé à la main dans le dossier, sans convention.
 *
 * @param {string} file `module/NAME.png` ou `NAME.png`
 */
export function parseAssetName(file) {
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
    return {
      file: raw,
      name,
      module: folder,
      prefix: `${parts[0]}_`,
      kind: kindOfPrefix(parts[0]),
      stamp: parts[1],
      label,
      title: humanize(label),
      version: versionOf(label),
      extension,
    };
  }
  if (hasPrefix) {
    // `<PRÉFIXE>_<reste>` sans graine : une écriture manuelle, on garde le reste.
    const label = parts.slice(1).join('_');
    return {
      file: raw,
      name,
      module: folder,
      prefix: `${parts[0]}_`,
      kind: kindOfPrefix(parts[0]),
      stamp: '',
      label,
      title: humanize(label),
      version: versionOf(label),
      extension,
    };
  }
  return {
    file: raw,
    name,
    module: folder,
    prefix: '',
    kind: kindFromName(name),
    stamp: '',
    label: withoutExtension,
    title: humanize(withoutExtension),
    version: versionOf(withoutExtension),
    extension,
  };
}

/**
 * Le type d'un contenu d'après le préfixe lu dans son nom (`CANVA_` → `canvas`).
 *
 * Un nom sans préfixe connu retombe sur son extension : `kindFromName`. C'est la
 * règle qui fait qu'un `photo.png` posé à la main dans `public/uploads/ged/`
 * reste une image retouchable, et qu'un `product_1_echographe.png` — le format
 * historique, où le premier segment est le nom du module et non un préfixe —
 * n'est pas pris pour un contenu de type « product ».
 */
export function kindOfPrefix(prefixOrPart, fallback) {
  const needle = String(prefixOrPart || '').toUpperCase().replace(/_$/, '');
  for (const [kind, def] of Object.entries(PREFIX_TABLE)) {
    if (String(def.prefix).toUpperCase().replace(/_$/, '') === needle) return kind;
  }
  return fallback || 'doc';
}

/** `-v3` en fin de nom lisible → 3 ; rien → 1 (la première écriture est la version 1). */
function versionOf(label) {
  const match = /-v(\d{1,4})$/.exec(String(label || ''));
  return match ? Number(match[1]) : 1;
}

/** `post-campagne` → `Post campagne` : le libellé montré dans les listes. */
export function humanize(value) {
  const words = String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * L'URL publique d'un fichier de la GED, telle que la sert le serveur Next.
 *
 * Le fichier dicte son URL, le module ne fait que la rappeler : `public/uploads`
 * est servi en l'état, donc un fichier posé à la racine s'adresse
 * `/uploads/<fichier>` et non `/uploads/ged/<fichier>`. Reconstruire l'URL depuis
 * un module deviné — l'ancien comportement — pointe un fichier qui n'existe pas
 * là : la retouche répond « image non chargeable », la planche s'ouvre sur un fond
 * blanc et le `<img>` d'une page est mort. Un module vide est donc la signature
 * « racine », et ne doit jamais être remplacé par `ged` ici.
 */
export function assetUrl(module, file) {
  const clean = String(file || '').replace(/^\/+/, '');
  if (!String(module || '').trim()) return `/uploads/${clean}`;
  const folder = slugifyModule(module);
  return clean.startsWith(`${folder}/`) ? `/uploads/${clean}` : `/uploads/${folder}/${clean}`;
}

/** Le dossier d'un asset tel qu'il est écrit sur le disque (`''` pour la racine). */
export function folderOf(ref) {
  const clean = String(ref || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?uploads\//, '')
    .replace(/^\/+/, '')
    .split('?')[0];
  const slash = clean.lastIndexOf('/');
  return slash < 0 ? '' : clean.slice(0, slash);
}

/** Le nom du fichier de manifeste associé à un asset (`x.png` → `x.sari.json`). */
export function manifestName(file) {
  const withoutExtension = String(file || '').replace(/\.[^.]+$/, '');
  return `${withoutExtension}.sari.json`;
}

/** Un asset est-il son propre manifeste ? (la liste ne doit jamais l'afficher) */
export function isManifestFile(file) {
  return /\.sari\.json$/i.test(String(file || ''));
}

/** Le type MIME d'une extension, ou `application/octet-stream`. */
export function mimeOf(extension) {
  return MIME_BY_EXTENSION[String(extension || '').toLowerCase().replace(/^\./, '')] || 'application/octet-stream';
}

/**
 * Les fichiers que la GED sait montrer comme visuels (miniature dans la liste,
 * insertions dans le canvas de page). Les SVG comptent : c'est même l'usage
 * demandé (« images/SVG existants depuis la GED »).
 */
export function isVisual(file) {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'].includes(extensionOf(file));
}
