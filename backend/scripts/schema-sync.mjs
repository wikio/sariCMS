#!/usr/bin/env node
// backend/scripts/schema-sync.mjs
/**
 * Compare la base MySQL réelle au schéma attendu, et rattrape le retard.
 *
 * Le symptôme est toujours le même, et il tombe dès qu'une colonne a été ajoutée
 * au dépôt sans que la base l'ait reçue : le client Prisma, lui, est à jour — il
 * connaît `unsubscribeReason`, `home_sections`, `authorId` — et la base non.
 * Toute liste qui touche la colonne ou la table manquante répond 500, avec un
 * message qui ne ressemble à rien côté back-office : « The column
 * `ma_base.newsletter_subscribers.unsubscribeReason` does not exist in the
 * current database ».
 *
 * Pourquoi ne pas répondre « lancez `prisma migrate deploy` » : `migrate` exige
 * la table `_prisma_migrations`, qui garde la trace de ce qui a déjà été joué.
 * Une base remplie en jouant `sql/schema.mysql.sql` — la voie documentée de ce
 * dépôt — ou reprise d'un ancien site ne l'a pas, et `migrate deploy` voudrait
 * alors recréer des tables qui existent déjà. Ce script ne se fie donc qu'à une
 * seule chose : ce que la base contient vraiment, lu dans `information_schema`.
 *
 * Il ne fait qu'ajouter. Il ne modifie aucune colonne, ne change aucun type, ne
 * supprime rien : une base de production garde souvent des tables d'un autre
 * temps, et c'est au propriétaire d'en décider. Les types différents sont
 * signalés, pas corrigés.
 *
 *   cd backend
 *   npm run db:schema-check           # l'état des écarts, et le fichier SQL écrit
 *   npm run db:schema-fix             # en plus, applique les additions
 *   node scripts/schema-sync.mjs --url "mysql://sari:motdepasse@127.0.0.1:3306/sari_cms"
 *
 * `sql/schema-sync.mysql.sql`, produit par la commande de contrôle, se joue dans
 * n'importe quel client et se rejoue sans effet une fois la base à niveau :
 * chaque ordre est gardé par sa propre vérification dans `information_schema`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { databaseName, looksLikeMysql, readDatabaseUrl } from './db-url.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = path.join(HERE, '../sql/schema.mysql.sql');
const PRISMA_SCHEMA = path.join(HERE, '../prisma/schema.prisma');
const OUT_SQL = path.join(HERE, '../sql/schema-sync.mysql.sql');

/** Une ligne de définition de colonne : `nom` TYPE … , — ni index, ni contrainte. */
const COLUMN_LINE = /^\s*`(\w+)`\s+(.+?)\s*,?\s*$/;
const NOT_A_COLUMN = /^\s*(PRIMARY\s+KEY|UNIQUE\s+KEY|KEY|CONSTRAINT|FOREIGN\s+KEY|FULLTEXT)\b/i;

const quote = (value) => String(value).replace(/'/g, "''");

/**
 * Le schéma attendu, tel que `generate-schema.mjs` l'a écrit depuis
 * `prisma/schema.prisma`. On relit le SQL plutôt que le fichier Prisma : c'est le
 * fichier qui porte les types MySQL, les défauts et les longueurs, et le
 * recalculer ici serait l'occasion de diverger du reste du dépôt.
 */
export function parseExpected(sql) {
  const tables = new Map();
  const blocks = sql.match(/CREATE TABLE `(?:IF NOT EXISTS )?(\w+)` \([\s\S]*?\n\) ENGINE[^;]*;/gi) ?? [];
  for (const block of blocks) {
    const name = /CREATE TABLE (?:IF NOT EXISTS )?`(\w+)`/i.exec(block)[1];
    const body = block.slice(block.indexOf('(') + 1, block.lastIndexOf('\n)'));
    const columns = [];
    let last = null;
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (NOT_A_COLUMN.test(line)) {
        last = null;
        continue;
      }
      const m = COLUMN_LINE.exec(line);
      if (m) {
        last = { name: m[1], def: m[2].trim().replace(/,$/, '') };
        columns.push(last);
        continue;
      }
      // Une définition qui continue sur la ligne suivante (un défaut entre
      // parenthèses, un CHECK long) : perdue, elle amputerait l'ADD COLUMN.
      if (last) last.def = `${last.def} ${line.replace(/,$/, '')}`.trim();
    }
    tables.set(name, { name, create: block, columns });
  }
  return tables;
}

