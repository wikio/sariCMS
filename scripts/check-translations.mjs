#!/usr/bin/env node
/**
 * Vérifie que chaque clé de traduction appelée dans le code existe bien
 * dans `messages/{fr,en,ar}.json`.
 *
 * Pourquoi ce script : comparer le *nombre* de clés d'un fichier à l'autre
 * ne prouve rien — trois fichiers peuvent afficher le même total tout en
 * contenant des clés différentes. Et un fichier complet ne garantit pas
 * davantage que le code n'appelle pas une clé absente partout, ce qui
 * produit à l'exécution un `MISSING_MESSAGE` dans la console du navigateur.
 *
 * Le script part donc du code, pas des fichiers :
 *
 *   1. il relève les `useTranslations('espace')` de chaque fichier ;
 *   2. il relève les `t('clé')` qui s'y rattachent ;
 *   3. il vérifie `espace.clé` dans les trois langues ;
 *   4. il regarde l'arborescence que parcourt l'écran « Traductions » (`translate/`),
 *      où un même namespace peut exister deux fois — le signal est une perte de
 *      temps pour qui traduit, et une clé React dupliquée pour l'écran.
 *
 * Usage :
 *   node scripts/check-translations.mjs            # rapport complet
 *   node scripts/check-translations.mjs --missing  # seulement les absentes
 *
 * Sortie non nulle si une clé manque dans au moins une langue : utilisable
 * en garde-fou avant un déploiement.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'ar'];
const ONLY_MISSING = process.argv.includes('--missing');
// `--warn` : le même rapport, mais le code de sortie reste 0. C'est ce que `npm run
// dev` appelle — prévenir sans empêcher de travailler. `npm run build`, lui, échoue :
// une clé que personne n'a écrite ne doit pas partir en production.
const SOFT = process.argv.includes('--warn');

const SCAN_DIRS = ['app', 'components', 'contexts', 'lib'];
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

// --------------------------------------------------------------------------
// Chargement des messages
// --------------------------------------------------------------------------

function flatten(value, prefix = '', out = new Set()) {
  if (Array.isArray(value)) {
    // Les tableaux sont adressés par indice (`faq.0.q`) : on les indexe pour
    // ne pas signaler comme absentes des clés parfaitement résolubles.
    value.forEach((item, i) => flatten(item, prefix ? `${prefix}.${i}` : String(i), out));
    if (prefix) out.add(prefix);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (prefix) {
    out.add(prefix);
  }
  return out;
}

const messages = {};
for (const locale of LOCALES) {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'messages', `${locale}.json`), 'utf8'));
  messages[locale] = flatten(raw);
}

// --------------------------------------------------------------------------
// Relevé des clés appelées dans le code
// --------------------------------------------------------------------------

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (['.tsx', '.ts'].includes(extname(full))) files.push(full);
  }
  return files;
}

/** `t('clé')`, `t("clé")` — les clés calculées (`t(variable)`) sont ignorées. */
const CALL = /\bt\(\s*['"]([A-Za-z0-9_.-]+)['"]/g;
/** `useTranslations('espace')` / `getTranslations('espace')`. */
const NAMESPACE = /(?:useTranslations|getTranslations)\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*\)/g;

const used = new Map(); // clé complète → Set(fichiers)

for (const file of SCAN_DIRS.flatMap((d) => walk(resolve(ROOT, d)))) {
  const source = readFileSync(file, 'utf8');
  const namespaces = [...source.matchAll(NAMESPACE)].map((m) => m[1]);
  if (!namespaces.length) continue;

  // Un fichier déclare rarement plusieurs espaces ; quand c'est le cas, on
  // accepte la clé si elle existe dans l'un d'eux (impossible de rattacher
  // un appel à son espace sans analyser la portée des variables).
  for (const m of source.matchAll(CALL)) {
    const key = m[1];
    const candidates = namespaces.map((ns) => `${ns}.${key}`);
    const where = relative(ROOT, file);
    const label = candidates.join(' | ');
    if (!used.has(label)) used.set(label, { candidates, files: new Set() });
    used.get(label).files.add(where);
  }
}

// --------------------------------------------------------------------------
// Contrôle
// --------------------------------------------------------------------------

const missingEverywhere = [];
const missingSome = [];

for (const [, { candidates, files }] of used) {
  const present = {};
  for (const locale of LOCALES) {
    present[locale] = candidates.some((c) => messages[locale].has(c));
  }
  const absent = LOCALES.filter((l) => !present[l]);
  if (!absent.length) continue;
  const entry = { key: candidates[0], files: [...files], absent };
  if (absent.length === LOCALES.length) missingEverywhere.push(entry);
  else missingSome.push(entry);
}

const sortKey = (a, b) => a.key.localeCompare(b.key);
missingEverywhere.sort(sortKey);
missingSome.sort(sortKey);

if (missingSome.length) {
  console.log(`\n❌ Clés absentes de certaines langues (${missingSome.length})\n`);
  for (const { key, absent, files } of missingSome) {
    console.log(`  ${key}`);
    console.log(`     absente en : ${absent.join(', ')}`);
    console.log(`     appelée depuis : ${files.slice(0, 2).join(', ')}`);
  }
}

if (missingEverywhere.length) {
  console.log(`\n❌ Clés absentes des trois langues (${missingEverywhere.length})\n`);
  for (const { key, files } of missingEverywhere) {
    console.log(`  ${key}`);
    console.log(`     appelée depuis : ${files.slice(0, 2).join(', ')}`);
  }
}

// Écarts entre fichiers de langue, indépendamment du code
if (!ONLY_MISSING) {
  console.log('\n— Écarts entre fichiers de langue —\n');
  const fr = messages.fr;
  for (const locale of LOCALES.filter((l) => l !== 'fr')) {
    const absent = [...fr].filter((k) => !messages[locale].has(k));
    const extra = [...messages[locale]].filter((k) => !fr.has(k));
    console.log(`  ${locale} : ${absent.length} absente(s) vs fr, ${extra.length} en trop`);
    for (const k of absent.slice(0, 8)) console.log(`     manque  ${k}`);
    for (const k of extra.slice(0, 8)) console.log(`     en trop ${k}`);
  }
  console.log('');
  for (const locale of LOCALES) console.log(`  ${locale} : ${messages[locale].size} clés`);
}

// --------------------------------------------------------------------------
// L'arborescence que parcourt l'écran « Traductions »
// --------------------------------------------------------------------------
// `translate/{locale}/` est ce que l'administration liste pour éditer les chaînes.
// Un même namespace peut s'y trouver deux fois : `admin.json`, le fichier plat
// hérité de l'ancien export, et `admin/`, le dossier par écran. Les deux contenus
// diffèrent — l'un a 65 namespaces, l'autre en découpe 46 — et aucun des deux n'est
// décrété gagnant. L'écran affichait donc deux lignes « admin » (React le criait),
// et surtout un traducteur qui ouvre « la bonne » ne tombe pas sur les mêmes clés
// selon le bouton poussé. On signale, on ne corrige pas ici : supprimer le plat
// emporterait dix-neuf namespaces que le dossier n'a pas (menu, login, dataManager,
// users, orders…). Les identifiants de l'arbre ont été rendus uniques côté API.

function countKeys(value) {
  return flatten(value).size;
}

function countTree(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += countTree(full);
    else if (entry.name.endsWith('.json')) {
      try {
        total += countKeys(JSON.parse(readFileSync(full, 'utf8')));
      } catch {
        /* un JSON illisible se fera déjà remarquer à l'usage */
      }
    }
  }
  return total;
}

