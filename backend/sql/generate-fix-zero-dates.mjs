// backend/sql/generate-fix-zero-dates.mjs
/**
 * Générateur de `fix-zero-dates.mysql.sql`.
 *
 * Pourquoi générer du SQL écrit plutôt qu'un script qui interroge `information_schema`
 * à l'exécution : la réparation doit pouvoir être jouée dans n'importe quel client —
 * HeidiSQL, phpMyAdmin, la ligne de commande — où un bloc `DELIMITER`, une procédure
 * stockée à curseur ou une table temporaire font trébucher plus souvent qu'à leur
 * tour, et où l'erreur obtenue ne ressemble pas au problème. Ici, le fichier produit
 * ne contient que des `SELECT` et des `UPDATE` ordinaires, lisibles avant d'être
 * joués, chacun gardé par son propre `WHERE`.
 *
 * La liste des tables et des colonnes de date vient de `schema.mysql.sql` : le
 * fichier reste exact quand le schéma bouge, et se relit avec
 * `npm run sql:fix-zero-dates` (comme `generate-schema.mjs` et `generate-seed.mjs`).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = path.join(here, 'schema.mysql.sql');
const outFile = path.join(here, 'fix-zero-dates.mysql.sql');

const DATE_TYPES = new Set(['datetime', 'timestamp', 'date']);

/** Les colonnes de date d'une table, avec leur faculté et leur défaut. */
function parseSchema(sql) {
  const tables = [];
  const block = /CREATE TABLE `(\w+)` \(([\s\S]*?)\n\)\s*ENGINE/gi;
  for (const m of sql.matchAll(block)) {
    const [, table, body] = m;
    const columns = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '');
      const col = /^`(\w+)`\s+(datetime|timestamp|date)(\(\d+\))?\s+(.*)$/i.exec(line);
      if (!col) continue;
      const [, name, type, precision, rest] = col;
      if (!DATE_TYPES.has(type.toLowerCase())) continue;
      columns.push({
        name,
        type: type.toLowerCase(),
        precision: precision || '(3)',
        nullable: /^NULL\b/i.test(rest),
        hasDefault: /\bDEFAULT\b/i.test(rest),
      });
    }
    if (columns.length) tables.push({ table, columns });
  }
  return tables;
}

/**
 * « Cette valeur n'est pas une date ». Trois formes, et pas une de plus : le tout à
 * zéro que MySQL écrit quand une colonne NOT NULL sans défaut reçoit rien ; le mois à
 * zéro et le jour à zéro que laissent passer les reprises de l'ancien site. `MONTH()`
 * et `DAY()` rendent NULL sur une date illisible d'où le `COALESCE` — une date juste
 * n'a jamais ni mois ni jour à zéro, donc rien de correct n'est touché.
 */
function badWhere(column) {
  const c = `\`${column}\``;
  return (
    `${c} IS NOT NULL AND (CAST(${c} AS CHAR) LIKE '0000%' ` +
    `OR COALESCE(MONTH(${c}), 0) = 0 OR COALESCE(DAY(${c}), 0) = 0)`
  );
}

/**
 * Par quoi remplacer. L'ordre des écritures compte : le fichier répare `createdAt`
 * avant `updatedAt`, pour que celui-ci ait une date juste à copier.
 */
function fallbackFor(column) {
  switch (column.name) {
    case 'createdAt':
      // Rien à copier en confiance : `updatedAt` est peut-être faux de la même façon.
      return 'NOW(3)';
    case 'updatedAt':
      return 'COALESCE(`createdAt`, NOW(3))';
    case 'publishedAt':
    case 'date':
    case 'publicationDate':
    case 'deletedAt':
    case 'revokedAt':
    case 'lastLoginAt':
    case 'subscribedAt':
    case 'unsubscribedAt':
    case 'desiredDate':
    case 'startDate':
    case 'endDate':
      // Une date facultative à zéro veut dire « pas de date ». Deviner (maintenant,
      // la veille, le 1er du mois) écrirait une information fausse ;
      // effacer une trace de suppression, elle, rendrait visible une ligne retirée —
      // c'est pourquoi `deletedAt` est listé ici et traité en NULL : le service écrit
      // de vraies dates, un zéro ne vient jamais d'une suppression du CMS mais d'une
      // reprise. Les lignes concernées sont comptées au diagnostic, rien n'est muet.
      return column.nullable ? 'NULL' : 'NOW(3)';
    default:
      return column.nullable ? 'NULL' : 'NOW(3)';
  }
}

