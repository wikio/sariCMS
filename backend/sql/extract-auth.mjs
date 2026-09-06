#!/usr/bin/env node
/**
 * Génère `backend/sql/auth-only.mysql.sql` : la partie authentification du
 * seed, sans le catalogue de démonstration.
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * `seed.mysql.sql` contient déjà tout ce qu'il faut pour se connecter
 * (permissions, rôles, comptes) — mais il embarque aussi un catalogue de
 * démonstration dont les identifiants entrent en collision avec ceux de
 * `migrate-data.mysql.sql` :
 *
 *     services  seed : 1…15      migrate-data : 1…4, 1001…1004, 2001…2004
 *     produits  seed : 1…18      migrate-data : 1…15, 1001…
 *
 * Importer les deux fichiers mélange donc deux jeux de contenus sur les mêmes
 * lignes. Or c'est bien `migrate-data` qui porte le contenu réel du site.
 *
 * Ce script extrait du seed les seules tables d'authentification, pour pouvoir
 * remplir `users` sans toucher au catalogue. Les blocs sont recopiés tels
 * quels : les hachages bcrypt restent ceux du seed, déjà vérifiés.
 *
 * Usage :
 *   node backend/sql/extract-auth.mjs
 *   mysql -u USER -p BASE < backend/sql/auth-only.mysql.sql
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, 'seed.mysql.sql');
const OUT = resolve(HERE, 'auth-only.mysql.sql');

/** Tables reprises, dans l'ordre imposé par les clés étrangères. */
const TABLES = ['permissions', 'roles', 'role_permissions', 'users'];

const seed = readFileSync(SOURCE, 'utf8');

const blocks = [];
for (const table of TABLES) {
  // Un bloc va de `INSERT ... INTO `table`` jusqu'au premier `;` en fin de ligne.
  const re = new RegExp(`INSERT(?: IGNORE)? INTO \`${table}\`[\\s\\S]*?;\\s*$`, 'm');
  const match = seed.match(re);
  if (!match) {
    console.error(`❌ Bloc « ${table} » introuvable dans seed.mysql.sql`);
    process.exit(1);
  }
  blocks.push({ table, sql: match[0].trimEnd() });
}

const rowCount = (sql) => (sql.match(/^\(/gm) || []).length;

const lines = [
  '-- ---------------------------------------------------------------------',
  '-- SARI CMS — authentification seule (permissions, rôles, comptes)',
  '--',
  '-- Généré par backend/sql/extract-auth.mjs depuis seed.mysql.sql.',
  '-- Ne pas modifier à la main.',
  '--',
  '-- À utiliser quand le contenu du site vient de migrate-data.mysql.sql :',
  '-- le seed complet importerait aussi son catalogue de démonstration, dont',
  '-- les identifiants entrent en collision avec ceux de la reprise.',
  '--',
  '-- Ordre d\'import :',
  '--   1. mysql -u USER -p            < backend/sql/schema.mysql.sql',
  '--   2. mysql -u USER -p NOM_BASE   < backend/sql/auth-only.mysql.sql',
  '--   3. mysql -u USER -p NOM_BASE   < backend/sql/migrate-data.mysql.sql',
  '--',
  '-- Rejouable : INSERT IGNORE laisse intactes les lignes déjà présentes.',
  '--',
  '-- Comptes créés — mot de passe commun : ChangeMe_Sari2026!',
  '--   admin@sarisysteme.com       admin      (Super Administrateur)',
  '--   gestion@sarisysteme.com     admin      (Administrateur)',
  '--   client@clinique-elafia.dz   client',
  '--   contact@meditech.dz         partner',
  '--   mohamed.saidi@gmail.com     candidate  (statut : pending)',
  '--',
  '-- ⚠️  Changez ces mots de passe avant toute mise en ligne.',
  '-- ---------------------------------------------------------------------',
  '',
  'SET NAMES utf8mb4;',
  '',
];

for (const { table, sql } of blocks) {
  lines.push(`-- ${table} — ${rowCount(sql)} ligne(s)`);
  lines.push(sql);
  lines.push('');
}

lines.push('-- Vérification :');
lines.push('--   SELECT id, email, type, status, roleId FROM users;');
lines.push('--   SELECT COUNT(*) FROM permissions;');

writeFileSync(OUT, lines.join('\n'), 'utf8');

console.log(`✅ ${OUT}`);
for (const { table, sql } of blocks) {
  console.log(`   ${table.padEnd(18)} ${rowCount(sql)} ligne(s)`);
}
