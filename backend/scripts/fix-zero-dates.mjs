#!/usr/bin/env node
// backend/scripts/fix-zero-dates.mjs
/**
 * Répare les dates au zéro de la base configurée, sans client SQL.
 *
 * Le fichier `sql/fix-zero-dates.mysql.sql` fait la même chose et reste la voie
 * recommandée — il se relit avant de se jouer, il marche dans HeidiSQL ou
 * phpMyAdmin, il ne demande aucun secret. Mais il demande une console MySQL, et
 * le symptôme qu'il soigne tombe toujours au pire moment : une liste de
 * l'administration qui répond 500, une table entière illisible par l'ORM parce
 * qu'une seule de ses lignes porte `0000-00-00`, `2026-00-11` ou `2026-07-00`.
 * Ce script-là prend la connexion déjà réglée du CMS (`DATABASE_URL` de
 * `backend/.env`) et applique les mêmes `UPDATE`, uns par uns, en disant avant
 * chacun ce qu'il va toucher.
 *
 *   cd backend
 *   npm run db:fix-dates -- --check    # compter seulement, n'écrire quoi que ce soit
 *   npm run db:fix-dates              # compter, réparer, recontrôler
 *
 * Ce qui est remplacé, c'est le rôle de `fallbackFor` dans le générateur : une
 * colonne NOT NULL reçoit l'heure courante, une date facultative devient NULL —
 * « pas de date » — plutôt qu'une date inventée. Les colonnes sont lues dans
 * `information_schema`, pas dans le schéma du dépôt : réparer ce que la base
 * contient réellement, y compris une table ajoutée à la main.
 *
 * Rejouable : chaque écriture est gardée par son `WHERE`, une base saine ne
 * change rien et le script ne dit que des zéros.
 */
import { badWhere, fallbackFor } from '../sql/generate-fix-zero-dates.mjs';
import { looksLikeMysql, readDatabaseUrl } from './db-url.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const QUIET = process.argv.includes('--quiet');

function log(...args) {
  if (!QUIET) console.log(...args);
}

async function main() {
  const url = readDatabaseUrl();
  if (!url) {
    console.error(
      '✗ DATABASE_URL introuvable : ni dans l’environnement, ni dans backend/.env.\n' +
        '  Le fichier de réparation, lui, se joue à la main et sans ce script :\n' +
        '  mysql -u utilisateur -p base < sql/fix-zero-dates.mysql.sql',
    );
    process.exit(1);
  }
  if (!looksLikeMysql(url)) {
    console.error(
      '✗ DATABASE_URL ne désigne pas MySQL — ce script ne connaît que les dates au zéro de MySQL/MariaDB.\n' +
        '  (Pour PostgreSQL, une date fausse est refusée à l’écriture : le problème ne se pose pas.)',
    );
    process.exit(1);
  }

  let PrismaClient;
  try {
    ({ PrismaClient } = await import('@prisma/client'));
  } catch {
    console.error(
      "✗ Client Prisma introuvable : lancer « npx prisma generate » dans backend/ (ou « npm run prisma:generate »).",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const columns = await prisma.$queryRawUnsafe(
      `SELECT c.TABLE_NAME AS \`table\`, c.COLUMN_NAME AS \`column\`, c.DATA_TYPE AS \`type\`,
              c.IS_NULLABLE AS \`nullable\`, c.DATETIME_PRECISION AS \`precision\`
         FROM information_schema.COLUMNS c
         JOIN information_schema.TABLES t
           ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'
        WHERE c.TABLE_SCHEMA = DATABASE()
          AND c.DATA_TYPE IN ('datetime', 'timestamp', 'date')
        ORDER BY c.TABLE_NAME, c.COLUMN_NAME`,
    );
    if (!columns.length) {
      log('Aucune colonne de date dans cette base — rien à contrôler.');
      return;
    }
    log(
      `${CHECK_ONLY ? 'Contrôle' : 'Réparation'} de ${columns.length} colonnes de date, ` +
        `${new Set(columns.map((c) => c.table)).size} tables.\n`,
    );

    const report = [];
    let touched = 0;
    let failed = 0;
    for (const col of columns) {
      const where = badWhere(col.column);
      const table = col.table;
      const column = col.column;
      let before = 0;
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${where}`,
        );
        before = Number(rows[0]?.n ?? 0);
      } catch (error) {
        // Une table que la base connaît mais que le schéma du dépôt ne couvre pas,
        // ou une colonne en lecture seule : on la signale, on ne s'arrête pas là.
        failed += 1;
        log(`  ! ${table}.${column} — illisible (${String(error.message).split('\n')[0]})`);
        continue;
      }
      if (!before) continue;
      touched += 1;
      if (CHECK_ONLY) {
        log(`  ✗ ${table}.${column} — ${before} ligne(s) à date illisible`);
        report.push({ table, column, before, after: before });
        continue;
      }
      const fallback = fallbackFor({ name: column, nullable: col.nullable === 'YES' });
      log(`  → ${table}.${column} — ${before} ligne(s) reçoivent ${fallback}`);
      await prisma.$executeRawUnsafe(`UPDATE \`${table}\` SET \`${column}\` = ${fallback} WHERE ${where}`);
      const after = Number(
        (await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${where}`))[0]?.n ?? 0,
      );
      report.push({ table, column, before, after });
      if (after) log(`     ${after} ligne(s) résistent — à regarder de près, ces valeurs ne sont pas du genre traité ici`);
    }

    if (!touched) {
      log('\n✓ Aucune date au zéro : les listes de l’administration se relisent.');
      return;
    }

    log(`\n${CHECK_ONLY ? 'À réparer' : 'Réparé'} : ${touched} colonne(s), ${report.reduce((n, r) => n + r.before, 0)} ligne(s).`);
    if (CHECK_ONLY) {
      log('Relancer sans --check pour écrire : npm run db:fix-dates');
    } else {
      log(
        "\nDeux choses à faire après coup :\n" +
          "  1. les listes se relisent aussitôt — aucun redémarrage du CMS n'est nécessaire,\n" +
          "     si ce n'est pour les écrans qui gardaient la réponse en cache ;\n" +
          "  2. laisser sql_mode contenir STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE pour\n" +
          "     que la date fausse soit refusée à l'écriture au lieu d'être avalée : le CMS, lui,\n" +
          "     n'en écrit plus depuis que l'adaptateur la refuse (prisma-repository.toPrisma).",
      );
    }
    if (failed) log(`\n${failed} colonne(s) n'ont pas pu être lues — le fichier sql/fix-zero-dates.mysql.sql les liste mieux, section 4.`);
    process.exitCode = CHECK_ONLY ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`✗ ${error?.message || error}`);
  process.exit(1);
});
