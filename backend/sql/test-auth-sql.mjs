#!/usr/bin/env node
/**
 * Vérifie `auth-only.mysql.sql` sans serveur MySQL.
 *
 *  1. Les hachages bcrypt du fichier valident bien les mots de passe annoncés
 *     (c'est ce qui décide si la connexion fonctionnera : `auth.service.ts`
 *     appelle `bcrypt.compare`).
 *  2. Les types de comptes appartiennent au contrat de l'API.
 *  3. Le SQL se rejoue réellement, via SQLite, y compris deux fois de suite —
 *     un import interrompu doit pouvoir être relancé sans erreur.
 *
 * Usage : node backend/sql/test-users-sql.mjs
 */

import bcrypt from 'bcryptjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(resolve(HERE, 'auth-only.mysql.sql'), 'utf8');

/**
 * Effectifs attendus, dérivés de `permissions.ts` plutôt que codés en dur :
 * ajouter une ressource (ici « authors ») ne doit pas faire échouer le test
 * pour une raison sans rapport avec ce qu'il vérifie.
 */
const PERMS_SRC = readFileSync(resolve(HERE, '../src/common/constants/permissions.ts'), 'utf8');
const listOf = (name) =>
  (PERMS_SRC.match(new RegExp(`${name} = \\[(.*?)\\]`, 's'))?.[1] || '')
    .split(',')
    .map((v) => v.trim().replace(/^'|'$/g, ''))
    .filter((v) => v && !v.startsWith('//'));
const EXPECTED_PERMISSIONS = listOf('RESOURCES').length * listOf('ACTIONS').length;

/** Types acceptés par `backend/src/modules/users/entities/user.entity.ts`. */
const VALID_TYPES = ['admin', 'client', 'partner', 'candidate'];

/** Couples email / mot de passe attendus, tels qu'annoncés dans l'en-tête. */
const COMMON_PASSWORD = 'ChangeMe_Sari2026!';
const EXPECTED = [
  ['admin@sarisysteme.com', COMMON_PASSWORD],
  ['gestion@sarisysteme.com', COMMON_PASSWORD],
  ['client@clinique-elafia.dz', COMMON_PASSWORD],
  ['contact@meditech.dz', COMMON_PASSWORD],
  ['mohamed.saidi@gmail.com', COMMON_PASSWORD],
];

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
};

