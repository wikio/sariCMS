#!/usr/bin/env node
/**
 * Contrôle des menus réellement servis, langue par langue.
 *
 *   node scripts/check-menus.mjs
 *   node scripts/check-menus.mjs --url https://mon-site.tld
 *   node scripts/check-menus.mjs --api  http://localhost:3001/api/v1
 *
 * Ce script interroge un serveur en marche : il ne relit pas le code source et
 * ne réimplémente aucune logique. Il répond à trois questions concrètes :
 *
 *   1. D'où vient le menu de chaque langue — base de données ou fichier de
 *      repli ? C'est la cause habituelle de menus différents d'une langue à
 *      l'autre : enregistrer depuis l'admin ne crée le menu que pour la langue
 *      éditée, les autres continuant d'afficher le fichier statique.
 *
 *   2. Les trois langues ont-elles la même structure — mêmes entrées, même
 *      ordre, mêmes sous-menus ?
 *
 *   3. Reste-t-il des sous-menus vides ? Un tableau vide est vrai en
 *      JavaScript : il produit un chevron et un panneau déroulant vide.
 *
 * Sortie : un tableau par langue, la liste des écarts, puis un code de sortie
 * non nul si un problème est détecté (utilisable en intégration continue).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* -------------------------------------------------------------- arguments */

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
};

/*
 * Certaines versions de npm avalent les options et ne transmettent que les
 * valeurs : « npm run menus:check -- --api X --url Y » arrive alors comme
 * ['X', 'Y']. Plutôt que de perdre silencieusement les arguments, on
 * reconnaît les URL nues à leur forme : celle qui porte un chemin d'API est
 * l'API, l'autre est le site.
 */
const nus = argv.filter((a) => /^https?:\/\//.test(a) && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const estApi = (u) => /\/api(\/|$)|:3001/.test(u);
const apiNu = nus.find(estApi);
const siteNu = nus.find((u) => u !== apiNu);

const API = (
  argOf('api', apiNu || process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1')
).replace(/\/$/, '');
const SITE = argOf('url', siteNu || '').replace(/\/$/, '');
const LOCALES = (argOf('locales', 'fr,en,ar')).split(',').map((s) => s.trim()).filter(Boolean);

/* ---------------------------------------------------------------- couleurs */

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' }
  : { r: '', g: '', y: '', b: '', d: '', x: '' };

const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`${C.b}${s}${C.x}`); line('─'.repeat(s.length)); };

let problems = 0;
const fail = (s) => { problems += 1; line(`  ${C.r}✗${C.x} ${s}`); };
const ok = (s) => line(`  ${C.g}✓${C.x} ${s}`);
const warn = (s) => line(`  ${C.y}!${C.x} ${s}`);

/* ------------------------------------------------------------------ réseau */

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Lignes de menu servies par l'API publique pour une langue. */
async function apiMenus(locale) {
  const url = `${API}/public/menus?view=block&limit=100&locale=${encodeURIComponent(locale)}`;
  try {
    const payload = await getJson(url);
    const rows = payload?.data?.data ?? payload?.data ?? payload ?? [];
    return { rows: Array.isArray(rows) ? rows : [], error: null };
  } catch (err) {
    return { rows: [], error: err.message };
  }
}

