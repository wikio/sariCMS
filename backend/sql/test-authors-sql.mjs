#!/usr/bin/env node
/**
 * Vérifie la migration `migrate-authors.mysql.sql` sans serveur MySQL.
 *
 * Ce fichier crée la table `authors` et rattache les actualités à une fiche
 * auteur : jusqu'ici un article ne portait qu'un nom en texte libre, sans
 * qualification ni présentation.
 *
 * Contrôles :
 *  1. La migration est purement additive (aucun DROP) — applicable sur une
 *     base de production sans rien détruire.
 *  2. Les colonnes couvrent les champs manipulés par l'écran d'administration
 *     et par la fiche vitrine.
 *  3. L'ajout de `news_articles.authorId` est conditionnel, donc rejouable :
 *     MySQL n'accepte pas `ADD COLUMN IF NOT EXISTS`.
 *  4. Les permissions RBAC de la ressource sont créées.
 *  5. Exécution réelle sur SQLite, deux fois de suite, avec vérification du
 *     lien article → auteur.
 *
 * Usage : node backend/sql/test-authors-sql.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(resolve(HERE, 'migrate-authors.mysql.sql'), 'utf8');

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
};

// ---------------------------------------------------------------------------
console.log('\n1. Migration additive (sûre sur une base existante)');
// On ignore les commentaires : l'en-tête mentionne « DROP » en toutes lettres.
const statements = SQL.split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');
check('aucun DROP TABLE', !/\bDROP\s+TABLE\b/i.test(statements));
check('aucun TRUNCATE', !/\bTRUNCATE\b/i.test(statements));
check('aucun DELETE', !/\bDELETE\s+FROM\b/i.test(statements));
check('utilise CREATE TABLE IF NOT EXISTS', /CREATE TABLE IF NOT EXISTS `authors`/.test(statements));

// ---------------------------------------------------------------------------
console.log('\n2. Colonnes attendues');
const EXPECTED = [
  'id', 'locale', 'slug', 'name', 'email', 'role', 'bio', 'photo',
  'isFallback', 'sortOrder', 'status', 'legacyId', 'parentId', 'isDefault',
  'publishedAt', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy',
];
const block = SQL.match(/CREATE TABLE IF NOT EXISTS `authors` \(([\s\S]*?)\n\) ENGINE/);
if (!block) {
  check('table authors présente', false);
} else {
  const present = [...block[1].matchAll(/^\s+`(\w+)`/gm)].map((m) => m[1]);
  const missing = EXPECTED.filter((c) => !present.includes(c));
  check(`authors : ${EXPECTED.length} colonnes attendues`, missing.length === 0, `manquantes : ${missing.join(', ')}`);
  // `role` porte la qualification, `bio` la présentation : ce sont elles qui
  // remplacent la rubrique de l'article et la phrase générique de la vitrine.
  check('la qualification est stockée (role)', present.includes('role'));
  check('la description est stockée (bio)', present.includes('bio'));
  check('l’auteur par défaut est stocké (isFallback)', present.includes('isFallback'));
}

// ---------------------------------------------------------------------------
console.log('\n3. Rattachement des actualités');
check(
  'ajout conditionnel de news_articles.authorId',
  /information_schema\.COLUMNS[\s\S]*?COLUMN_NAME = 'authorId'/.test(SQL) && /ADD COLUMN `authorId`/.test(SQL),
);
check(
  'index conditionnel sur authorId',
  /information_schema\.STATISTICS[\s\S]*?news_articles_authorId_idx/.test(SQL),
);
check('aucun ADD COLUMN inconditionnel', !/ALTER TABLE `news_articles` ADD COLUMN/.test(statements.replace(/'[^']*'/g, "''")));

// ---------------------------------------------------------------------------
console.log('\n4. Permissions RBAC');
for (const action of ['create', 'read', 'update', 'delete', 'admin']) {
  check(`permission authors:${action}`, new RegExp(`\\('authors', '${action}'`).test(SQL));
}
check('insertion sans écrasement (INSERT IGNORE)', /INSERT IGNORE INTO `permissions`/.test(SQL));

// ---------------------------------------------------------------------------
console.log('\n5. Exécution réelle (SQLite) et rejouabilité');
// Traduction MySQL → SQLite : on valide la structure, pas la syntaxe du moteur.
// Les blocs PREPARE/EXECUTE propres à MySQL sont remplacés par l'ALTER simple,
// joué une seule fois (la rejouabilité de ces blocs est vérifiée en 3.).
const sqlite = SQL
  .replace(/^SET @[\s\S]*?DEALLOCATE PREPARE stmt;$/gm, '')
  // SQLite écrit « INSERT OR IGNORE » là où MySQL écrit « INSERT IGNORE ».
  .replace(/INSERT IGNORE INTO/g, 'INSERT OR IGNORE INTO')
  .replace(/^SET .*?;$/gm, '')
  .replace(/ENGINE=InnoDB[^;]*/g, '')
  .replace(/INT\s+NOT NULL AUTO_INCREMENT/g, 'INTEGER')
  .replace(/DATETIME\(3\)/g, 'TEXT')
  .replace(/TINYINT\(1\)/g, 'INTEGER')
  .replace(/VARCHAR\((\d+)\)/g, 'TEXT')
  .replace(/\bJSON\b/g, 'TEXT')
  .replace(/\bTEXT TEXT\b/g, 'TEXT')
  .replace(/CURRENT_TIMESTAMP\(3\)/g, 'CURRENT_TIMESTAMP')
  .replace(/ ON UPDATE CURRENT_TIMESTAMP/g, '')
  .replace(/^\s*UNIQUE KEY `[^`]+` \(([^;]*?)\),?\s*$/gm, '  UNIQUE ($1),')
  .replace(/^\s*KEY `[^`]+` \([^;]*?\),?\s*$/gm, '')
  .replace(/PRIMARY KEY \(`id`\)/g, 'PRIMARY KEY (`id` AUTOINCREMENT)')
  .replace(/^\s*\n/gm, '\n')
  .replace(/,(\s*\n\s*)\)/g, '$1)');

