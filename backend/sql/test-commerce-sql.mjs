#!/usr/bin/env node
/**
 * Vérifie la migration `migrate-commerce.mysql.sql` sans serveur MySQL.
 *
 * Ce fichier crée les tables `orders`, `quotes` et `job_applications`, qui
 * n'existaient pas : commandes, devis et candidatures ne vivaient que dans le
 * localStorage du navigateur.
 *
 * Contrôles :
 *  1. La migration est purement additive (aucun DROP) — elle doit pouvoir
 *     s'appliquer sur une base de production sans rien détruire.
 *  2. Elle est rejouable : deux exécutations de suite ne doivent pas échouer.
 *  3. Les colonnes couvrent bien les champs manipulés par les écrans.
 *  4. Les clés étrangères pointent vers `users` et `careers`.
 *  5. Les montants tiennent sur DECIMAL(14,2) — DECIMAL(10,2) plafonnait à
 *     99 999 999,99, trop peu pour une commande en DZD.
 *
 * Usage : node backend/sql/test-commerce-sql.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(resolve(HERE, 'migrate-commerce.mysql.sql'), 'utf8');

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
check('utilise CREATE TABLE IF NOT EXISTS', (statements.match(/CREATE TABLE IF NOT EXISTS/g) || []).length === 3);

// ---------------------------------------------------------------------------
console.log('\n2. Colonnes attendues par les écrans');
const EXPECTED = {
  orders: ['id', 'code', 'userId', 'client', 'email', 'phone', 'company', 'date', 'status',
    'total', 'cost', 'currency', 'items', 'address', 'payment', 'paid', 'coupon',
    'quoteId', 'zone', 'ip', 'history', 'invoice'],
  quotes: ['id', 'reference', 'userId', 'client', 'email', 'date', 'status', 'total',
    'validity', 'items', 'coupon', 'orderId', 'nature', 'natureOther', 'note',
    'desiredDate', 'address', 'country', 'attachments', 'response', 'history'],
  job_applications: ['id', 'reference', 'userId', 'careerId', 'candidate', 'email', 'phone',
    'jobTitle', 'status', 'date', 'experience', 'motivation', 'rating',
    'score', 'note', 'cv', 'lm', 'history'],
};
for (const [table, cols] of Object.entries(EXPECTED)) {
  const block = SQL.match(new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '` \\(([\\s\\S]*?)\\n\\) ENGINE'));
  if (!block) {
    check(`table ${table} présente`, false);
    continue;
  }
  const present = [...block[1].matchAll(/^\s+`(\w+)`/gm)].map((m) => m[1]);
  const missing = cols.filter((c) => !present.includes(c));
  check(`${table} : ${cols.length} colonnes attendues`, missing.length === 0, `manquantes : ${missing.join(', ')}`);
}

// ---------------------------------------------------------------------------
console.log('\n3. Intégrité référentielle et précision des montants');
check('orders → users', /orders_userId_fkey[\s\S]*?REFERENCES `users`/.test(SQL));
check('quotes → users', /quotes_userId_fkey[\s\S]*?REFERENCES `users`/.test(SQL));
check('job_applications → users', /job_applications_userId_fkey[\s\S]*?REFERENCES `users`/.test(SQL));
check('job_applications → careers', /job_applications_careerId_fkey[\s\S]*?REFERENCES `careers`/.test(SQL));
check('suppression d’un compte ne supprime pas la commande (SET NULL)',
  (SQL.match(/ON DELETE SET NULL/g) || []).length >= 4);
check('montants en DECIMAL(14, 2)', (SQL.match(/DECIMAL\(14, 2\)/g) || []).length === 3);
check('aucun DECIMAL(10, 2) résiduel', !/DECIMAL\(10, 2\)/.test(SQL));
check('code de commande unique', /UNIQUE KEY `orders_code_key`/.test(SQL));
check('référence de devis unique', /UNIQUE KEY `quotes_reference_key`/.test(SQL));

// ---------------------------------------------------------------------------
console.log('\n4. Exécution réelle (SQLite) et rejouabilité');
// Traduction MySQL → SQLite : le but est de valider la structure et les
// contraintes, pas la syntaxe propre au moteur.
const sqlite = SQL
  .replace(/^SET .*?;$/gm, '')
  .replace(/ENGINE=InnoDB[^;]*/g, '')
  .replace(/INT\s+NOT NULL AUTO_INCREMENT/g, 'INTEGER')
  .replace(/DATETIME\(3\)/g, 'TEXT')
  .replace(/DECIMAL\(\d+, ?\d+\)/g, 'REAL')
  .replace(/TINYINT\(1\)/g, 'INTEGER')
  .replace(/VARCHAR\((\d+)\)/g, 'TEXT')
  .replace(/\bJSON\b/g, 'TEXT')
  .replace(/\bTEXT TEXT\b/g, 'TEXT')
  .replace(/CURRENT_TIMESTAMP\(3\)/g, "CURRENT_TIMESTAMP")
  .replace(/ ON UPDATE CURRENT_TIMESTAMP/g, '')
  // SQLite ne connaît pas la syntaxe `KEY nom (cols)` dans un CREATE TABLE.
  // Les index simples sont retirés ; UNIQUE KEY devient une contrainte UNIQUE,
  // afin de continuer à vérifier le refus des doublons.
  .replace(/^\s*UNIQUE KEY `[^`]+` \(([^;]*?)\),?\s*$/gm, '  UNIQUE ($1),')
  .replace(/^\s*KEY `[^`]+` \([^;]*?\),?\s*$/gm, '')
  .replace(/PRIMARY KEY \(`id`\)/g, 'PRIMARY KEY (`id` AUTOINCREMENT)')
  .replace(/^\s*\n/gm, '\n')
  .replace(/,(\s*\n\s*)\)/g, '$1)');