/** Menu de repli livré avec le code, pour la même langue. */
function staticMenu(locale) {
  const path = join(ROOT, 'data', locale, 'menu.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- inspection */

const EMPLACEMENTS = [
  ['main', 'Menu principal'],
  ['footer-nav', 'Pied — navigation'],
  ['footer-legal', 'Pied — légal'],
];

/** Empreinte d'une liste d'entrées : ids et taille des sous-menus. */
function shapeOf(items) {
  return (items || [])
    .map((it) => `${it.id ?? '?'}:${Array.isArray(it.submenu) ? it.submenu.length : (it.auto ? 'auto' : 0)}`)
    .join(', ');
}

/** Entrées dont le sous-menu est un tableau vide : chevron fantôme garanti. */
function emptySubmenus(items) {
  return (items || [])
    .filter((it) => Array.isArray(it.submenu) && it.submenu.length === 0 && !it.auto)
    .map((it) => it.id ?? it.label ?? '?');
}

const report = {};

async function inspect(locale) {
  head(`Langue « ${locale} »`);
  const { rows, error } = await apiMenus(locale);

  if (error) {
    fail(`API injoignable (${error}) — la vitrine affichera le menu de repli`);
  }

  const info = { source: {}, shape: {}, empties: {}, labels: {} };

  for (const [location, label] of EMPLACEMENTS) {
    const row = rows.find((r) => r.location === location);
    const items = row?.items;

    if (row && Array.isArray(items) && items.length) {
      info.source[location] = 'base';
      info.shape[location] = shapeOf(items);
      info.empties[location] = emptySubmenus(items);
      info.labels[location] = items.map((i) => i.label);
      const empt = info.empties[location];
      if (empt.length) {
        fail(`${label} : ${empt.length} sous-menu(s) vide(s) → chevron sans contenu (${empt.join(', ')})`);
      } else {
        ok(`${label} : ${items.length} entrée(s), depuis la base de données`);
      }
    } else {
      const st = staticMenu(locale);
      const fromStatic =
        location === 'main' ? st?.mainMenu
        : location === 'footer-nav' ? st?.footerMenu?.navigation
        : st?.footerMenu?.legal;
      info.source[location] = fromStatic?.length ? 'repli' : 'vide';
      info.shape[location] = shapeOf(fromStatic);
      info.empties[location] = emptySubmenus(fromStatic);
      info.labels[location] = (fromStatic || []).map((i) => i.label);
      if (fromStatic?.length) {
        warn(`${label} : aucun menu en base → repli statique (${fromStatic.length} entrée(s))`);
      } else {
        fail(`${label} : aucun menu, ni en base ni en repli`);
      }
    }
  }

  report[locale] = info;
}

/* ------------------------------------------------------------ comparaisons */

function compareLocales() {
  head('Cohérence entre les langues');
  const locs = Object.keys(report);
  if (locs.length < 2) return;
  const ref = locs[0];

  for (const [location, label] of EMPLACEMENTS) {
    const shapes = locs.map((l) => [l, report[l].shape[location] || '']);
    const differing = shapes.filter(([, s]) => s !== shapes[0][1]);

    if (!differing.length) {
      ok(`${label} : structure identique dans ${locs.join(', ')}`);
      continue;
    }
    fail(`${label} : structures différentes`);
    for (const [l, s] of shapes) {
      const src = report[l].source[location];
      line(`      ${C.d}${l} (${src})${C.x} ${s || '(vide)'}`);
    }
  }

  // Une langue servie depuis le repli alors qu'une autre vient de la base est
  // la cause la plus fréquente de menus divergents.
  for (const [location, label] of EMPLACEMENTS) {
    const sources = locs.map((l) => report[l].source[location]);
    if (sources.includes('base') && sources.includes('repli')) {
      const missing = locs.filter((l) => report[l].source[location] !== 'base');
      fail(
        `${label} : enregistré en base pour ${locs.filter((l) => report[l].source[location] === 'base').join(', ')} ` +
        `mais pas pour ${missing.join(', ')} — utilisez « Copier vers les autres langues » dans l'éditeur`,
      );
    }
  }

  // Des libellés identiques entre deux langues signalent une copie non traduite.
  head('Libellés');
  for (const [location, label] of EMPLACEMENTS) {
    for (let i = 1; i < locs.length; i += 1) {
      const a = report[ref].labels[location] || [];
      const b = report[locs[i]].labels[location] || [];
      if (!a.length || a.length !== b.length) continue;
      const same = a.filter((v, idx) => v && v === b[idx]);
      if (same.length === a.length) {
        warn(`${label} : ${ref} et ${locs[i]} ont des libellés identiques — traduction à faire`);
      }
    }
  }
}

/* ------------------------------------------------- rendu réel des pages web */

async function checkPages() {
  if (!SITE) return;
  head('Pages rendues');
  for (const locale of LOCALES) {
    const url = `${SITE}/${locale}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const html = await res.text();
      const chevrons = (html.match(/lucide-chevron-down/g) || []).length;
      const withSub = Object.values(report[locale]?.shape || {})
        .join(' ')
        .split(', ')
        .filter((s) => s && !/:0$/.test(s)).length;
      if (!res.ok) {
        fail(`${url} → HTTP ${res.status}`);
        continue;
      }
      // Le header rend la navigation deux fois (bureau et mobile).
      const expected = withSub * 2;
      if (chevrons > expected) {
        fail(`${url} : ${chevrons} chevron(s) pour ${withSub} entrée(s) à sous-menu (attendu ≈ ${expected})`);
      } else {
        ok(`${url} : ${chevrons} chevron(s), cohérent avec ${withSub} entrée(s) à sous-menu`);
      }
    } catch (err) {
      fail(`${url} injoignable (${err.message})`);
    }
  }
}

/* -------------------------------------------------------------------- main */

line(`${C.b}Contrôle des menus servis${C.x}`);
line(`API  : ${API}`);
if (SITE) line(`Site : ${SITE}`);
line(`Langues : ${LOCALES.join(', ')}`);

for (const locale of LOCALES) {
  // eslint-disable-next-line no-await-in-loop
  await inspect(locale);
}
compareLocales();
await checkPages();

head('Visibilité du pied de page');
line(`  ${C.d}Les interrupteurs de Administration → Visibilité sont enregistrés dans`);
line(`  le navigateur (localStorage), pas en base : ils s'appliquent donc à`);
line(`  toutes les langues à la fois, et seulement sur le poste où ils ont été`);
line(`  modifiés. Un lien masqué disparaît aussi de la version arabe.${C.x}`);
line(`  ${C.d}Clés concernées : footer.<id> et page.<id> / module.<id>.${C.x}`);

line();
if (problems) {
  line(`${C.r}${problems} problème(s) détecté(s).${C.x}`);
  process.exit(1);
}
line(`${C.g}Aucun problème détecté.${C.x}`);
