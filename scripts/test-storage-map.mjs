#!/usr/bin/env node
/**
 * Garde-fou de la carte de stockage.
 *
 *   npm run storage:audit
 *
 * `docs/AUDIT-STOCKAGE-2026-09-25.md` déclare, ligne par ligne, où vit chaque clé
 * `localStorage` du projet et si la donnée est partagée. Ce script vérifie que la
 * carte dit la vérité sur le code, et rien que la vérité :
 *
 * - **une clé manipulée par le code et absente de la carte** est exactement le
 *   défaut qui a produit les vagues précédentes : un magasin « pratique » ajouté à
 *   un écran, qui garde chez le navigateur une donnée que deux postes devraient
 *   partager. Personne ne s'en aperçoit le jour où on l'écrit ; on s'en aperçoit
 *   quand un client appelle parce que son devis a disparu.
 * - **une ligne de carte sans clé dans le code** est une carte périmée, qui endort :
 *   ce document ne vaut que s'il est tenu.
 * - **une donnée partagée marquée « locale » sans dette nommée** est refusée : soit
 *   c'est une erreur de saisie, soit c'est une dette — et une dette se nomme avec une
 *   priorité, pas avec un silence.
 *
 * Les clés composées (`sari_component_${locale}_${type}`) sont couvertes par une
 * ligne de carte finissant par `*`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs/AUDIT-STOCKAGE-2026-09-25.md');
const DOSSIERS = ['app', 'components', 'contexts', 'hooks', 'lib'];
const IGNORE = /node_modules|\.next|\.git|dist|coverage|\bgenerated\b/;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (IGNORE.test(relative(ROOT, full))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

const sources = DOSSIERS.map((d) => join(ROOT, d))
  .filter((d) => {
    try {
      return statSync(d).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap((d) => walk(d));

/** Un gabarit de clé devient un préfixe : `sari_notes_${id}` → `sari_notes_*`. */
const asKey = (raw) =>
  raw.includes('${') ? raw.slice(0, raw.indexOf('${')).replace(/_$/, '_') + '*' : raw;