const dir = mkdtempSync(join(tmpdir(), 'sari-commerce-'));
const dbPath = join(dir, 'test.db');
const scriptPath = join(dir, 'run.sql');

// Tables référencées par les clés étrangères.
const prelude = `
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE);
CREATE TABLE careers (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT);
INSERT INTO users (id, email) VALUES (1, 'client@sari.dz');
INSERT INTO careers (id, title) VALUES (1, 'Ingénieur');
`;

writeFileSync(scriptPath, prelude + sqlite + '\n' + sqlite);

const py = `
import sqlite3, sys
con = sqlite3.connect(${JSON.stringify(dbPath)})
con.execute('PRAGMA foreign_keys = ON')
con.executescript(open(${JSON.stringify(scriptPath)}, encoding='utf-8').read())
# insertion nominale
con.execute("INSERT INTO orders (code, userId, client, email, total, currency, paid, status, date) "
            "VALUES ('SARI-1', 1, 'Sonatrach', 'a@b.dz', 99999999999.99, 'DZD', 0, 'pending', '2026-01-01')")
con.execute("INSERT INTO job_applications (candidate, email, careerId, status, date) "
            "VALUES ('Amina', 'amina@b.dz', 1, 'new', '2026-01-01')")
con.commit()
tot = con.execute('SELECT total FROM orders').fetchone()[0]
print('MONTANT', tot)
# clé étrangère invalide → doit échouer
try:
    con.execute("INSERT INTO job_applications (candidate, email, careerId, status, date) "
                "VALUES ('X', 'x@b.dz', 999, 'new', '2026-01-01')")
    con.commit()
    print('FK_ENFORCED no')
except sqlite3.IntegrityError:
    print('FK_ENFORCED yes')
con.rollback()
# code de commande dupliqué → doit échouer
try:
    con.execute("INSERT INTO orders (code, client, email, total, currency, paid, status, date) "
                "VALUES ('SARI-1', 'Y', 'y@b.dz', 1, 'DZD', 0, 'pending', '2026-01-01')")
    con.commit()
    print('UNIQUE_CODE no')
except sqlite3.IntegrityError:
    print('UNIQUE_CODE yes')
con.rollback()
print('TABLES', ','.join(r[0] for r in con.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")))
`;

let out = '';
try {
  out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
} catch (err) {
  check('le SQL s’exécute', false, String(err.stderr || err.message).split('\n').slice(-4).join(' '));
}

if (out) {
  check('le SQL s’exécute deux fois de suite sans erreur', true);
  const amount = Number((out.match(/MONTANT ([\d.]+)/) || [])[1]);
  check('montant de 99 999 999 999,99 conservé', amount === 99999999999.99, `lu : ${amount}`);
  check('clés étrangères appliquées', out.includes('FK_ENFORCED yes'));
  check('code de commande dupliqué refusé', out.includes('UNIQUE_CODE yes'));
  const tables = (out.match(/TABLES (.+)/) || [])[1] || '';
  for (const t of ['orders', 'quotes', 'job_applications']) {
    check(`table ${t} créée`, tables.includes(t));
  }
}

console.log(
  failures === 0
    ? '\n✅ Migration commerce valide.\n'
    : `\n❌ ${failures} vérification(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
