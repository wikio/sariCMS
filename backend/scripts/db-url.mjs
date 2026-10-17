// backend/scripts/db-url.mjs
/**
 * La chaîne de connexion MySQL des scripts d'atelier.
 *
 * Trois sources, dans cet ordre, parce que les trois se présentent : l'option
 * `--url` (un prestataire répare une base qui n'est pas la sienne), l'environnement
 * (le conteneur, le CI), puis `backend/.env` — le fichier que le CMS lit lui-même,
 * et donc celui qui a raison sur la machine de travail.
 *
 * Le parseur est volontairement minimal : `backend/.env` est écrit par
 * `sql/setup-env.mjs`, une clé par ligne, sans guillemets imbriqués ni
 * multiline. Un `dotenv` complet serait une dépendance pour trois lignes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** @param {string[]} argv */
export function readDatabaseUrl(argv = process.argv) {
  const at = argv.indexOf('--url');
  if (at !== -1 && argv[at + 1]) return argv[at + 1].trim();
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  return fromEnvFile(path.join(HERE, '../.env'));
}

export function fromEnvFile(envFile) {
  if (!fs.existsSync(envFile)) return null;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    return m[1].trim().replace(/^["']|["']$/g, '') || null;
  }
  return null;
}

/** `mysql://…` seulement : ces scripts écrivent du SQL dialecte MySQL. */
export function looksLikeMysql(url) {
  return /^mysql(qlx)?:\/\//i.test(String(url || ''));
}

/** Le nom de la base visée, pour que les rapports disent où ils regardent. */
export function databaseName(url) {
  const m = /^mysql(?:lx)?:\/\/[^/]*\/([^?#]+)/i.exec(String(url || ''));
  return m ? m[1] : '(inconnue)';
}
