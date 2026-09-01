#!/usr/bin/env node
/**
 * Ajoute `slug` et `legacyId` aux jeux de données `data/{fr,en,ar}/*.json`.
 *
 * Deux champs, deux rôles distincts :
 *
 *   slug     — lisible, propre à la langue, alimente l'URL `/{locale}/{module}/{id}-{slug}`
 *   legacyId — identique dans les trois langues, relie les versions d'une même fiche
 *
 * Le `legacyId` est la pièce qui permet au sélecteur de langue de retrouver
 * l'identifiant de la fiche dans la langue cible. Sans lui, la vitrine
 * conserve l'id courant, qui désigne une autre fiche (ou rien) ailleurs.
 * Les jeux JSON alignent déjà leurs ids entre langues : on s'en sert comme
 * clé de regroupement, ce qui rend la reprise déterministe et rejouable.
 *
 * Usage :
 *   node scripts/add-slugs.mjs           # écrit les fichiers
 *   node scripts/add-slugs.mjs --dry-run # affiche sans rien modifier
 *   node scripts/add-slugs.mjs --force   # recalcule même les slugs existants
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'ar'];

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

/**
 * Modules à traiter : fichier, préfixe du legacyId, et champ portant le
 * libellé (les produits et partenaires utilisent `name`, pas `title`).
 */
const MODULES = [
  { file: 'services.json', prefix: 'svc', label: 'title' },
  { file: 'solution-categories.json', prefix: 'sol', label: 'title' },
  { file: 'products.json', prefix: 'prd', label: 'name' },
  { file: 'news.json', prefix: 'news', label: 'title' },
  { file: 'events.json', prefix: 'evt', label: 'title' },
  { file: 'careers.json', prefix: 'job', label: 'title' },
  { file: 'partners.json', prefix: 'ptr', label: 'name' },
  { file: 'testimonials.json', prefix: 'tst', label: 'name' },
  { file: 'genericContent.json', prefix: 'pag', label: 'title' },
];

/**
 * Même règle que `slugify()` côté backend (common/crud/query.util.ts) :
 * les accents latins sont dépliés, l'alphabet arabe est conservé tel quel.
 * Un slug arabe translittéré serait illisible et casserait le référencement
 * local ; `\p{L}` autorise donc l'arabe dans l'URL, que les navigateurs
 * encodent en pourcent de façon transparente.
 */
function slugify(input) {
  const text = String(input ?? '')
    // Élisions françaises : « Vente d'Équipements » doit donner
    // « vente-equipements » et non « vente-d-equipements ». On supprime
    // l'article élidé plutôt que de le transformer en tiret parasite.
    .replace(/\b([cdjlmnst]|qu|jusqu|lorsqu|puisqu)['’]/gi, '')
    // Apostrophe résiduelle (anglais : « world's ») : soudée, pas coupée.
    .replace(/['’]/g, '');
  const hasLatin = /[a-zA-Z]/.test(text);
  const base = hasLatin ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : text;
  return base
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Garantit l'unicité du slug dans une même langue (`-2`, `-3`, …). */
function unique(slug, taken, fallback) {
  let candidate = slug || fallback;
  if (!taken.has(candidate)) {
    taken.add(candidate);
    return candidate;
  }
  let n = 2;
  while (taken.has(`${candidate}-${n}`)) n += 1;
  const out = `${candidate}-${n}`;
  taken.add(out);
  return out;
}

const summary = [];

for (const mod of MODULES) {
  const perLocale = {};
  let present = true;

  for (const locale of LOCALES) {
    const path = resolve(ROOT, 'data', locale, mod.file);
    if (!existsSync(path)) {
      present = false;
      break;
    }
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(rows)) {
      present = false;
      break;
    }
    perLocale[locale] = { path, rows };
  }
  if (!present) {
    summary.push({ file: mod.file, skipped: 'absent ou format inattendu' });
    continue;
  }

  let added = 0;
  let kept = 0;

  for (const locale of LOCALES) {
    const { path, rows } = perLocale[locale];
    const taken = new Set();

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      // legacyId : dérivé de l'id, donc identique dans les trois langues
      // puisque les jeux JSON partagent leurs identifiants.
      const legacy = `${mod.prefix}-${row.id}`;
      if (FORCE || !row.legacyId) row.legacyId = legacy;

      if (!FORCE && row.slug) {
        taken.add(String(row.slug));
        kept += 1;
        continue;
      }

      const label = row[mod.label] ?? row.title ?? row.name ?? '';
      row.slug = unique(slugify(label), taken, String(row.id));
      added += 1;
    }

    // `slug` et `legacyId` remontent juste après `id` : à la relecture d'un
    // diff, l'identité d'une fiche se lit d'un seul coup d'œil.
    const reordered = rows.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const { id, slug, legacyId, ...rest } = row;
      return { id, slug, legacyId, ...rest };
    });

    if (!DRY) {
      writeFileSync(path, `${JSON.stringify(reordered, null, 2)}\n`, 'utf8');
    }
    perLocale[locale].rows = reordered;
  }

  // Contrôle : une même fiche doit porter le même legacyId dans les 3 langues.
  const groups = new Map();
  for (const locale of LOCALES) {
    for (const row of perLocale[locale].rows) {
      if (!row?.legacyId) continue;
      if (!groups.has(row.legacyId)) groups.set(row.legacyId, new Set());
      groups.get(row.legacyId).add(locale);
    }
  }
  const incomplete = [...groups.entries()].filter(([, set]) => set.size !== LOCALES.length);

  summary.push({
    file: mod.file,
    added,
    kept,
    groups: groups.size,
    incomplete: incomplete.length,
    sample: perLocale.fr.rows[0]?.slug,
    sampleAr: perLocale.ar.rows[0]?.slug,
  });
}

console.log(DRY ? '— SIMULATION (aucune écriture) —\n' : '— Fichiers mis à jour —\n');
for (const s of summary) {
  if (s.skipped) {
    console.log(`  ${s.file.padEnd(26)} ignoré : ${s.skipped}`);
    continue;
  }
  const warn = s.incomplete ? `  ⚠️ ${s.incomplete} groupe(s) incomplet(s)` : '';
  console.log(
    `  ${s.file.padEnd(26)} +${String(s.added).padStart(3)} slugs, ` +
      `${String(s.kept).padStart(3)} conservés, ${s.groups} fiches liées${warn}`,
  );
  if (s.sample) console.log(`     ex. fr « ${s.sample} »   ar « ${s.sampleAr} »`);
}
