#!/usr/bin/env node
// backend/scripts/test-schema-sync.mjs
/**
 * Vérifie `schema-sync.mjs` sans base de données.
 *
 * Trois choses à tenir, et seule la dernière se voyait dans le code :
 *  1. le schéma attendu est bien lu dans `sql/schema.mysql.sql` — les lignes
 *     d'index et de contraintes ne sont pas des colonnes ;
 *  2. la comparaison de types ne crie pas au loup (un `int(11)` d'une vieille
 *     version n'est pas une divergence) mais ne rate pas le vrai écart
 *     (`datetime` contre `datetime(3)`, où les millisecondes se perdent) ;
 *  3. le fichier produit ne peut rien casser : que des additions, chacune
 *     gardée par sa vérification, jamais un `DROP`, jamais un `MODIFY`, et
 *     aucune ligne qui commence hors commentaire sans être un ordre SQL — un
 *     `--` oublié dans le générateur se joue en erreur, chez le client.
 *
 * Usage : node backend/scripts/test-schema-sync.mjs   (npm run db:schema-test)
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diff, normType, parseExpected, renderSql } from './schema-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
};

// ---------------------------------------------------------------------------
console.log('\n1. Lecture du schéma attendu (sur un extrait)');
const FIXTURE = [
  'CREATE TABLE `pages` (',
  '  `id` INT NOT NULL AUTO_INCREMENT,',
  '  `slug` VARCHAR(191) NOT NULL,',
  '  `content` TEXT NULL,',
  '  `publishedAt` DATETIME(3) NULL,',
  '  `status` VARCHAR(191) NOT NULL DEFAULT \'draft\',',
  '  PRIMARY KEY (`id`),',
  '  UNIQUE KEY `pages_slug_locale_key` (`slug`),',
  '  KEY `pages_status_idx` (`status`),',
  '  CONSTRAINT `fk_pages_user` FOREIGN KEY (`id`) REFERENCES `users` (`id`)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  '',
  'CREATE TABLE `newsletter_subscribers` (',
  '  `id` INT NOT NULL AUTO_INCREMENT,',
  '  `email` VARCHAR(191) NOT NULL,',
  '  `unsubscribedAt` DATETIME(3) NULL,',
  '  `unsubscribeReason` VARCHAR(255) NULL,',
  '  `unsubscribeNote` TEXT NULL,',
  '  PRIMARY KEY (`id`)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
].join('\n');const expected = parseExpected(FIXTURE);
check('deux tables lues', expected.size === 2, `${expected.size}`);
const pages = expected.get('pages');
check(
  'les lignes d’index et de contraintes ne sont pas prises pour des colonnes',
  pages.columns.every((c) => !['PRIMARY', 'UNIQUE', 'KEY', 'CONSTRAINT', 'FOREIGN'].includes(c.name.toUpperCase())),
  pages.columns.map((c) => c.name).join(', '),
);
check('cinq colonnes pour pages', pages.columns.length === 5, `${pages.columns.length}`);
check(
  'le défaut reste attaché à la définition',
  pages.columns.find((c) => c.name === 'status').def.includes("DEFAULT 'draft'"),
  pages.columns.find((c) => c.name === 'status').def,
);

// ---------------------------------------------------------------------------
console.log('\n2. Comparaison des types');
check('int(11) vaut int', normType('int(11)') === normType('INT'));
check('bigint(20) vaut bigint', normType('bigint(20)') === normType('BIGINT'));
check('datetime ne vaut pas datetime(3)', normType('datetime') !== normType('DATETIME(3) NULL'));
check('varchar(191) ne vaut pas varchar(255)', normType('varchar(191)') !== normType('VARCHAR(255) NULL'));
check('longtext ne vaut pas text', normType('longtext') !== normType('text'));
check('json se reconnaît', normType("JSON NOT NULL DEFAULT (json_object())") === 'json');

// ---------------------------------------------------------------------------
console.log('\n3. L’écart, tel qu’il sera annoncé');
const actual = new Map();
actual.set(
  'pages',
  new Map([
    ['id', { type: 'int' }],
    ['slug', { type: 'varchar(255)' }],
    ['content', { type: 'longtext' }],
    ['publishedAt', { type: 'datetime' }], // précision perdue à la reprise
    ['legacyId', { type: 'varchar(64)' }], // colonne d'un ancien site
  ]),
);
// newsletter_subscribers est absente tout entière.
const gaps = diff(expected, actual);
check(
  'la table manquante est rapportée comme table',
  gaps.missingTables.length === 1 && gaps.missingTables[0].table === 'newsletter_subscribers',
  JSON.stringify(gaps.missingTables.map((g) => g.table)),
);
check(
  'une colonne manquante n’est pas volée par la table absente',
  gaps.missingColumns.length === 1 && gaps.missingColumns[0].column === 'status',
  gaps.missingColumns.map((g) => `${g.table}.${g.column}`).join(', '),
);
const differs = gaps.typeDiffers.map((g) => g.column);
check(
  'les vrais écarts de type sont signalés',
  ['slug', 'content', 'publishedAt'].every((c) => differs.includes(c)),
  differs.join(', ') || 'aucun',
);
check("un int équivalent n'est pas un écart", !differs.includes('id'), differs.join(', '));
check('la colonne d’emprunt est listée, pas supprimée', gaps.extra.columns.join() === 'pages.legacyId', gaps.extra.columns.join());

// ---------------------------------------------------------------------------
console.log('\n4. Le fichier généré');
const sql = renderSql(gaps);
check('aucun DROP', !/\bDROP\b/i.test(sql));
check('aucun MODIFY ni CHANGE', !/\b(MODIFY|CHANGE)\s+COLUMN\b/i.test(sql));
check(
  'la table absente est recréée sous IF NOT EXISTS',
  /CREATE TABLE IF NOT EXISTS `newsletter_subscribers`/.test(sql),
);
const guard = sql.slice(sql.indexOf('SET @col :='), sql.indexOf('DEALLOCATE PREPARE stmt;') + 'DEALLOCATE PREPARE stmt;'.length);
check(
  'la colonne est gardée par son comptage, et le « sinon » existe',
  /information_schema\.COLUMNS/.test(guard) &&
    /TABLE_NAME = 'pages' AND COLUMN_NAME = 'status'/.test(guard) &&
    /SET @sql := IF\(@col = 0,/.test(guard) &&
    /'ALTER TABLE `pages` ADD COLUMN `status`/.test(guard) &&
    /'DO 0'\);/.test(guard) &&
    /PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;/.test(guard),
  guard.replace(/\n/g, ' ⏎ ').slice(0, 200),
);
check(
  'une écriture par écart, pas une de plus',
  (sql.match(/PREPARE stmt FROM @sql/g) ?? []).length === gaps.missingColumns.length,
);const body = sql
  .split('\n')
  .map((line, i) => ({ line, i }))
  .filter(({ line }) => line.trim() && !line.trim().startsWith('--'));
// Le corps du fichier, une fois les commentaires retirés : chaque ligne doit être
// un ordre SQL complet. C'est là que se voit un `--` oublié dans le générateur.
// Un fragment de phrase échappé des commentaires se trahit : il commence par un
// mot commun et ne ressemble à aucun mot-clé SQL. C'est le défaut exact qui a été
// corrigé ici — une ligne de commentaire sans son `--` se joue en erreur.
const prose = body.filter(({ line }) => /^[a-z\u00C0-\u00FF]+ [a-z\u00C0-\u00FF]+\s/.test(line.trim()));
check('aucun fragment de phrase hors commentaire', prose.length === 0, prose.map((x) => `${x.i + 1}: ${x.line}`).join(' | '));
const opens = (body.map((x) => x.line).join(' ').match(/\(/g) ?? []).length;
const closes = (body.map((x) => x.line).join(' ').match(/\)/g) ?? []).length;
check('parenthèses équilibrées dans le fichier', opens === closes, `${opens} ouvrantes, ${closes} fermantes`);
// Un défaut de colonne contient des apostrophes : doublés, ils ne ferment pas la
// chaîne du `PREPARE`.
check(
  'le défaut à apostrophes est échappé dans le PREPARE',
  /ADD COLUMN `status` VARCHAR\(191\) NOT NULL DEFAULT ''draft''/.test(sql),
  sql.match(/ADD COLUMN `status`[^\n]*/)?.[0] ?? '(absent)',
);
// Un fichier sans écart doit rester jouable : rien qu'un commentaire.
// Une base qui a exactement le schéma ne doit rien avoir à écrire.
const upToDate = new Map();
for (const [table, spec] of expected) {
  upToDate.set(table, new Map(spec.columns.map((c) => [c.name, { type: normType(c.def) }])));
}
const clean = renderSql(diff(expected, upToDate));
check(
  'base au niveau : aucune écriture dans le fichier',
  !/ALTER|CREATE TABLE/.test(clean) && /Rien à ajouter/.test(clean),
);

