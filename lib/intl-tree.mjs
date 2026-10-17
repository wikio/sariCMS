// lib/intl-tree.mjs
/**
 * Le va-et-vient entre `messages/<locale>.json` (un seul fichier, la source de vérité
 * committée) et l'arborescence que parcourt l'écran « Traductions »,
 * `translate/<locale>/**​.json`.
 *
 * Le désordre qu'il range : trois endroits prétendaient détenir les chaînes de
 * l'interface. `messages/` est la source ; `translate/<locale>.json` est ce que le
 * site charge (`i18n/request.ts`) ; `translate/<locale>/` est l'atelier de l'écran —
 * et son contenu datait d'un export antérieur : en retard d'un côté (aucune trace
 * d'`admin.newsletter`), plus riche de l'autre (dix-neuf namespaces restés collés
 * dans le fichier plat `admin.json`). Une retouche enregistrée depuis l'administration
 * ne changeait donc rien en ligne, et l'écran listait deux fois le même namespace sous
 * deux contenus différents.
 *
 * La règle de découpage, bijective :
 *
 *   - un objet dont aucune valeur n'est un objet tient dans un fichier :
 *     `admin/newsletter.json` ⇄ `admin.newsletter` ;
 *   - un objet qui a des enfants-objets devient un dossier, et ses valeurs feuilles
 *     (chaînes, nombres, tableaux) se ramassent dans `_root.json` — sinon elles
 *     n'auraient nulle part où vivre ;
 *   - un nom est donc, produits de la règle, soit un fichier soit un dossier.
 *
 * Les tableaux restent des feuilles : `faq.0.q` est une clé next-intl comme une autre,
 * la découper n'apporterait qu'un arbre plus profond.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

""
/** Le fichier qui récolte les valeurs feuilles d'un nœud qui a aussi des enfants-objets. */
export const ROOT_FILE = '_root.json';

/**
 * Le tiroir des vestiges. Un fichier que la règle ne produit plus — l'ancien export
 * plat `admin.json`, un namespace rebaptisé — n'a rien à faire à l'étage où il
 * ferait de l'ombre au dossier du même nom : il est rangé là, intact, et l'API
 * refuse d'y écrire (les clés d'un vestige vivent désormais dans `messages/`).
 */
export const LEGACY_DIR = '_legacy';

const EXT = '.json'.length;

export const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Les clés dont la valeur est un objet (à descendre), et les autres (à écrire en l'état). */
function partition(node) {
  const branches = {};
  const leaves = {};
  for (const [key, value] of Object.entries(node ?? {})) {
    if (isObject(value)) branches[key] = value;
    else leaves[key] = value;
  }
  return { branches, leaves };
}

/**
 * `messages/<locale>.json` → `Map<'admin/newsletter.json', {...}>`, chemins relatifs à
 * `translate/<locale>/`, séparateurs `/`.
 */
export function splitMessages(messages) {
  const files = new Map();

  const walk = (node, trail) => {
    const { branches, leaves } = partition(node);
    if (!Object.keys(branches).length) {
      files.set(`${trail.join('/')}.json`, node);
      return;
    }
    if (Object.keys(leaves).length) files.set([...trail, ROOT_FILE].join('/'), leaves);
    for (const [key, value] of Object.entries(branches)) walk(value, [...trail, key]);
  };

  const { branches, leaves } = partition(messages);
  if (Object.keys(leaves).length) files.set(ROOT_FILE, leaves);
  for (const [key, value] of Object.entries(branches)) walk(value, [key]);
  return files;
}

/** L'objet de messages reconstruit depuis un arbre de fichiers (l'inverse du découpage). */
export function joinTree(files) {
  const out = {};
  const at = (segments) =>
    segments.reduce((node, key) => (node[key] = isObject(node[key]) ? node[key] : {}), out);

  for (const [rel, value] of files) {
    const ns = namespaceForFile(rel);
    if (!ns) continue;
    Object.assign(at(ns), value);
  }
  return out;
}

/**
 * Le chemin d'un fichier de l'atelier → la liste des clés qu'il représente dans
 * `messages/<locale>.json` : `admin/newsletter.json` → `['admin', 'newsletter']`,
 * `admin/_root.json` → `['admin']` (les feuilles du nœud `admin`).
 */
export function namespaceForFile(relPath) {
  const parts = String(relPath).split('/').filter(Boolean);
  const last = parts.pop() ?? '';
  if (!last.endsWith('.json')) return null;
  const stem = last.slice(0, -EXT);
  if (!stem) return null;
  return stem === ROOT_FILE.slice(0, -EXT) ? parts : [...parts, stem];
}

/** Comparaison indifférente à l'ordre des clés : le disque lit dans l'ordre du système de fichiers. */
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (isObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};

export const sameContent = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** Tous les fichiers JSON d'un dossier, chemins `/` relatifs à `base`. */
export function listJsonFiles(dir, base = dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listJsonFiles(full, base, out);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full.slice(base.length + 1).split(/[\\/]/).join('/'));
    }
  }
  return out;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/**
 * Ce que l'atelier devrait contenir d'après les messages, et ce qui n'y est pas.
 *
 * Les fichiers en trop sont signalés, jamais supprimés : le dépôt traîne un corpus
 * hérité de l'ancien site (`admin.menu`, `admin.login`, `admin.dataManager`… 1 644
 * clés) que `messages/` ne connaît pas. Le jeter pour faire propre, ce serait
 * supprimer du texte sans que personne ne l'ait décidé.
 */
