#!/usr/bin/env node
/**
 * Contrôle des routes de la vitrine, langue par langue.
 *
 *   node scripts/check-routes.mjs
 *   node scripts/check-routes.mjs --url http://localhost:5000
 *
 * À quoi cela sert : un 404 sur une page qui existe pourtant dans `app/` a
 * presque toujours une cause locale — cache de développement corrompu,
 * fichier de configuration en double, ou serveur lancé depuis un autre
 * dossier. Ce script confronte l'arborescence des routes à ce que le serveur
 * répond réellement, et pointe l'écart.
 *
 * Il vérifie aussi la présence de plusieurs `next.config.*` : Next n'en charge
 * qu'un seul, sans avertir, et le second passe alors inaperçu.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const nu = argv.find((a) => /^https?:\/\//.test(a));
  return nu || fallback;
};

const SITE = argOf('url', 'http://localhost:5000').replace(/\/$/, '');
const LOCALES = argOf('locales', 'fr,en,ar').split(',').map((s) => s.trim()).filter(Boolean);

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' }
  : { r: '', g: '', y: '', b: '', d: '', x: '' };

const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`${C.b}${s}${C.x}`); line('─'.repeat(s.length)); };

let problems = 0;
const fail = (s) => { problems += 1; line(`  ${C.r}✗${C.x} ${s}`); };
const ok = (s) => line(`  ${C.g}✓${C.x} ${s}`);
const warn = (s) => line(`  ${C.y}!${C.x} ${s}`);

/* ------------------------------------------------- configuration en double */

function checkConfig() {
  head('Configuration');
  // Ordre de résolution de Next : le premier trouvé gagne, les autres sont
  // ignorés en silence.
  const ordre = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs'];
  const presents = ordre.filter((f) => existsSync(join(ROOT, f)));

  if (presents.length === 0) {
    warn('aucun next.config.* trouvé');
  } else if (presents.length === 1) {
    ok(`un seul fichier de configuration : ${presents[0]}`);
  } else {
    fail(`${presents.length} fichiers de configuration : ${presents.join(', ')}`);
    line(`      ${C.d}Next ne charge que « ${presents[0]} » et ignore les autres,${C.x}`);
    line(`      ${C.d}sans avertissement. Supprimez ceux qui ne servent pas.${C.x}`);
  }
}

/* ------------------------------------------------------- routes du disque */

/** Chemins de pages sous app/[locale], hors segments dynamiques et privés. */
function routesOnDisk() {
  const base = join(ROOT, 'app', '[locale]');
  if (!existsSync(base)) return [];

  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      // Segments dynamiques : non testables sans identifiant réel.
      if (entry.startsWith('[') || entry.startsWith('(') || entry.startsWith('_')) continue;
      const route = `${prefix}/${entry}`;
      if (existsSync(join(full, 'page.tsx')) || existsSync(join(full, 'page.ts'))) out.push(route);
      walk(full, route);
    }
  };
  walk(base, '');
  return out.sort();
}

/* ------------------------------------------------------ interrogation HTTP */

/**
 * Code HTTP, ou 0 si la requête n'aboutit pas.
 *
 * Le délai est généreux : en développement, la première visite d'une page
 * déclenche sa compilation et peut demander plusieurs secondes. Un délai trop
 * court ferait passer une page lente pour une page absente.
 */
async function status(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: ctrl.signal });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(minuteur);
  }
}

async function main() {
  line(`${C.b}Contrôle des routes${C.x}`);
  line(`Site : ${SITE}`);

  checkConfig();

  const routes = routesOnDisk();
  head('Routes déclarées dans app/[locale]');
  line(`  ${routes.length} page(s) : ${routes.slice(0, 8).map((r) => r.slice(1)).join(', ')}${routes.length > 8 ? '…' : ''}`);

  const vivant = await status(`${SITE}/${LOCALES[0]}`);
  if (!vivant) {
    head('Serveur');
    fail(`${SITE} injoignable — démarrez « npm run dev »`);
    line();
    line(`${C.r}${problems} problème(s) détecté(s).${C.x}`);
    process.exit(1);
  }

  // Une route absente dans UNE langue seulement trahit un cache partiel :
  // c'est le symptôme qu'on cherche à isoler.
  const parRoute = new Map();

  for (const locale of LOCALES) {
    head(`Langue « ${locale} »`);
    const racine = await status(`${SITE}/${locale}`);
    if (racine === 0) fail(`/${locale} sans réponse (délai dépassé)`);
    else if (racine >= 400) fail(`/${locale} → HTTP ${racine}`);
    else ok(`/${locale} → HTTP ${racine}`);

    const manquantes = [];
    const muettes = [];
    for (const route of routes) {
      const code = await status(`${SITE}/${locale}${route}`);
      const cles = parRoute.get(route) || {};
      cles[locale] = code;
      parRoute.set(route, cles);
      if (code === 404) manquantes.push(route);
      else if (code === 0) muettes.push(route);
    }
    if (manquantes.length) fail(`${manquantes.length} route(s) en 404 : ${manquantes.join(', ')}`);
    if (muettes.length) fail(`${muettes.length} route(s) sans réponse — serveur saturé ou arrêté`);
    if (!manquantes.length && !muettes.length) ok(`les ${routes.length} routes répondent`);
  }

  head('Cohérence entre les langues');
  let divergentes = 0;
  for (const [route, codes] of parRoute) {
    const valeurs = LOCALES.map((l) => codes[l]);
    const memes = valeurs.every((v) => (v === 404) === (valeurs[0] === 404));
    if (!memes) {
      divergentes += 1;
      fail(`${route} : ${LOCALES.map((l) => `${l}=${codes[l]}`).join(', ')}`);
    }
  }
  if (!divergentes) ok('toutes les routes se comportent pareil dans chaque langue');
  else {
    line(`      ${C.d}Une route qui existe sur le disque mais répond 404 dans une${C.x}`);
    line(`      ${C.d}langue seulement vient presque toujours du cache de dev.${C.x}`);
  }

  if (problems) {
    head('Que faire');
    line('  Vider le cache et relancer :');
    line(`    ${C.d}rm -rf .next  (Windows : rmdir /s /q .next)${C.x}`);
    line(`    ${C.d}npm run dev${C.x}`);
  }

  line();
  if (problems) {
    line(`${C.r}${problems} problème(s) détecté(s).${C.x}`);
    process.exit(1);
  }
  line(`${C.g}Aucun problème détecté.${C.x}`);
}

main().catch((err) => {
  console.error(`${C.r}Échec : ${err.message}${C.x}`);
  process.exit(1);
});