/**
 * Le type réduit à ce qui compte pour un `ADD COLUMN` : la famille et, quand la
 * précision change quelque chose, elle. Un `int` rendu `int(11)` par une vieille
 * version de MySQL n'est pas une divergence ; un `datetime` sec à côté d'un
 * `datetime(3)` en est une — les millisecondes y sont perdues, et le tri d'une
 * liste s'en ressent.
 */
export function normType(def) {
  const m = /^\s*([A-Za-z]+)\s*(\(\s*\d+(?:\s*,\s*\d+)?\s*\))?/.exec(String(def || ''));
  if (!m) return '';
  const family = m[1].toLowerCase();
  const precision = (m[2] || '').replace(/\s+/g, '');
  if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'].includes(family)) {
    return family === 'integer' ? 'int' : family;
  }
  if (family === 'datetime' || family === 'timestamp') return `${family}${precision || '(0)'}`;
  if (['varchar', 'char', 'decimal', 'numeric'].includes(family)) return `${family}${precision}`;
  if (/^(tiny|medium|long)?text$/.test(family)) return family;
  return `${family}${precision}`;
}

/**
 * L'écart. `actual` est un Map table → Map colonne → type. Une table entière
 * manquante n'est pas une douzaine de colonnes manquantes : elle est rapportée
 * comme table, et ses colonnes ne sont pas doublonnées.
 */
export function diff(expected, actual) {
  const gaps = { missingTables: [], missingColumns: [], typeDiffers: [], extra: { tables: [], columns: [] } };
  for (const [table, spec] of expected) {
    if (!actual.has(table)) {
      gaps.missingTables.push({ table, create: spec.create });
      continue;
    }
    const columns = actual.get(table);
    const expectedNames = new Set(spec.columns.map((c) => c.name));
    for (const column of spec.columns) {
      if (!columns.has(column.name)) {
        gaps.missingColumns.push({ table, column: column.name, def: column.def });
        continue;
      }
      const here = normType(columns.get(column.name).type);
      const want = normType(column.def);
      if (here && want && here !== want) {
        gaps.typeDiffers.push({ table, column: column.name, expected: want, actual: here });
      }
    }
    for (const name of columns.keys()) {
      if (!expectedNames.has(name)) gaps.extra.columns.push(`${table}.${name}`);
    }
  }
  for (const table of actual.keys()) {
    if (!expected.has(table)) gaps.extra.tables.push(table);
  }
  return gaps;
}

/**
 * Le fichier rejouable. Chaque ajout est gardé par le comptage qu'il ferait, et
 * `DO 0` est l'ordre vide que MySQL accepte là où un bloc vide n'en est pas un :
 * la forme validée sous HeidiSQL pour `migrate-authors`, sans procédure, sans
 * `DELIMITER`, sans table temporaire.
 */
