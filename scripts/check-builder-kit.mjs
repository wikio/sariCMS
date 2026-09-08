#!/usr/bin/env node
/**
 * scripts/check-builder-kit.mjs — la bibliothèque de blocs du constructeur, à plat.
 *
 * Le constructeur vit de trois tableaux (`lib/builder-components.ts`) que le reste
 * de l'application ne voit jamais : la liste des blocs, celle des points de départ,
 * et les classes de réglage citées dans chaque fiche. Rien ne les coud : un `id`
 * doublé ne casse la compilation de rien du tout, il fait juste insérer le mauvais
 * HTML au clic (le premier gagné) et pleurnicher React, qui cèle ses enfants par
 * `id`. Une classe de fiche qui n'existe dans aucune feuille est pareillement muette :
 * le panneau de style la propose, elle ne change rien.
 *
 * Ce contrôle est additif et ne réécrit rien : il dit ce qui cloche et sort 1.
 * Il ne fait pas de CSS ni de HTML — juste de la lecture croisée de trois fichiers.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const source = read('lib/builder-components.ts');

/** Les littéraux d'un tableau exporté, entre son `export const` et le suivant. */
function entries(name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) return null;
  const rest = source.slice(start);
  const stop = rest.search(/\n\];/);
  return rest.slice(0, stop < 0 ? rest.length : stop);
}

const blocks = entries('BUILDER_COMPONENTS');
const templates = entries('STARTER_TEMPLATES');
if (!blocks || !templates) {
  console.error('lib/builder-components.ts ne ressemble plus à ce que ce script attend (BUILDER_COMPONENTS / STARTER_TEMPLATES introuvables).');
  process.exit(1);
}

const ids = (text) => [...text.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
const blockIds = ids(blocks);
const templateIds = ids(templates);
const dup = (list) => [...new Set(list.filter((id, i) => list.indexOf(id) !== i))];

const problems = [];
const notes = [];

// 1 — un identifiant par fiche, sinon la deuxième est inatteignable.
for (const [what, list] of [['bloc', blockIds], ['point de départ', templateIds]]) {
  for (const id of dup(list)) problems.push(`${what} « ${id} » déclaré plusieurs fois : la première fiche gagne le clic, les autres sont muettes.`);
  if (list.length === 0) problems.push(`aucun ${what} déclaré`);
}

// 2 — les points de départ appellent des blocs par leur identifiant : il doit exister.
for (const ref of new Set([...templates.matchAll(/builderComponentById\('([^']+)'\)/g)].map((m) => m[1]))) {
  if (!blockIds.includes(ref)) problems.push(`un point de départ appelle le bloc « ${ref} », qui n'existe pas.`);
}

// 3 — une classe de réglage citée dans une fiche doit faire quelque chose : soit
//      une feuille la dessine, soit le câbleur du comportement la lit. Les deux
//      sources comptent (`.sari-slides--auto` ne colore rien, il allume l'autoplay) ;
//      une classe absente des deux est une promesse que personne ne tient.
const sheets = ['app/globals.css', 'app/builder-kit.css', 'components/builder/use-page-behaviors.ts']
  .map((rel) => { try { return read(rel); } catch { return ''; } })
  .join('\n');
const declared = [...new Set(
  [...blocks.matchAll(/classes:\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])),
)];
for (const selector of declared) {
  // Le nom nu, sans point ni état : le câbleur écrit `classList.contains('sari-slides--auto')`,
  // la feuille écrit `.sari-slides--auto`. L'un comme l'autre tiennent la promesse.
  const base = selector.replace(/^\./, '').split(':')[0];
  if (!sheets.includes(base)) {
    problems.push(`la classe « ${selector} » est citée dans une fiche et ne se lit ni dans une feuille, ni dans le câbleur des comportements.`);
  }
}
notes.push(`${blockIds.length} blocs, ${templateIds.length} points de départ, ${declared.length} classes de réglage croisées avec les feuilles et le câbleur.`);

for (const line of notes) console.log(`  · ${line}`);
if (problems.length) {
  console.error(`\n❌ Bibliothèque du constructeur : ${problems.length} problème(s)`);
  for (const line of [...new Set(problems)]) console.error(`   - ${line}`);
  process.exit(1);
}
console.log('\n✅ Bibliothèque du constructeur : identifiants uniques, classes de réglage réelles, points de départ qui trouvent leurs blocs.');
