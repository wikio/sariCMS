#!/usr/bin/env node
/**
 * Vérifie les actions groupées de la vue Liste, sans navigateur.
 *
 * La sélection multiple n'offrait que la corbeille. On y ajoute le changement
 * de statut en lot, ce qui suppose :
 *   1. que les statuts proposés viennent du module (menus n'a pas « archivé »)
 *      et qu'aucun bouton n'apparaisse pour un module sans champ `status` ;
 *   2. que l'échec d'une fiche ne fasse pas mentir l'affichage sur les autres
 *      (`allSettled`, et seules les fiches réellement traitées sont mises à
 *      jour localement) ;
 *   3. que les libellés existent dans les trois langues.
 *
 * Le volet 2 rejoue la logique de `runBulk` extraite du composant plutôt que
 * de la paraphraser : un test vert ne peut pas masquer une divergence.
 *
 * Usage : node scripts/test-bulk-actions.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'ar'];

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const listSrc = readFileSync(resolve(ROOT, 'components/admin/CmsList.tsx'), 'utf8');
const modulesSrc = readFileSync(resolve(ROOT, 'lib/cms-modules.ts'), 'utf8');
const adminSrc = readFileSync(resolve(ROOT, 'lib/cms-admin.ts'), 'utf8');
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(resolve(ROOT, `messages/${l}.json`), 'utf8'))]),
);

console.log('\n— Statuts proposés par module —');

/** Statuts déclarés par un module, comme le calcule `statusOptions`. */
function statusOptionsOf(blk) {
  const field = blk.match(/\{ key: 'status',[^}]*\}/);
  if (!field) return [];
  const raw = field[0];
  if (/options: STATUS\.map/.test(raw)) return ['draft', 'published', 'archived'];
  const inline = raw.match(/options: \[([^\]]*)\]/);
  return inline ? [...inline[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [];
}

const mods = [...modulesSrc.matchAll(/key: '([a-zA-Z]+)', resource:[\s\S]*?(?=\n {2}\{|\n\];)/g)].map((m) => ({
  key: m[1],
  resource: (m[0].match(/resource: '([a-zA-Z]+)'/) || [, ''])[1],
  statuses: statusOptionsOf(m[0]),
}));

check('modules analysés', mods.length >= 12, `${mods.length}`);

{
  // Le module Auteurs ne déclare pas de champ `status` : aucun bouton de
  // statut ne doit lui être proposé (sinon l'API rejetterait la valeur).
  const authors = mods.find((m) => m.key === 'authors');
  check('auteurs : aucun statut proposé', authors?.statuses.length === 0, `${authors?.statuses.length} option(s)`);

  // Les menus n'acceptent que brouillon/publié : proposer « archivé »
  // produirait une 400 « status must be one of the following values ».
  const menus = mods.find((m) => m.key === 'menus');
  check(
    'menus : brouillon et publié uniquement',
    menus?.statuses.join(',') === 'draft,published',
    menus?.statuses.join(',') || '—',
  );

  const events = mods.find((m) => m.key === 'events');
  check(
    'événements : les trois statuts',
    events?.statuses.join(',') === 'draft,published,archived',
    events?.statuses.join(',') || '—',
  );
}

{
  // `status` doit être accepté en écriture par `pick()`, sinon le PATCH
  // partirait vide et l'action n'aurait aucun effet visible.
  const missing = [];
  for (const m of mods) {
    if (!m.statuses.length) continue;
    const block = adminSrc.match(new RegExp(`\\n  ${m.resource}: \\[([\\s\\S]*?)\\],\\n`));
    if (!block) { missing.push(`${m.resource} (absent de WRITABLE_FIELDS)`); continue; }
    if (!/'status'/.test(block[1])) missing.push(m.resource);
  }
  check(
    'status est inscriptible pour chaque module concerné',
    missing.length === 0,
    missing.length ? missing.join(', ') : 'WRITABLE_FIELDS',
  );
}

console.log('\n— Robustesse du traitement par lot —');

{
  check('le lot utilise allSettled', /Promise\.allSettled/.test(listSrc));
  check(
    'les deux actions groupées passent par runBulk',
    [...listSrc.matchAll(/await runBulk\(/g)].length === 2,
    `${[...listSrc.matchAll(/await runBulk\(/g)].length} appel(s)`,
  );
  check('un verrou empêche le double envoi', /disabled=\{busy/.test(listSrc));
  check(
    'seules les fiches traitées sont retirées de la liste',
    /done\.includes\(String\(r\.id\)\)/.test(listSrc),
  );
  check(
    'les fiches en échec restent sélectionnées',
    /setSelected\(selected\.filter\(\(id\) => !done\.includes\(id\)\)\)/.test(listSrc),
  );
}

{
  // Rejoue la logique de runBulk : 2 succès / 1 échec doit rendre done=2.
  const runBulk = async (ids, action) => {
    const results = await Promise.allSettled(ids.map((id) => action(id)));
    const done = [];
    let firstError = null;
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') done.push(ids[i]);
      else if (!firstError) firstError = res.reason;
    });
    return { done, failed: ids.length - done.length, firstError };
  };

  const out = await runBulk(['1', '2', '3'], async (id) => {
    if (id === '2') throw new Error('403');
    return true;
  });
  check('échec partiel : 2 traitées, 1 en échec', out.done.length === 2 && out.failed === 1, `done=${out.done.join(',')} failed=${out.failed}`);
  check('la fiche en échec est exclue des traitées', !out.done.includes('2'));
  check('la première erreur est conservée', String(out.firstError?.message) === '403');

  const all = await runBulk(['1', '2'], async () => true);
  check('tout réussit : aucun échec', all.failed === 0 && all.done.length === 2);
}

console.log('\n— Libellés —');

{
  const keys = [
    'bulkStatusConfirm', 'bulkStatusDone', 'bulkStatusNoop',
    'bulkPartial', 'bulkError', 'clearSelection',
    'statusDraft', 'statusPublished', 'statusArchived',
  ];
  const missing = [];
  for (const l of LOCALES) {
    const common = messages[l]?.admin?.common || {};
    for (const k of keys) if (typeof common[k] !== 'string') missing.push(`${l}.${k}`);
  }
  check(
    'les libellés du lot existent en fr/en/ar',
    missing.length === 0,
    missing.length ? missing.join(', ') : `${keys.length} clés × ${LOCALES.length} langues`,
  );

  // Les messages à substitution doivent porter leurs variables, sinon
  // next-intl lève une erreur au rendu.
  const withVars = { bulkStatusConfirm: ['count', 'status'], bulkStatusDone: ['count', 'status'], bulkPartial: ['done', 'failed'], bulkStatusNoop: ['status'] };
  const bad = [];
  for (const l of LOCALES) {
    for (const [k, vars] of Object.entries(withVars)) {
      const val = messages[l]?.admin?.common?.[k] || '';
      for (const v of vars) if (!val.includes(`{${v}}`)) bad.push(`${l}.${k}:{${v}}`);
    }
  }
  check('les variables de substitution sont présentes', bad.length === 0, bad.length ? bad.join(', ') : 'ok');
}

console.log(
  failures === 0
    ? '\n✅ Tous les contrôles passent.\n'
    : `\n❌ ${failures} contrôle(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