// 1. Les clés du code.
//
// Deux sources, parce que les noms de clés ne sont pas tous écrits au pied d'un
// `setItem` : une fabrique (`const backupKey = (kind) => \`sari_doc_backup_${kind}\``)
// ou un `return \`sari_flow_${id}\`` sont la même réalité de stockage. Tout littéral
// qui commence par `sari_` ou `__` dans un fichier qui touche `localStorage` est donc
// candidat — le tiret des noms d'événements (`sari-payments-changed`) les exclut de
// lui-même, et un candidat de trop se soigne par une ligne de carte.
const CALL =
  /localStorage\.(?:setItem|getItem|removeItem)\(\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`|([A-Za-z_0-9]+))/g;
const LITERAL = /['"`]((?:sari[_.]|__SARI)[A-Za-z0-9_.\-]*)/g;
const CONST = /(?:const|let)\s+([A-Za-z_0-9]+)\s*=\s*['"]([A-Za-z0-9_.\-]{4,})['"]/g;

const keys = new Map(); // clé -> Set(fichiers)
function note(key, where) {
  if (!key || !/^(sari[_.]|__SARI)/.test(key) || EVENEMENT.test(key)) return;
  // Une clé qui se termine par un tiret bas vient d'un gabarit tronqué par la
  // regex (`sari_sync_ids_${resource}` lu jusqu'au `$`) : c'est une famille.
  if (key.endsWith('_')) key += '*';
  if (!keys.has(key)) keys.set(key, new Set());
  keys.get(key).add(where);
}

/** Les blocs de commentaire nomment des clés mortes et des conventions : ils ne
font pas partie du code qui stocke. `sari_sku_seq`, par exemple, n'existe plus que
dans un commentaire expliquant pourquoi il a été supprimé. */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/** Un nom d'événement n'est pas une clé de stockage : même préfixe, autre rôle. */
const EVENEMENT = /(?:_|-)changed$/;

for (const file of sources) {
  const text = stripComments(readFileSync(file, 'utf8'));
  const rel = relative(ROOT, file);

  const consts = new Map();
  for (const [, name, value] of text.matchAll(CONST)) {
    if (/^(sari[_.]|__SARI)/.test(value)) consts.set(name, asKey(value));
  }
  for (const m of text.matchAll(CALL)) {
    const raw = m[1] || m[2] || m[3];
    if (raw) note(asKey(raw), rel);
    else if (m[4] && consts.has(m[4])) note(consts.get(m[4]), rel);
  }
  for (const m of text.matchAll(LITERAL)) note(asKey(m[1]), rel);
}

// 2. La carte : uniquement la section « Table maître ». Les autres tableaux du
//    document décrivent des fichiers serveur ou des modules — ce ne sont pas des
//    promesses sur une clé.
const docAll = readFileSync(DOC, 'utf8');
const START = docAll.indexOf('## 1. Table maître');
const END = docAll.indexOf('\n## 2.', START + 1);
if (START < 0 || END < 0) {
  console.error(
    `  ✗ ${relative(ROOT, DOC)} : section « 1. Table maître » introuvable — la carte n'a plus de limite lisible`,
  );
  process.exit(1);
}
const map = new Map();
for (const m of docAll.slice(START, END).matchAll(/^\|\s*`([^`]+)`\s*\|(.*)\|\s*$/gm)) {
  map.set(m[1], m[2]);
}

const covers = (key) => {
  if (map.has(key)) return key;
  const stem = key.endsWith('*') ? key.slice(0, -1) : key;
  for (const declared of map.keys()) {
    if (declared === key) return declared;
    if (declared.endsWith('*') && key.startsWith(declared.slice(0, -1))) return declared;
    if (key.endsWith('*') && declared.startsWith(stem)) return declared;
  }
  return null;
};

if (process.env.STORAGE_DEBUG) {
  for (const [k, where] of [...keys].sort()) console.log(`  · ${k}  ← ${[...where].slice(0, 2).join(', ')}`);
}

let echecs = 0;
const dattes = [];

// 3. Chaque clé du code doit être cartographiée, et bien classée.
for (const [key, where] of [...keys].sort()) {
  const declared = covers(key);
  if (!declared) {
    echecs++;
    console.log(
      `  ✗ clé absente de la carte : ${key}\n      vue dans ${[...where].slice(0, 3).join(', ')}\n` +
        `      → ajouter une ligne dans docs/AUDIT-STOCKAGE-2026-09-25.md, section « Table maître »`,
    );
    continue;
  }
  const cells = map.get(declared) || '';
  const partagee = /\bpartagée\b/i.test(cells);
  const persistee = /\bbase\b|\bdocument\b|MySQL|\bfichier serveur\b/.test(cells);
  const dette = /dette P[123]/.test(cells);
  const transitoire =
    /temporaire|préférence|brouillon|marqueur|copie|cache|journal|jeton|vestige/i.test(cells);
  if (partagee && !persistee && !dette) {
    echecs++;
    console.log(
      `  ✗ ${key} : donnée partagée, rien ne la persiste, aucune dette nommée\n` +
        `      la ligne doit contenir « base »/« document », ou « dette P1/P2/P3 » avec l'écran où la reprendre`,
    );
  }
  if (partagee && dette) dattes.push(key);
  if (!partagee && !persistee && !transitoire) {
    echecs++;
    console.log(
      `  ✗ ${key} : classement incomplet — dire si la donnée est partagée, temporaire, persistée ou dette\n` +
        `      une ligne floue ne protège de rien`,
    );
  }
}

// 4. La carte ne doit rien promettre qui n'existe plus.
for (const declared of map.keys()) {
  const hit = [...keys.keys()].some(
    (k) =>
      k === declared ||
      (declared.endsWith('*') && k.startsWith(declared.slice(0, -1))) ||
      (k.endsWith('*') && declared.startsWith(k.slice(0, -1))),
  );
  if (!hit) {
    echecs++;
    console.log(
      `  ✗ la carte déclare ${declared} : plus aucun code ne manipule cette clé\n` +
        `      soit elle a changé de nom, soit elle a disparu — retirer ou corriger la ligne`,
    );
  }
}

console.log(
  `\n  ${keys.size} clés en usage, ${map.size} lignes de carte, ${dattes.length} dette(s) assumée(s)` +
    (echecs ? ` — ${echecs} désaccord(s)` : ' — carte d’aplomb'),
);
process.exit(echecs ? 1 : 0);