const schema = fs.readFileSync(schemaFile, 'utf8');
const tables = parseSchema(schema);

// `createdAt` et `updatedAt` d'abord dans chaque table : la seconde copie le premier.
const ordered = tables.map(({ table, columns }) => ({
  table,
  columns: [...columns].sort((a, b) => {
    const rank = (c) => (c.name === 'createdAt' ? 0 : c.name === 'updatedAt' ? 1 : 2);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  }),
}));

const all = ordered.flatMap(({ table, columns }) => columns.map((column) => ({ table, column })));

const countQuery = (label) => {
  const legs = all.map(
    ({ table, column }) =>
      `  SELECT '${table}' AS \`table\`, '${column.name}' AS \`colonne\`, COUNT(*) AS \`${label}\`\n` +
      `    FROM \`${table}\`\n    WHERE ${badWhere(column.name)}`,
  );
  return `SELECT * FROM (\n${legs.join('\n  UNION ALL\n')}\n) s\nWHERE s.\`${label}\` > 0\nORDER BY s.\`${label}\` DESC, s.\`table\`;`;
};

const updates = [];
for (const { table, column } of all) {
  updates.push(
    `UPDATE \`${table}\` SET \`${column.name}\` = ${fallbackFor(column)}\n` +
      ` WHERE ${badWhere(column.name)};`,
  );
}

// Une colonne de date NOT NULL sans défaut est la porte d'entrée du zéro : un INSERT
// qui l'omet en fabrique un. Le fichier la durcit, s'il en trouve une.
const toHarden = all.filter((entry) => !entry.column.nullable && !entry.column.hasDefault);
const hardening = toHarden.map(
  ({ table, column }) =>
    `ALTER TABLE \`${table}\` MODIFY \`${column.name}\` ${column.type.toUpperCase()}${column.precision} NOT NULL` +
    ` DEFAULT CURRENT_TIMESTAMP${column.precision}` +
    (column.name === 'updatedAt' ? ` ON UPDATE CURRENT_TIMESTAMP${column.precision}` : '') +
    `;`,
);

const header = `-- backend/sql/fix-zero-dates.mysql.sql
--
-- RÉPARÉ — dates au zéro (jour ou mois à zéro), toutes tables. Généré par
-- \`generate-fix-zero-dates.mjs\` à partir de \`schema.mysql.sql\` ; ne pas éditer
-- à la main, relancer \`npm run sql:fix-zero-dates\` quand le schéma bouge.
--
-- SYMPTÔME. Une liste de l'administration tombe en 500, et le journal ne dit qu'une
-- chose, de Prisma : « The column \`updatedAt\` contained an invalid datetime value
-- with either day or month set to zero ». Une seule ligne aux dates illisibles suffit,
-- parce que l'ORM hydrate la ligne entière : c'est toute la table qui ne se lit plus.
-- La requête, le filtre, l'écran ouvert n'y sont pour rien — la liste ordinaire d'un
-- module tombe exactement de même.
--
-- COMMENT ÇA ENTRE. MySQL accepte \`0000-00-00 00:00:00\`, \`2026-00-11\`,
-- \`2026-07-00\` dès que \`sql_mode\` ne contient pas \`NO_ZERO_DATE\`/\`NO_ZERO_IN_DATE\` :
-- une reprise en SQL brut, un export de l'ancien site, ou un INSERT qui omet une
-- colonne NOT NULL sans défaut. Ce dépôt n'en produit pas : ses seeds écrivent
-- \`CURRENT_TIMESTAMP(3)\`. Les lignes fautives viennent de la base, pas du code.
--
-- CE QUE FAIT CE FICHIER, dans cet ordre :
--   1. il compte les lignes fautives, table par table et colonne par colonne.
--   2. il les répare — \`createdAt\` reçoit l'heure courante, \`updatedAt\` le
--      \`createdAt\` ainsi réparé, et une date facultative devient NULL, « pas de
--      date », plutôt qu'une date inventée.
--   3. il rejoue le même comptage : tout doit être à zéro.
--   4. il durcit les colonnes de date NOT NULL qui n'ont pas de défaut, pour que
--      personne n'en réécrive.
--
-- Rejouable : chaque ordre est gardé par son \`WHERE\`, une base saine ne change pas.
-- Clients graphiques (HeidiSQL, phpMyAdmin) y compris : pas de procédure, pas de
-- \`DELIMITER\`, pas de table temporaire, pas de requête préparée — du SQL écrit.
--
--   mysql -u utilisateur -p base < backend/sql/fix-zero-dates.mysql.sql
--
-- Après coup, côté serveur, laisser \`sql_mode\` contenir
-- \`STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE\` : la date fausse est alors
-- refusée à l'écriture au lieu d'être avalée.
--   SELECT @@sql_mode
--   SET GLOBAL sql_mode = CONCAT(@@sql_mode, ',STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE')
-- (point-virgule retiré de ces deux lignes : certains clients découpent un fichier
-- sur chaque « ; » même dans un commentaire, et un commentaire avalé devient erreur)
-- Sur un hébergement mutualisé, \`SET GLOBAL\` est en général refusé (pas de privilège) :
-- ce n'est pas bloquant, la section 4 ci-dessous durcit les colonnes elles-mêmes, et
-- le CMS n'écrit plus de date vide depuis que l'adaptateur Prisma la refuse.
`;

