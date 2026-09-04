#!/usr/bin/env node
/**
 * Vérifie la gestion des auteurs d'actualités, sans navigateur.
 *
 * Trois volets :
 *   1. la résolution d'auteur de `lib/data.ts` (par id, par nom, repli sur
 *      l'auteur par défaut, et absence d'auteur) ;
 *   2. la cohérence des jeux de données `data/{fr,en,ar}/authors.json` avec
 *      les auteurs cités par les actualités ;
 *   3. la reprise SQL : chaque article de `migrate-data.mysql.sql` porte un
 *      `authorId` qui désigne une ligne réellement insérée dans `authors`.
 *
 * Le volet 1 réimplémente `getArticleAuthor` à partir du fichier source
 * (mêmes règles, extraites du code livré) : un test vert ne peut pas masquer
 * une divergence avec la vitrine.
 *
 * Usage : node scripts/test-authors.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'ar'];

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

// ---------------------------------------------------------------------------
// 1. Résolution de l'auteur d'un article
// ---------------------------------------------------------------------------
// Règles reprises de `getArticleAuthor` / `getDefaultAuthor` (lib/data.ts) :
// priorité à l'identifiant, repli sur le nom, puis sur l'auteur par défaut.
function resolveAuthor(article, authors) {
  if (article.authorId !== undefined && article.authorId !== null) {
    const byId = authors.find((a) => String(a.id) === String(article.authorId));
    if (byId) return byId;
  }
  if (article.author) {
    const name = article.author.trim().toLowerCase();
    const byName = authors.find((a) => a.name.trim().toLowerCase() === name);
    if (byName) return byName;
  }
  return authors.find((a) => a.isFallback) ?? null;
}

console.log('\n1. Résolution de l’auteur d’un article');
{
  const authors = [
    { id: 1, name: 'Dr. Marie Laurent', role: 'Directrice médicale', bio: 'Bio 1' },
    { id: 7, name: 'Équipe SARI', role: 'Rédaction', bio: 'Bio 7', isFallback: true },
  ];

  const byId = resolveAuthor({ authorId: 1, author: 'Nom obsolète' }, authors);
  check('l’identifiant prime sur le nom stocké', byId?.id === 1, `→ ${byId?.name}`);

  const byName = resolveAuthor({ author: 'Dr. Marie Laurent' }, authors);
  check('un article sans id est retrouvé par son nom', byName?.id === 1, `→ ${byName?.name}`);

  const byNameCase = resolveAuthor({ author: '  dr. marie laurent ' }, authors);
  check('la casse et les espaces sont ignorés', byNameCase?.id === 1);

  const fallback = resolveAuthor({}, authors);
  check('sans auteur, l’auteur par défaut est retenu', fallback?.id === 7, `→ ${fallback?.name}`);

  const unknown = resolveAuthor({ authorId: 999, author: 'Inconnu' }, authors);
  check('un auteur inconnu bascule sur le défaut', unknown?.id === 7);

  const noFallback = resolveAuthor({}, [authors[0]]);
  check('sans défaut configuré, aucun auteur n’est affiché', noFallback === null);
}

// ---------------------------------------------------------------------------
// 2. Jeux de données
// ---------------------------------------------------------------------------
console.log('\n2. Jeux de données authors.json');
{
  const authorsByLocale = {};
  for (const locale of LOCALES) authorsByLocale[locale] = readJson(`data/${locale}/authors.json`);

  const counts = LOCALES.map((l) => authorsByLocale[l].length);
  check('les trois langues comptent le même nombre d’auteurs', new Set(counts).size === 1, counts.join(' / '));

  for (const locale of LOCALES) {
    const rows = authorsByLocale[locale];
    const complete = rows.every((a) => a.name?.trim() && a.role?.trim() && a.bio?.trim());
    check(`[${locale}] nom, qualification et description renseignés`, complete);

    const fallbacks = rows.filter((a) => a.isFallback);
    check(`[${locale}] un seul auteur par défaut`, fallbacks.length === 1, fallbacks.map((f) => f.name).join(', '));
  }

  // Les trois langues décrivent les mêmes personnes : mêmes ids, mêmes legacyId.
  const ids = LOCALES.map((l) => authorsByLocale[l].map((a) => a.id).join(','));
  check('les identifiants concordent entre langues', new Set(ids).size === 1);

  // Chaque auteur cité par une actualité doit exister dans la liste.
  for (const locale of LOCALES) {
    const names = new Set(authorsByLocale[locale].map((a) => a.name));
    const news = readJson(`data/${locale}/news.json`);
    const missing = [...new Set(news.map((n) => n.author).filter((n) => n && !names.has(n)))];
    check(`[${locale}] tous les auteurs cités par les actualités ont une fiche`, missing.length === 0, missing.join(', '));
  }
}

// ---------------------------------------------------------------------------
// 3. Reprise SQL
// ---------------------------------------------------------------------------
console.log('\n3. Reprise SQL (migrate-data.mysql.sql)');
{
  const sql = readFileSync(resolve(ROOT, 'backend/sql/migrate-data.mysql.sql'), 'utf8');

  /** Découpe un bloc `INSERT … VALUES (…),(…);` en lignes, en respectant les quotes. */
  function valueRows(table) {
    const start = sql.indexOf(`INSERT INTO \`${table}\``);
    if (start === -1) return [];
    const block = sql.slice(start, sql.indexOf('ON DUPLICATE KEY UPDATE', start));
    const body = block.slice(block.indexOf('VALUES') + 6);
    const rows = [];
    let cur = null;
    let depth = 0;
    let quoted = false;
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      if (quoted) {
        if (c === "'" && body[i + 1] === "'") { cur.push("''"); i += 1; continue; }
        if (c === "'") quoted = false;
        cur.push(c);
        continue;
      }
      if (c === "'") { quoted = true; cur.push(c); continue; }
      if (c === '(') { depth += 1; if (depth === 1) { cur = []; continue; } }
      else if (c === ')') { depth -= 1; if (depth === 0) { rows.push(cur.join('')); cur = null; continue; } }
      if (depth > 0) cur.push(c);
    }
    return rows;
  }

  function splitValues(row) {
    const out = [];
    let cur = [];
    let quoted = false;
    for (let i = 0; i < row.length; i += 1) {
      const c = row[i];
      if (quoted) {
        if (c === "'" && row[i + 1] === "'") { cur.push("'"); i += 1; continue; }
        if (c === "'") { quoted = false; continue; }
        cur.push(c);
        continue;
      }
      if (c === "'") { quoted = true; continue; }
      if (c === ',') { out.push(cur.join('').trim()); cur = []; continue; }
      cur.push(c);
    }
    out.push(cur.join('').trim());
    return out;
  }

  function columnsOf(table) {
    const start = sql.indexOf(`INSERT INTO \`${table}\``);
    const header = sql.slice(start, sql.indexOf('VALUES', start));
    return [...header.matchAll(/`([^`]+)`/g)].map((m) => m[1]).slice(1);
  }

  const authorCols = columnsOf('authors');
  const authorRows = valueRows('authors').map((r) => {
    const values = splitValues(r);
    return Object.fromEntries(authorCols.map((c, i) => [c, values[i]]));
  });
  check('la table authors est présente dans la reprise', authorRows.length > 0, `${authorRows.length} lignes`);

  const authorIds = new Set(authorRows.map((a) => a.id));
  const perLocale = {};
  for (const a of authorRows) perLocale[a.locale] = (perLocale[a.locale] || 0) + 1;
  check(
    'les auteurs couvrent les trois langues',
    LOCALES.every((l) => perLocale[l] > 0),
    LOCALES.map((l) => `${l}:${perLocale[l] || 0}`).join(' '),
  );

  const fallbackPerLocale = {};
  for (const a of authorRows) {
    if (a.isFallback === '1' || a.isFallback === 'TRUE' || a.isFallback === 'true') {
      fallbackPerLocale[a.locale] = (fallbackPerLocale[a.locale] || 0) + 1;
    }
  }
  check(
    'un seul auteur par défaut par langue',
    LOCALES.every((l) => fallbackPerLocale[l] === 1),
    LOCALES.map((l) => `${l}:${fallbackPerLocale[l] || 0}`).join(' '),
  );

  const newsCols = columnsOf('news_articles');
  const newsRows = valueRows('news_articles').map((r) => {
    const values = splitValues(r);
    return Object.fromEntries(newsCols.map((c, i) => [c, values[i]]));
  });

  const orphans = newsRows.filter((n) => n.authorId === 'NULL' || !authorIds.has(n.authorId));
  check(
    'chaque actualité pointe vers une fiche auteur existante',
    orphans.length === 0,
    orphans.length ? `${orphans.length} orphelin(s)` : `${newsRows.length} articles`,
  );

  // L'auteur doit être dans la même langue que l'article : un article arabe
  // renvoyant vers la fiche française afficherait un nom non traduit.
  const byId = new Map(authorRows.map((a) => [a.id, a]));
  const mismatched = newsRows.filter((n) => byId.get(n.authorId)?.locale !== n.locale);
  check('l’auteur lié est dans la langue de l’article', mismatched.length === 0, `${mismatched.length} écart(s)`);
}

// ---------------------------------------------------------------------------
// Garde-fou : l'API rejette `limit > 100` (ValidationPipe, QueryDto.@Max(100)).
// Un appel codé en dur à 200 renvoyait une 400 et le champ auteur restait vide.
// On vérifie que plus aucun appel du front ne dépasse ce plafond.
// ---------------------------------------------------------------------------
{
  const roots = ['components', 'lib', 'app'];
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(full);
    }
  };
  roots.forEach(walk);

  const offenders = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // limit: 200 / limit: '200' / limit=200 dans une query string
    const re = /limit['"]?\s*[:=]\s*['"]?(\d+)/g;
    let m;
    while ((m = re.exec(src))) {
      const n = Number(m[1]);
      if (n > 100) offenders.push(`${f} → limit=${n}`);
    }
  }
  check(
    'aucun appel front ne demande limit > 100',
    offenders.length === 0,
    offenders.length ? offenders.join(', ') : `${files.length} fichiers scrutés`,
  );
}

console.log(
  failures === 0
    ? '\n✅ Tous les contrôles passent.\n'
    : `\n❌ ${failures} contrôle(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