const collisions = [];

/** Un étage de `translate/{locale}/`, puis ses dossiers : le doublon n'est pas rare plus bas. */
function scanCollisions(dir, trail) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const stem = name.slice(0, -'.json'.length);
    const folder = join(dir, stem);
    if (names.includes(stem) && existsSync(folder) && statSync(folder).isDirectory()) {
      let flat = 0;
      let deep = 0;
      try {
        flat = countKeys(JSON.parse(readFileSync(join(dir, name), 'utf8')));
        deep = countTree(folder);
      } catch {
        /* même parti : le compte reste à zéro, la doublure est signalée quand même */
      }
      collisions.push({ trail: trail ? `${trail}/${stem}` : stem, flat, deep });
    }
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) scanCollisions(full, trail ? `${trail}/${name}` : name);
  }
}

for (const locale of LOCALES) {
  const dir = resolve(ROOT, 'translate', locale);
  if (!existsSync(dir)) continue;
  scanCollisions(dir, locale);
}

if (collisions.length && !SOFT) {
  console.log('\n⚠️  Écran « Traductions » : des namespaces en double exemplaire\n');
  for (const c of collisions) {
    console.log(`  ${c.trail} : ${c.flat} clés en fichier plat, ${c.deep} en dossier`);
  }
  console.log(
    '\n  Les deux sont listés dans l\'arbre de l\'administration (le fichier garde son\n' +
    '  `.json` pour qu\'on les distingue). Réunir les deux en un seul endroit est un\n' +
    '  choix de données, pas un contrôle : ce script ne le bloque pas.\n',
  );
}

const total = missingEverywhere.length + missingSome.length;
console.log(
  total
    ? `\n${total} clé(s) appelée(s) par le code et introuvable(s).${SOFT ? ' — le dev continue, le build refuserait.' : ''}`
    : '\n✅ Toutes les clés appelées par le code existent dans les trois langues.',
);
process.exit(total && !SOFT ? 1 : 0);
