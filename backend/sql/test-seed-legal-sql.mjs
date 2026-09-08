#!/usr/bin/env node
/**
 * Vérifie `seed-legal-pages.mysql.sql` sans serveur MySQL.
 *
 * Le fichier doit quatre choses, et seule la mise en œuvre réelle le prouve :
 *  1. il écrit les douze documents, chacun dans sa famille et son type — c'est
 *     ce qui les fait apparaître dans l'administration et les publie sur la
 *     bonne page ;
 *  2. il est rejouable, et une réexécution n'écrase jamais un document déjà
 *     rédigé dans l'administration ;
 *  3. il répare les lignes existantes qui étaient là sans être déclarées,
 *     sans leur toucher le texte ;
 *  4. rien ne détruit : aucun DELETE, aucun DROP, aucune table recréée.
 *
 * Usage : node backend/sql/test-seed-legal-sql.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(resolve(HERE, 'seed-legal-pages.mysql.sql'), 'utf8');
const DOC_TYPES = ['mentions', 'privacy', 'conditions', 'about'];

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
};

// ---------------------------------------------------------------------------
console.log('\n1. Contenu du fichier');
const code = SQL.split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');
check('aucun DROP', !/\bDROP\s+(TABLE|DATABASE)\b/i.test(code));
check('aucun DELETE', !/\bDELETE\s+FROM\b/i.test(code));
check('aucune recréation de table', !/CREATE TABLE|TRUNCATE/i.test(code));
check(
  'le fichier est bien celui du générateur',
  /FICHIER GÉNÉRÉ/.test(SQL) && /generate-seed-legal\.mjs/.test(SQL),
);

const valueLines = [...SQL.matchAll(/^ {2}\('.*$/gm)].map((m) => m[0]);
check(`douze lignes à insérer (${valueLines.length})`, valueLines.length === 12);
for (const locale of ['fr', 'en', 'ar']) {
  const n = valueLines.filter((l) => l.includes(`'${locale}'`)).length;
  check(`${locale} : quatre documents`, n === 4, `${n} ligne(s)`);
}
for (const type of DOC_TYPES) {
  const n = valueLines.filter((l) => l.includes(`'${type}',`)).length;
  check(`${type} : la famille legal et le type sont posés`, n === 3, `${n} langue(s) sur 3`);
}
// Un document qui porte moins de deux cents caractères vient d'un texte
// d'attente, pas de `data/{langue}/legal.json`.
check(
  'aucun document réduit à quelques mots',
  valueLines.every((line) => line.length > 400),
);
// Aucun `id` dans la liste de colonnes : la clé unique (slug, locale) désigne la
// ligne, imposer un identifiant ferait échouer le fichier sur une base qui a
// déjà avancé jusque-là.
check('aucun identifiant imposé', !/INSERT INTO `pages`\s*\(\s*`id`/.test(SQL));
check(
  'le contenu existant est protégé à la réexécution',
  /`content` = IF\(IFNULL\(`content`, ''\) = '', VALUES\(`content`\), `content`\)/.test(SQL),
);

// ---------------------------------------------------------------------------
// Traduction MySQL → SQLite : la syntaxe change, la logique reste la nôtre.
/** Découpe une liste d'expressions sur les virgules de premier niveau. */
function splitTopLevel(input) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === "'" && input[i - 1] !== '\\') {
      const end = input.slice(i + 1).indexOf("'");
      current += input.slice(i, i + end + 2);
      i += end + 1;
      continue;
    }
    if (c === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** `IF(a, b, c)` → `CASE WHEN a THEN b ELSE c END`, en respectant les parenthèses. */
function translateIf(expr) {
  let out = '';
  let i = 0;
  while (i < expr.length) {
    const at = /\bIF\(/.exec(expr.slice(i));
    if (!at) {
      out += expr.slice(i);
      break;
    }
    const open = i + at.index + at[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < expr.length; end += 1) {
      if (expr[end] === '(') depth += 1;
      if (expr[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const [cond, when, unless] = splitTopLevel(expr.slice(open + 1, end));
    out += expr.slice(i, i + at.index) + `CASE WHEN ${cond} THEN ${when} ELSE ${unless} END`;
    i = end + 1;
  }
  return out;
}

function toSqlite(sql) {
  return (
    sql
      // Les commentaires d'abord : le mot « ON DUPLICATE KEY UPDATE » y figure en
      // toutes lettres et serait traduit comme s'il s'agissait du code.
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .replace(/^SET NAMES .*$/gm, '')
    .replace(/CHAR_LENGTH/g, 'LENGTH')
    .replace(/ON DUPLICATE KEY UPDATE([\s\S]*?);/g, (_m, clause) => {
      const sets = splitTopLevel(clause)
        .map((assignment) => {
          const eq = assignment.indexOf('=');
          const column = assignment.slice(0, eq).trim();
          const expr = translateIf(assignment.slice(eq + 1).trim());
          return `  ${column} = ${expr.replace(/VALUES\(`(\w+)`\)/g, 'excluded.$1')}`;
        })
        .join(',\n');
      return `ON CONFLICT(\`slug\`, \`locale\`) DO UPDATE SET\n${sets};`;
    })
  );
}

// ---------------------------------------------------------------------------
console.log('\n2. Exécution réelle (SQLite), deux fois de suite');
const dir = mkdtempSync(join(tmpdir(), 'sari-legal-'));
const dbPath = join(dir, 'test.db');
const scriptPath = join(dir, 'run.sql');

// La table telle qu'elle est sur une base en production : des pages génériques,
// une fiche « À propos » héritée d'un import ancien, une fiche légale oubliée
// dans une autre famille, et un texte rédigé à la main.
const prelude = `
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'fr',
  kind TEXT NOT NULL, subtype TEXT DEFAULT 'simple', title TEXT NOT NULL, subtitle TEXT,
  category TEXT, content TEXT, sortOrder INTEGER DEFAULT 0, status TEXT DEFAULT 'draft',
  publishedAt TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT, UNIQUE (slug, locale)
);
INSERT INTO pages (slug, locale, kind, title, content, status, sortOrder)
  VALUES ('accueil', 'fr', 'generic', 'Accueil', '<p>corps</p>', 'published', 1);
INSERT INTO pages (slug, locale, kind, title, content, status, category)
  VALUES ('about', 'fr', 'about', 'À Propos', '<p>texte de l''import</p>', 'published', NULL);
INSERT INTO pages (slug, locale, kind, title, content, status, category)
  VALUES ('conditions', 'en', 'generic', 'CGV rédigées', '<p>rédigé dans l''admin</p>', 'published', 'conditions');
`;

writeFileSync(scriptPath, prelude + toSqlite(SQL) + '\n' + toSqlite(SQL) + '\n');

const py = `
import sqlite3, sys
con = sqlite3.connect(${JSON.stringify(dbPath)})
con.executescript(open(${JSON.stringify(scriptPath)}, encoding='utf-8').read())

rows = con.execute("SELECT locale, slug, kind, category, status, content, title FROM pages ORDER BY locale, slug").fetchall()
legal = [r for r in rows if r[2] == 'legal']
assert len(legal) == 12, [r[:3] for r in legal]
assert all(r[3] in ('mentions','privacy','conditions','about') for r in legal), 'catégorie absente ou fausse'
assert all(r[4] == 'published' for r in legal), "un document publié dans l'admin seulement"
# Le texte vient du JSON, sauf sur les deux lignes héritées : leur rédaction à
# main est courte, et c'est précisément parce qu'elle est courte qu'elle a été
# conservée.
SHORT = {('about', 'fr'), ('conditions', 'en')}
assert all(len(r[5] or '') > 200 for r in legal if (r[1], r[0]) not in SHORT), \
    'contenu trop court pour être un document'
assert all(len(r[5] or '') > 20 for r in legal if (r[1], r[0]) in SHORT), 'rédaction perdue'
assert len(rows) == 13, rows and len(rows)

# La fiche héritée « about » a été rattachée aux documents légaux SANS perdre son texte.
about = [r for r in rows if r[1] == 'about' and r[0] == 'fr'][0]
assert about[2] == 'legal' and about[3] == 'about', about[:4]
assert about[5] == "<p>texte de l'import</p>", about[5]

# Idem pour une fiche rangée dans le mauvais tiroir : classée, pas réécrite.
cgv = [r for r in rows if r[1] == 'conditions' and r[0] == 'en'][0]
assert cgv[2] == 'legal', cgv[:4]
assert cgv[5] == "<p>rédigé dans l'admin</p>", cgv[5]
assert cgv[6] == 'CGV rédigées', cgv[6]

# Une page ordinaire n'a rien à voir ici : elle est restée ce qu'elle était.
home = [r for r in rows if r[1] == 'accueil'][0]
assert home[2] == 'generic' and home[3] is None, home[:4]

# Le contrôle final du fichier répond bien quatre documents par langue.
counts = con.execute("SELECT locale, COUNT(*) FROM pages WHERE kind='legal' AND deletedAt IS NULL GROUP BY locale").fetchall()
assert dict(counts) == {'ar': 4, 'en': 4, 'fr': 4}, counts
`;
const pyPath = join(dir, 'run.py');
writeFileSync(pyPath, py);

try {
  execFileSync('python3', [pyPath], { encoding: 'utf8' });
  check('import puis réimport, sans erreur', true);
  check('douze documents, chacun avec sa famille et son type', true);
  check('un texte rédigé dans l’administration survit à la réexécution', true);
  check('une ligne héritée est classée sans être réécrite', true);
  check('les pages ordinaires ne sont pas touchées', true);
  check('quatre documents visibles par langue dans l’administration', true);
} catch (err) {
  check('exécution SQLite', false, String(err.stdout || err.stderr || err).slice(0, 600));
}

console.log(
  failures === 0 ? '\n✅ Seed des documents légaux valide.\n' : `\n❌ ${failures} vérification(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