export function planSync(root, locale) {
  const messagesFile = join(root, 'messages', `${locale}.json`);
  const runtimeFile = join(root, 'translate', `${locale}.json`);
  const treeDir = join(root, 'translate', locale);
  const plan = {
    locale,
    messagesFile,
    runtimeFile,
    treeDir,
    messages: null,
    wanted: new Map(),
    toWrite: [],
    clean: 0,
    extra: [],
    toMove: [],
    duplicates: [],
    runtimeStale: false,
    missing: false,
  };

  if (!existsSync(messagesFile)) {
    plan.missing = true;
    return plan;
  }
  plan.messages = readJson(messagesFile);
  plan.wanted = splitMessages(plan.messages);

  for (const [rel, value] of plan.wanted) {
    const full = join(treeDir, rel);
    if (existsSync(full) && sameContent(readJson(full), value)) plan.clean += 1;
    else plan.toWrite.push(rel);
  }

  const wantedSet = new Set(plan.wanted.keys());
  const onDisk = listJsonFiles(treeDir).filter((rel) => !rel.startsWith(`${LEGACY_DIR}/`));
  plan.extra = onDisk.filter((rel) => !wantedSet.has(rel));
  plan.toMove = plan.extra.map((rel) => ({ from: rel, to: `${LEGACY_DIR}/${rel}` }));

  // Un namespace à la fois en fichier plat et en dossier : l'atelier montre deux
  // lignes pour un seul espace, et enregistrer l'une écraserait l'autre dans les
  // messages. C'est l'état que le dépôt traînait (`admin.json` à côté de `admin/`).
  const tree = listJsonFiles(treeDir).filter((rel) => !rel.startsWith(`${LEGACY_DIR}/`));
  const fileStems = new Set(tree.map((rel) => rel.slice(0, -EXT)));
  const dirPaths = new Set();
  for (const rel of tree) {
    let up = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : null;
    while (up) {
      dirPaths.add(up);
      up = up.includes('/') ? up.slice(0, up.lastIndexOf('/')) : null;
    }
  }
  plan.duplicates = [...dirPaths].filter((d) => fileStems.has(d)).sort();

  const raw = readFileSync(messagesFile, 'utf8');
  plan.runtimeStale = !existsSync(runtimeFile) || readFileSync(runtimeFile, 'utf8') !== raw;
  return plan;
}

/**
 * Remplace dans `root` la branche que représente un fichier de l'atelier.
 *
 * `leavesOnly` est le cas de `_root.json` : le fichier ne détient que les valeurs
 * feuilles du nœud, ses enfants-objets vivent dans leurs propres fichiers — les
 * effacer ici viderait la moitié d'un écran. Un objet rencontré dans un
 * `_root.json` est tout de même pris en compte : l'atelier autorise d'y ajouter une
 * section, et la règle la redécoupera au prochain enregistrement.
 */
export function applyNamespace(root, namespace, content, leavesOnly = false) {
  if (leavesOnly) {
    let node = root;
    for (const key of namespace) {
      if (!isObject(node[key])) node[key] = {};
      node = node[key];
    }
    for (const key of Object.keys(node)) if (!isObject(node[key])) delete node[key];
    for (const [key, value] of Object.entries(isObject(content) ? content : {})) node[key] = value;
    return root;
  }

  if (!namespace.length) {
    for (const key of Object.keys(root)) if (!isObject(root[key])) delete root[key];
    Object.assign(root, isObject(content) ? content : {});
    return root;
  }

  let parent = root;
  for (const key of namespace.slice(0, -1)) {
    if (!isObject(parent[key])) parent[key] = {};
    parent = parent[key];
  }
  parent[namespace[namespace.length - 1]] = content;
  return root;
}
