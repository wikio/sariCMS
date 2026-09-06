#!/usr/bin/env node
/**
 * Crée `backend/.env` pour une utilisation avec MySQL.
 *
 * Pourquoi
 * --------
 * Le dépôt ne fournit que `.env.example` — `.env` est ignoré par git, il
 * n'existe donc pas après un clone et l'API démarre sans configuration. De
 * plus, l'exemple propose `DB_DRIVER=json` : même avec une base MySQL remplie,
 * l'API lit alors les fichiers de `storage/json` et ignore la base.
 *
 * Ce script part de `.env.example`, bascule le pilote sur MySQL, applique les
 * paramètres de connexion fournis et remplace les deux secrets JWT par des
 * valeurs aléatoires (l'exemple contient « change-me-… », refusé en production
 * et trivial à forger en développement).
 *
 * Usage :
 *   node backend/sql/setup-env.mjs --user root --password secret --database sari_cms
 *   node backend/sql/setup-env.mjs --url "mysql://sari:sari@127.0.0.1:3306/sari_cms"
 *   node backend/sql/setup-env.mjs --driver json      # revenir au mode fichiers
 *
 * Options : --host --port --user --password --database --url --driver --force
 */

import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(HERE, '..');
const EXAMPLE = resolve(BACKEND, '.env.example');
const TARGET = resolve(BACKEND, '.env');

// --- Lecture des options ----------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const opts = {
  host: flag('host', '127.0.0.1'),
  port: flag('port', '3306'),
  user: flag('user', 'root'),
  password: flag('password', ''),
  database: flag('database', 'sari_cms'),
  url: flag('url'),
  driver: flag('driver', 'mysql'),
  force: has('force'),
};

if (!existsSync(EXAMPLE)) {
  console.error(`❌ ${EXAMPLE} introuvable.`);
  process.exit(1);
}

if (existsSync(TARGET) && !opts.force) {
  console.error(
    `❌ ${TARGET} existe déjà.\n` +
      `   Relancez avec --force pour l'écraser (une copie .env.bak sera conservée).`,
  );
  process.exit(1);
}

// --- Construction de l'URL de connexion ------------------------------------
/** Encode les identifiants : un mot de passe contenant @ ou : casse l'URL. */
const databaseUrl =
  opts.url ||
  `mysql://${encodeURIComponent(opts.user)}:${encodeURIComponent(opts.password)}` +
    `@${opts.host}:${opts.port}/${opts.database}`;

const secret = () => randomBytes(48).toString('hex');

let content = readFileSync(EXAMPLE, 'utf8');

const setVar = (key, value) => {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`;
};

setVar('DB_DRIVER', opts.driver);
if (opts.driver === 'mysql' || opts.driver === 'postgres') {
  setVar('DATABASE_URL', `"${databaseUrl}"`);
}
setVar('JWT_ACCESS_SECRET', secret());
setVar('JWT_REFRESH_SECRET', secret());

if (existsSync(TARGET)) copyFileSync(TARGET, `${TARGET}.bak`);
writeFileSync(TARGET, content, 'utf8');

// L'URL est réaffichée sans le mot de passe : ce script est souvent lancé
// devant témoin ou dans un journal de CI.
const masked = databaseUrl.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');

console.log(`✅ ${TARGET} créé`);
console.log(`   DB_DRIVER    = ${opts.driver}`);
if (opts.driver === 'mysql' || opts.driver === 'postgres') {
  console.log(`   DATABASE_URL = ${masked}`);
}
console.log('   JWT_ACCESS_SECRET / JWT_REFRESH_SECRET = générés aléatoirement');
console.log('\nÉtapes suivantes :');
console.log('   cd backend && npm install');
console.log('   npx prisma generate');
console.log('   npm run start:dev');
