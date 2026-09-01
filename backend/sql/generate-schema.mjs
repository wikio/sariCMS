#!/usr/bin/env node
/**
 * Génère `schema.mysql.sql` à partir de `prisma/schema.prisma`.
 *
 * Pourquoi un générateur plutôt qu'un fichier écrit à la main : le SQL
 * livré jusqu'ici avait divergé du schéma Prisma (colonnes `legacyId`,
 * `parentId`, `isDefault`, `color`, `image`… absentes de huit tables, et
 * `services.legacyId` typé INT alors que Prisma déclare une chaîne). Un
 * schéma dérivé automatiquement ne peut plus prendre ce retard.
 *
 *   node sql/generate-schema.mjs
 *
 * `prisma migrate diff` ferait le même travail, mais il exige le
 * téléchargement du moteur Prisma ; ce script n'a besoin que de Node.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(HERE, '../prisma/schema.prisma');
const OUT = resolve(HERE, 'schema.mysql.sql');
const DB = 'sari_cms';

// --------------------------------------------------------------------------
// Lecture du schéma Prisma
// --------------------------------------------------------------------------

const source = readFileSync(SCHEMA, 'utf8');

/** Modèles déclarés, pour distinguer un champ scalaire d'une relation. */
const MODEL_NAMES = new Set([...source.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]));

/** Types scalaires Prisma → MySQL. `@db.Text` et `@db.LongText` priment. */
function sqlType(prismaType, attrs) {
  const base = prismaType.replace(/[?[\]]/g, '');
  if (/@db\.LongText/.test(attrs)) return 'LONGTEXT';
  if (/@db\.Text/.test(attrs)) return 'TEXT';
  const varchar = attrs.match(/@db\.VarChar\((\d+)\)/);
  if (varchar) return `VARCHAR(${varchar[1]})`;
  switch (base) {
    case 'String':
      return 'VARCHAR(255)';
    case 'Int':
      return 'INT';
    case 'BigInt':
      return 'BIGINT';
    case 'Float':
      return 'DOUBLE';
    case 'Decimal':
      return 'DECIMAL(10, 2)';
    case 'Boolean':
      return 'TINYINT(1)';
    case 'DateTime':
      return 'DATETIME(3)';
    case 'Json':
      return 'JSON';
    default:
      return null; // enum ou relation : ignoré
  }
}

/**
 * Contenu de `@default(...)`, parenthèses imbriquées comprises.
 * Un simple `[^)]*` tronquerait `autoincrement()` en `autoincrement(`.
 */
function defaultExpr(attrs) {
  const start = attrs.indexOf('@default(');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + '@default'.length; i < attrs.length; i += 1) {
    if (attrs[i] === '(') depth += 1;
    else if (attrs[i] === ')') {
      depth -= 1;
      if (depth === 0) return attrs.slice(start + '@default('.length, i).trim();
    }
  }
  return null;
}

/** Valeur par défaut Prisma → clause DEFAULT MySQL. */
function sqlDefault(prismaType, attrs) {
  const base = prismaType.replace(/[?[\]]/g, '');
  const raw = defaultExpr(attrs);
  if (raw === null) return '';
  if (raw === 'autoincrement()') return ''; // traité via AUTO_INCREMENT
  if (raw === 'now()') return ' DEFAULT CURRENT_TIMESTAMP(3)';
  if (raw === 'uuid()' || raw === 'cuid()') return '';
  if (base === 'Boolean') return ` DEFAULT ${raw === 'true' ? 1 : 0}`;
  if (base === 'Int' || base === 'Float' || base === 'BigInt' || base === 'Decimal') {
    return ` DEFAULT ${raw}`;
  }
  if (base === 'Json') return ''; // MySQL n'accepte pas de défaut littéral sur JSON
  const quoted = raw.replace(/^"|"$/g, '');
  return ` DEFAULT '${quoted.replace(/'/g, "''")}'`;
}

/** Découpe la liste d'un attribut `@@index([a, b])` en noms de colonnes. */
const cols = (inner) =>
  inner
    .split(',')
    .map((s) => s.trim().replace(/\(.*\)$/, ''))
    .filter(Boolean);

function parseModels() {
  const models = [];
  for (const m of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, name, body] = m;
    const table = (body.match(/@@map\("([^"]+)"\)/) || [, name])[1];

    const fields = [];
    const relations = [];

    for (const line of body.split('\n')) {
      const text = line.trim();
      if (!text || text.startsWith('//') || text.startsWith('@@')) continue;

      const parts = text.split(/\s+/);
      const [fname, ftype] = parts;
      if (!fname || !ftype || !/^[A-Za-z_]/.test(fname)) continue;

      const attrs = text.slice(fname.length + ftype.length + 1);
      const bare = ftype.replace(/[?[\]]/g, '');

      // Champ de relation : mémorisé pour la clé étrangère, pas de colonne.
      if (MODEL_NAMES.has(bare)) {
        const rel = attrs.match(/@relation\(([^)]*)\)/);
        if (rel) {
          const f = rel[1].match(/fields:\s*\[([^\]]+)\]/);
          const r = rel[1].match(/references:\s*\[([^\]]+)\]/);
          const onDelete = (rel[1].match(/onDelete:\s*(\w+)/) || [, 'SetNull'])[1];
          if (f && r) {
            relations.push({
              columns: cols(f[1]),
              target: bare,
              targetColumns: cols(r[1]),
              onDelete,
            });
          }
        }
        continue;
      }

      const type = sqlType(ftype, attrs);
      if (!type) continue; // enum non géré : aucun dans ce schéma

      fields.push({
        name: fname,
        type,
        nullable: ftype.endsWith('?'),
        isId: /@id\b/.test(attrs),
        autoIncrement: /@default\(autoincrement\(\)\)/.test(attrs),
        updatedAt: /@updatedAt\b/.test(attrs),
        unique: /@unique\b/.test(attrs),
        default: sqlDefault(ftype, attrs),
      });
    }

    const uniques = [...body.matchAll(/@@unique\(\[([^\]]+)\]\)/g)].map((u) => cols(u[1]));
    const indexes = [...body.matchAll(/@@index\(\[([^\]]+)\]\)/g)].map((i) => cols(i[1]));
    // Clé primaire composite : `@@id([roleId, permissionId])`. Sans elle, la
    // table de liaison n'avait aucune contrainte d'unicité et un réimport du
    // seed dupliquait toutes les associations rôle ↔ permission.
    const compoundId = body.match(/@@id\(\[([^\]]+)\]\)/);

    models.push({
      name,
      table,
      fields,
      relations,
      uniques,
      indexes,
      compoundId: compoundId ? cols(compoundId[1]) : null,
    });
  }
  return models;
}