export function renderSql(gaps) {
  const parts = [];
  parts.push(
    `-- backend/sql/schema-sync.mysql.sql
--
-- FICHIER GÉNÉRÉ par « node scripts/schema-sync.mjs » (npm run db:schema-check).
-- Attendu : sql/schema.mysql.sql, lui-même généré de prisma/schema.prisma.
-- Contrôlé le : ${new Date().toISOString().slice(0, 10)}
--
-- Additif seulement : les tables et les colonnes qui manquent. Aucune colonne
-- existante n'est modifiée, aucun type changé, rien n'est supprimé — les écarts
-- signalés au contrôle (types différents, colonnes en trop) restent à votre main,
-- parce qu'ils regardent des données déjà écrites.
--
-- Rejouable : après une mise à niveau, ce fichier ne fait plus rien.
--   mysql -u utilisateur -p base < backend/sql/schema-sync.mysql.sql`,
  );
  parts.push('', 'SET NAMES utf8mb4;', '');

  if (gaps.missingTables.length) {
    parts.push(`-- ——— ${gaps.missingTables.length} table(s) absente(s) de la base ———`, '');
    for (const { create } of gaps.missingTables) {
      parts.push(create.replace(/^CREATE TABLE `/i, 'CREATE TABLE IF NOT EXISTS `').replace(/;?\s*$/, ';'), '');
    }
  }

  if (gaps.missingColumns.length) {
    parts.push(
      `-- ——— ${gaps.missingColumns.length} colonne(s) absente(s) ———`,
      "-- L'une après l'autre, avec le type exact du schéma. Une colonne NOT NULL sans",
      '-- défaut, ajoutée à une table déjà remplie, reçoit la valeur vide de MySQL :',
      "-- c'est le comportement de `ADD COLUMN` lui-même, pas une surprise du fichier.", 
      '',
    );
    for (const { table, column, def } of gaps.missingColumns) {
      parts.push(
        `-- ${table}.${column}`,
        'SET @col := (',
        '  SELECT COUNT(*) FROM information_schema.COLUMNS',
        `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${quote(table)}' AND COLUMN_NAME = '${quote(column)}'`,
        ');',
        'SET @sql := IF(@col = 0,',
        `  'ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${quote(def)}',`,
        "  'DO 0');",
        'PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;',
        '',
      );
    }
  }

  if (!gaps.missingTables.length && !gaps.missingColumns.length) {
    parts.push('-- ——— Rien à ajouter : la base est au niveau du schéma ———', '');
  }

  if (gaps.typeDiffers.length) {
    parts.push(
      `-- ——— ${gaps.typeDiffers.length} colonne(s) au type différent — non modifiées ———`,
      ...gaps.typeDiffers.map((t) => `-- ${t.table}.${t.column} — schéma ${t.expected}, base ${t.actual}`),
      '',
    );
  }
  if (gaps.extra.columns.length) {
    parts.push(
      `-- ——— ${gaps.extra.columns.length} colonne(s) en trop dans la base — non supprimées ———`,
      `-- ${gaps.extra.columns.slice(0, 40).join(', ')}${gaps.extra.columns.length > 40 ? ', …' : ''}`,
      '',
    );
  }
  if (gaps.extra.tables.length) {
    parts.push(
      `-- ——— ${gaps.extra.tables.length} table(s) en trop dans la base — non supprimées ———`,
      `-- ${gaps.extra.tables.slice(0, 40).join(', ')}${gaps.extra.tables.length > 40 ? ', …' : ''}`,
      '',
    );
  }

  return `${parts.join('\n')}\n`;
}

async function main() {
  const url = readDatabaseUrl();
  if (!url) {
    console.error(
      '✗ DATABASE_URL introuvable : ni --url, ni l’environnement, ni backend/.env.\n' +
        '  Relancez avec : node scripts/schema-sync.mjs --url "mysql://utilisateur:motdepasse@127.0.0.1:3306/nom_de_base"',
    );
    process.exit(1);
  }
  if (!looksLikeMysql(url)) {
    console.error('✗ DATABASE_URL ne désigne pas MySQL — ce script ne connaît que le dialecte MySQL.');
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_SQL)) {
    console.error('✗ sql/schema.mysql.sql est absent : lancez « npm run sql:schema » dans backend/.');
    process.exit(1);
  }
  const schemaSql = fs.readFileSync(SCHEMA_SQL, 'utf8');
  if (fs.existsSync(PRISMA_SCHEMA) && fs.statSync(PRISMA_SCHEMA).mtimeMs > fs.statSync(SCHEMA_SQL).mtimeMs) {
    console.warn(
      '! prisma/schema.prisma est plus récent que sql/schema.mysql.sql : l’écart comparé serait faux.\n' +
        '  Lancez « npm run sql:schema » dans backend/, puis relancez ce script.',
    );
  }
  const expected = parseExpected(schemaSql);

  let PrismaClient;
  try {
    ({ PrismaClient } = await import('@prisma/client'));
  } catch {
    console.error(
      '✗ Client Prisma introuvable : lancer « npx prisma generate » dans backend/ (npm run prisma:generate).',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const fix = process.argv.includes('--fix');
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT c.TABLE_NAME AS tableName, c.COLUMN_NAME AS columnName, c.COLUMN_TYPE AS columnType,
              c.IS_NULLABLE AS nullable
         FROM information_schema.COLUMNS c
         JOIN information_schema.TABLES t
           ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'
        WHERE c.TABLE_SCHEMA = DATABASE()`,
    );
    const actual = new Map();
    for (const row of rows) {
      if (!actual.has(row.tableName)) actual.set(row.tableName, new Map());
      actual.get(row.tableName).set(row.columnName, { type: row.columnType, nullable: row.nullable === 'YES' });
    }

    const gaps = diff(expected, actual);
    const pending = gaps.missingTables.length + gaps.missingColumns.length;
    console.log(`Base ${databaseName(url)} — ${expected.size} tables attendues, ${actual.size} en base.`);
    if (!pending) console.log('✓ Aucune table ni colonne manquante.');
    if (gaps.missingTables.length) {
      console.log(`\nTables absentes (${gaps.missingTables.length}) :`);
      for (const { table } of gaps.missingTables) console.log(`  + ${table}`);
    }
    if (gaps.missingColumns.length) {
      console.log(`\nColonnes absentes (${gaps.missingColumns.length}) :`);
      for (const g of gaps.missingColumns) console.log(`  + ${g.table}.${g.column}  ${g.def}`);
    }
    if (gaps.typeDiffers.length) {
      console.log(`\nTypes différents (${gaps.typeDiffers.length}) — signalés, non modifiés :`);
      for (const g of gaps.typeDiffers) console.log(`  ~ ${g.table}.${g.column}  schéma ${g.expected} / base ${g.actual}`);
    }
    if (gaps.extra.columns.length) {
      console.log(`\nColonnes en trop (${gaps.extra.columns.length}) — non supprimées :`);
      console.log(`  ${gaps.extra.columns.slice(0, 20).join(', ')}${gaps.extra.columns.length > 20 ? ', …' : ''}`);
    }
    if (gaps.extra.tables.length) {
      console.log(`\nTables en trop (${gaps.extra.tables.length}) — non supprimées : ${gaps.extra.tables.slice(0, 20).join(', ')}`);
    }

    fs.writeFileSync(OUT_SQL, renderSql(gaps), 'utf8');
    console.log(
      `\nsql/schema-sync.mysql.sql écrit — à jouer plutôt que le script si votre client SQL est` +
        `\nà portée : mysql -u utilisateur -p base < sql/schema-sync.mysql.sql. Le fichier dépend` +
        `\nde LA base contrôlée, il n'est pas versionné.`,
    );

    if (!fix) {
      if (pending) console.log('\nPour appliquer ces additions : npm run db:schema-fix');
      process.exitCode = pending ? 1 : 0;
      return;
    }
    if (!pending) {
      console.log('\n✓ Rien à faire, la base est au niveau.');
      return;
    }

    console.log('\nApplication :');
    for (const { table, create } of gaps.missingTables) {
      await prisma.$executeRawUnsafe(
        create.replace(/^CREATE TABLE `/i, 'CREATE TABLE IF NOT EXISTS `').replace(/;\s*$/, ''),
      );
      console.log(`  ✓ table ${table}`);
    }
    for (const { table, column, def } of gaps.missingColumns) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`  ✓ ${table}.${column}`);
    }
    console.log(
      `\n✓ ${pending} ajout(s) appliqués. Les listes qui tombaient en 500 se relisent : le client\n` +
        `  Prisma n'a pas à être régénéré, c'est la base qui était en retard.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${error?.message || error}`);
    process.exit(1);
  });
}