// ---------------------------------------------------------------------------
console.log('\n5. Le vrai schéma du dépôt');
const real = parseExpected(readFileSync(resolve(HERE, '../sql/schema.mysql.sql'), 'utf8'));
check('toutes les tables du schéma sont lues', real.size >= 27, `${real.size} tables`);
const subscribers = real.get('newsletter_subscribers');
check(
  'newsletter_subscribers porte bien les deux colonnes du motif de départ',
  subscribers && subscribers.columns.some((c) => c.name === 'unsubscribeReason') &&
    subscribers.columns.some((c) => c.name === 'unsubscribeNote'),
);
const pagesTable = real.get('pages');
check(
  'pages porte sa catégorie (la famille « legal » et son type de document)',
  pagesTable && pagesTable.columns.some((c) => c.name === 'category'),
);
check(
  "aucune table n'est lue vide (un bloc mal borné se verrait ici)",
  [...real.values()].every((t) => t.columns.length >= 2),
  [...real.entries()].filter(([, t]) => t.columns.length < 2).map(([n, t]) => `${n}:${t.columns.length}`).join(', '),
);
const realColumns = [...real.values()].reduce((n, t) => n + t.columns.length, 0);
check('le corps du schéma est lu en entier', realColumns > 250, `${realColumns} colonnes`);
const rp = real.get('role_permissions');
check(
  'une table de jointure garde ses deux seules colonnes, sans avaler les contraintes',
  rp && rp.columns.map((c) => c.name).join(',') === 'roleId,permissionId',
  rp ? rp.columns.map((c) => c.name).join(',') : '(absente)',
);

console.log(failures === 0 ? '\n✅ Schéma-sync valide.\n' : `\n❌ ${failures} vérification(s) en échec.\n`);
process.exit(failures === 0 ? 0 : 1);