const parts = [];
parts.push(header);
parts.push(`-- ——— 1. Diagnostic : ${all.length} colonnes de date balayées ———`);
parts.push(countQuery('lignes'));
parts.push('');
parts.push(`-- ——— 2. Réparation (${updates.length} écritures possibles, chacune gardée par son WHERE) ———`);
parts.push(`-- Sur une colonne \`ON UPDATE CURRENT_TIMESTAMP\`, MySQL reprend la main : la\n` +
            `-- date réparée devient l'heure de la réparation. C'est le rôle d'un tampon de\n` +
            `-- modification, et c'est ce que le site affiche de toute façon.\n`);
parts.push(updates.join('\n'));
parts.push('');
parts.push("-- ——— 3. Contrôle : le même comptage, rejoué — il ne doit sortir aucune ligne ———");
parts.push("-- Un résultat vide ici veut dire que les listes de l'administration se reliront.");
parts.push(countQuery('reste'));
parts.push('');
parts.push('-- ——— 4. Prévention : les colonnes NOT NULL sans défaut ———');
parts.push(
  '-- Ce que la base a réellement, d\'abord : un \`INSERT\` brut qui omet une colonne de\n' +
  '-- date NOT NULL sans défaut y écrit un zéro, et c\'est précisément ainsi qu\'une table\n' +
  '-- se retrouve illisible. Cette requête liste les colonnes à durcir chez vous — la\n' +
  '-- liste peut différer du fichier, si la table a été créée avant les défauts du schéma.\n' +
  'SELECT TABLE_NAME AS `table`, COLUMN_NAME AS `colonne`, DATA_TYPE AS `type`\n' +
  '  FROM information_schema.COLUMNS\n' +
  '  WHERE TABLE_SCHEMA = DATABASE()\n' +
  '    AND DATA_TYPE IN (\'datetime\', \'timestamp\', \'date\')\n' +
  '    AND IS_NULLABLE = \'NO\'\n' +
  '    AND COLUMN_DEFAULT IS NULL\n' +
  '  ORDER BY TABLE_NAME, COLUMN_NAME;',
);
parts.push(
  hardening.length
    ? [
        '-- Les mêmes, côté schéma du dépôt (si la requête ci-dessus en liste d\'autres,\n' +
        '-- c\'est que la base a été créée avant ces défauts : ajouter les ALTER qui\n' +
        '-- manquent, table par table, sur le même modèle).',
        hardening.join('\n'),
      ].join('\n')
    : '-- (aucune : toutes les colonnes de date NOT NULL du schéma ont déjà un défaut)',
);
parts.push('');

fs.writeFileSync(outFile, parts.join('\n'), 'utf8');
const lines = parts.join('\n').split('\n').length;
console.log(
  `fix-zero-dates.mysql.sql écrit : ${tables.length} tables, ${all.length} colonnes de date, ` +
    `${updates.length} UPDATE, ${hardening.length} ALTER — ${lines} lignes`,
);