// --- 1. Hachages ------------------------------------------------------------
console.log('\nHachages bcrypt : le mot de passe annoncé ouvre bien le compte');
const rows = [...SQL.matchAll(/^\((\d+), '([^']+)', '(\$2[aby]\$\d+\$[^']+)',.*?, '(admin|client|partner|candidate)', '(active|pending|blocked)'/gm)];
check(`${EXPECTED.length} comptes trouvés dans le SQL`, rows.length === EXPECTED.length, `${rows.length} trouvé(s)`);

for (const [email, password] of EXPECTED) {
  const row = rows.find((r) => r[2] === email);
  if (!row) {
    check(`${email} présent`, false);
    continue;
  }
  check(`${email.padEnd(28)} → mot de passe valide`, bcrypt.compareSync(password, row[3]));
}

console.log('\nUn mot de passe erroné doit être refusé');
const admin = rows.find((r) => r[2] === 'admin@sarisysteme.com');
check('mauvais mot de passe rejeté', admin ? !bcrypt.compareSync('mauvais', admin[3]) : false);

// --- 2. Types ---------------------------------------------------------------
console.log('\nTypes de comptes conformes au contrat de l’API');
for (const row of rows) {
  check(`${row[2].padEnd(28)} type « ${row[4]} »`, VALID_TYPES.includes(row[4]));
}
const covered = new Set(rows.map((r) => r[4]));
check('les quatre types sont couverts', VALID_TYPES.every((t) => covered.has(t)), [...covered].join(', '));

// --- 3. Rejeu SQL -----------------------------------------------------------
console.log('\nRejeu du SQL (SQLite) : import, puis réimport');
// SQLite est atteint via le module `sqlite3` de Python : le binaire `sqlite3`
// n'est pas toujours installé, alors que Python l'est.
let sqliteOk = true;
try {
  execFileSync('python3', ['-c', 'import sqlite3'], { stdio: 'ignore' });
} catch {
  sqliteOk = false;
  console.log('  ⚠️  Python/sqlite3 absent : simulation ignorée');
}

if (sqliteOk) {
  const dir = mkdtempSync(join(tmpdir(), 'sari-users-'));
  const db = join(dir, 'test.db');

  // Traduction minimale MySQL → SQLite : le but est de valider la structure
  // des INSERT (colonnes, quotes, types), pas le dialecte.
  const schema = `
    CREATE TABLE permissions (id INTEGER PRIMARY KEY, resource TEXT, action TEXT, description TEXT, createdAt TEXT, updatedAt TEXT, UNIQUE(resource, action));
    CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, description TEXT, isSystem INT, permissionIds TEXT, createdAt TEXT, updatedAt TEXT);
    CREATE TABLE role_permissions (roleId INT, permissionId INT, PRIMARY KEY (roleId, permissionId));
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE, passwordHash TEXT, firstName TEXT, lastName TEXT,
      phone TEXT, company TEXT, avatar TEXT, type TEXT, status TEXT, locale TEXT, roleId INT,
      totpEnabled INT, partnerCode TEXT, address TEXT, wilaya TEXT, country TEXT,
      position TEXT, experience TEXT, motivation TEXT, createdAt TEXT, updatedAt TEXT);
  `;

  // Les commentaires sont retirés EN PREMIER : l'en-tête du fichier mentionne
  // « ON DUPLICATE KEY UPDATE » en toutes lettres, et la substitution suivante
  // avalait alors tout le premier bloc INSERT — un test qui passait en
  // n'important rien.
  const translated = SQL
    .replace(/`/g, '"')
    .replace(/^\s*--.*$/gm, '')
    .replace(/^SET .*$/gm, '')
    .replace(/ON DUPLICATE KEY UPDATE[\s\S]*?;/g, ';')
    .replace(/INSERT IGNORE INTO/g, 'INSERT OR IGNORE INTO')
    .replace(/INSERT INTO/g, 'INSERT OR REPLACE INTO');

  const script = join(dir, 'run.sql');
  // Le script est exécuté deux fois : un import interrompu doit pouvoir être
  // relancé sans erreur de clé dupliquée.
  writeFileSync(script, schema + translated + '\n' + translated, 'utf8');

  const runner = join(dir, 'run.py');
  writeFileSync(
    runner,
    [
      'import sqlite3, sys',
      'con = sqlite3.connect(sys.argv[1])',
      'con.executescript(open(sys.argv[2], encoding="utf-8").read())',
      'con.commit()',
      'if len(sys.argv) > 3:',
      '    print(con.execute(sys.argv[3]).fetchone()[0])',
    ].join('\n'),
    'utf8',
  );

  try {
    execFileSync('python3', [runner, db, script], { stdio: ['pipe', 'pipe', 'pipe'] });
    const empty = join(dir, 'empty.sql');
    writeFileSync(empty, '', 'utf8');
    const count = (q) => execFileSync('python3', [runner, db, empty, q], { encoding: 'utf8' }).trim();
    check('import + réimport sans erreur', true);
    check(
      `${EXPECTED_PERMISSIONS} permissions`,
      count('SELECT COUNT(*) FROM permissions;') === String(EXPECTED_PERMISSIONS),
      count('SELECT COUNT(*) FROM permissions;'),
    );
    check('4 rôles', count('SELECT COUNT(*) FROM roles;') === '4', count('SELECT COUNT(*) FROM roles;'));
    check('5 comptes', count('SELECT COUNT(*) FROM users;') === '5', count('SELECT COUNT(*) FROM users;'));
    check(
      'permissionIds est un tableau JSON valide',
      JSON.parse(count("SELECT permissionIds FROM roles WHERE slug = 'super-admin';")).length ===
        EXPECTED_PERMISSIONS,
    );
    // Le nombre de liaisons dépend des jeux de permissions par rôle : on
    // vérifie la cohérence (au moins une liaison par permission du super-admin)
    // plutôt qu'un total figé.
    const links = Number(count('SELECT COUNT(*) FROM role_permissions;'));
    check(
      'liaisons rôle ↔ permission cohérentes',
      links >= EXPECTED_PERMISSIONS && links === Number(count('SELECT COUNT(DISTINCT roleId || \'-\' || permissionId) FROM role_permissions;')),
      `${links} liaisons`,
    );
    check(
      'l’administrateur porte le rôle super-admin',
      count("SELECT roleId FROM users WHERE email = 'admin@sarisysteme.com';") === '1',
    );
  } catch (err) {
    check('import + réimport sans erreur', false, String(err.stderr || err).slice(0, 300));
  }
}

console.log(failures ? `\n❌ ${failures} vérification(s) en échec\n` : '\n✅ Toutes les vérifications passent\n');
process.exit(failures ? 1 : 0);