// --------------------------------------------------------------------------
// Génération du DDL
// --------------------------------------------------------------------------

const models = parseModels();
const tableOf = new Map(models.map((m) => [m.name, m.table]));

/** Largeur de colonne pour aligner le DDL (lisibilité à la relecture). */
function pad(list, key) {
  return Math.max(...list.map((f) => String(f[key]).length));
}

function renderTable(model) {
  const { table, fields, uniques, indexes, relations, compoundId } = model;
  const wName = pad(fields, 'name') + 2;
  const wType = pad(fields, 'type');
  const lines = [];

  for (const f of fields) {
    let line = `  ${`\`${f.name}\``.padEnd(wName)} ${f.type.padEnd(wType)}`;
    line += f.nullable ? ' NULL' : ' NOT NULL';
    line += f.default;
    // MySQL exige un DEFAULT sur une colonne DATETIME NOT NULL en mode strict.
    if (f.updatedAt && !f.default) line += ' DEFAULT CURRENT_TIMESTAMP(3)';
    if (f.updatedAt) line += ' ON UPDATE CURRENT_TIMESTAMP(3)';
    if (f.autoIncrement) line += ' AUTO_INCREMENT';
    lines.push(line);
  }

  const idField = fields.find((f) => f.isId);
  if (idField) lines.push(`  PRIMARY KEY (\`${idField.name}\`)`);
  else if (compoundId) {
    lines.push(`  PRIMARY KEY (${compoundId.map((c) => `\`${c}\``).join(', ')})`);
  }

  for (const f of fields.filter((x) => x.unique && !x.isId)) {
    lines.push(`  UNIQUE KEY \`${table}_${f.name}_key\` (\`${f.name}\`)`);
  }
  for (const u of uniques) {
    lines.push(
      `  UNIQUE KEY \`${table}_${u.join('_')}_key\` (${u.map((c) => `\`${c}\``).join(', ')})`,
    );
  }
  for (const i of indexes) {
    lines.push(`  KEY \`${table}_${i.join('_')}_idx\` (${i.map((c) => `\`${c}\``).join(', ')})`);
  }
  for (const r of relations) {
    const target = tableOf.get(r.target);
    if (!target) continue;
    const name = `${table}_${r.columns.join('_')}_fkey`;
    const action = r.onDelete === 'Cascade' ? 'CASCADE' : 'SET NULL';
    lines.push(
      `  CONSTRAINT \`${name}\` FOREIGN KEY (${r.columns.map((c) => `\`${c}\``).join(', ')}) ` +
        `REFERENCES \`${target}\` (${r.targetColumns.map((c) => `\`${c}\``).join(', ')}) ` +
        `ON DELETE ${action} ON UPDATE CASCADE`,
    );
  }

  return (
    `-- ${model.name}\n` +
    `DROP TABLE IF EXISTS \`${table}\`;\n` +
    `CREATE TABLE \`${table}\` (\n${lines.join(',\n')}\n` +
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`
  );
}

/** Tri topologique : une table est créée après celles qu'elle référence. */
function ordered() {
  const done = new Set();
  const out = [];
  const visit = (model, stack = new Set()) => {
    if (done.has(model.name) || stack.has(model.name)) return;
    stack.add(model.name);
    for (const r of model.relations) {
      const dep = models.find((m) => m.name === r.target);
      if (dep && dep.name !== model.name) visit(dep, stack);
    }
    stack.delete(model.name);
    if (!done.has(model.name)) {
      done.add(model.name);
      out.push(model);
    }
  };
  models.forEach((m) => visit(m));
  return out;
}

const header = `-- ---------------------------------------------------------------------------
-- SARI CMS — schéma MySQL
--
-- FICHIER GÉNÉRÉ : ne pas modifier à la main.
-- Source : backend/prisma/schema.prisma
-- Régénérer : node backend/sql/generate-schema.mjs
--
-- Import :  mysql -u root -p < backend/sql/schema.mysql.sql
--
-- Encodage utf8mb4 sur toute la base : indispensable pour l'arabe et pour
-- les emojis éventuels des contenus éditoriaux.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS \`${DB}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE \`${DB}\`;

`;

const footer = `
SET FOREIGN_KEY_CHECKS = 1;
`;

const body = ordered().map(renderTable).join('\n');
writeFileSync(OUT, header + body + footer, 'utf8');

const totalCols = models.reduce((n, m) => n + m.fields.length, 0);
console.log(`✅ ${OUT}`);
console.log(`   ${models.length} tables, ${totalCols} colonnes`);