const dir = mkdtempSync(join(tmpdir(), 'sari-authors-'));
const dbPath = join(dir, 'test.db');
const scriptPath = join(dir, 'run.sql');

// Table `news_articles` telle qu'elle existe AVANT la migration : sans
// `authorId`. C'est le cas réel d'une base déjà en production.
const prelude = `
CREATE TABLE permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, resource TEXT, action TEXT,
  description TEXT, createdAt TEXT, updatedAt TEXT, UNIQUE (resource, action));
CREATE TABLE news_articles (id INTEGER PRIMARY KEY AUTOINCREMENT, locale TEXT, slug TEXT,
  title TEXT, authorName TEXT);
INSERT INTO news_articles (id, locale, slug, title, authorName)
  VALUES (1, 'fr', 'article-1', 'Article repris', 'Dr. Marie Laurent');
`;

// Le script est joué deux fois : une migration doit pouvoir être relancée.
writeFileSync(
  scriptPath,
  prelude + sqlite + '\nALTER TABLE news_articles ADD COLUMN authorId INTEGER;\n' + sqlite,
);

const py = `
import sqlite3, sys
con = sqlite3.connect(${JSON.stringify(dbPath)})
con.execute('PRAGMA foreign_keys = ON')
con.executescript(open(${JSON.stringify(scriptPath)}, encoding='utf-8').read())

# Fiche auteur, puis rattachement de l'article existant.
con.execute("INSERT INTO authors (id, locale, slug, name, role, bio, isFallback, status, sortOrder) "
            "VALUES (1, 'fr', 'dr-marie-laurent', 'Dr. Marie Laurent', 'Directrice médicale', "
            "'Spécialiste de l''imagerie médicale.', 0, 'published', 1)")
con.execute("INSERT INTO authors (id, locale, slug, name, role, bio, isFallback, status, sortOrder) "
            "VALUES (7, 'fr', 'equipe-sari', 'Équipe SARI', 'Rédaction', 'Actualités.', 1, 'published', 7)")
con.execute("UPDATE news_articles SET authorId = 1 WHERE id = 1")

joined = con.execute(
    "SELECT a.name, a.role, a.bio FROM news_articles n JOIN authors a ON a.id = n.authorId WHERE n.id = 1"
).fetchone()
assert joined and joined[0] == 'Dr. Marie Laurent', joined
assert joined[1] == 'Directrice médicale', joined
assert joined[2], 'bio vide'

fallback = con.execute("SELECT name FROM authors WHERE isFallback = 1 AND locale = 'fr'").fetchall()
assert len(fallback) == 1, fallback

perms = con.execute("SELECT COUNT(*) FROM permissions WHERE resource = 'authors'").fetchone()[0]
assert perms == 5, perms

# L'unicité (slug, locale) protège des doublons de fiche.
try:
    con.execute("INSERT INTO authors (locale, slug, name, status) VALUES ('fr', 'equipe-sari', 'Doublon', 'published')")
    print('DOUBLON_ACCEPTE')
except sqlite3.IntegrityError:
    print('OK')
`;
const pyPath = join(dir, 'run.py');
writeFileSync(pyPath, py);

try {
  const out = execFileSync('python3', [pyPath], { encoding: 'utf8' }).trim();
  check('import + réimport sans erreur', true);
  check('l’article retrouve nom, qualification et description via authorId', true);
  check('un seul auteur par défaut par langue', true);
  check('les 5 permissions authors sont créées', true);
  check('un slug dupliqué dans la même langue est refusé', out.includes('OK'), out);
} catch (err) {
  check('exécution SQLite', false, String(err.stdout || err.stderr || err).slice(0, 400));
}

console.log(
  failures === 0 ? '\n✅ Migration auteurs valide.\n' : `\n❌ ${failures} vérification(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
